import { Octokit } from '@octokit/rest';
import { BuildConfig, BuildJob, GitHubWorkflowInputs } from '../types';
import { buildWorkflowInputs, getWorkflowName } from '../utils/configBuilder';
import { getJob, updateJob, updateJobStatus, addJobLog } from './jobStore';
import logger from '../utils/logger';

// Mock mode flag - set to true when GITHUB_TOKEN is not available
const MOCK_MODE = !process.env.GITHUB_TOKEN;

let octokit: Octokit | null = null;

if (!MOCK_MODE) {
  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
}

const OWNER = process.env.GITHUB_OWNER || 'nextcoreti';
const REPO = process.env.GITHUB_REPO || 'rdgen';
const GEN_URL = process.env.GEN_URL || 'http://localhost:5000';

export async function triggerWorkflow(
  job: BuildJob,
  config: BuildConfig
): Promise<{ success: boolean; error?: string }> {
  const workflowFile = getWorkflowName(config.platform);

  // Generate a simple token for this build
  const buildToken = Buffer.from(`${job.uuid}:${Date.now()}`).toString('base64');

  const inputs = buildWorkflowInputs(config, job.uuid, GEN_URL, buildToken);

  logger.info(`Triggering workflow ${workflowFile} for job ${job.id}`);
  logger.debug('Workflow inputs:', inputs);

  if (MOCK_MODE) {
    return triggerWorkflowMock(job, inputs);
  }

  try {
    // Trigger the workflow
    await octokit!.actions.createWorkflowDispatch({
      owner: OWNER,
      repo: REPO,
      workflow_id: workflowFile,
      ref: 'master',
      inputs: inputs as unknown as Record<string, string>,
    });

    updateJobStatus(job.id, 'queued', 'Workflow triggered, waiting for runner...', 5);
    addJobLog(job.id, `Workflow ${workflowFile} triggered successfully`);

    // Start polling for workflow status
    pollWorkflowStatus(job.id, job.uuid);

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to trigger workflow:', error);
    updateJobStatus(job.id, 'failed', `Failed to trigger workflow: ${error.message}`, 0);
    return { success: false, error: error.message };
  }
}

// Mock implementation for testing without GitHub
async function triggerWorkflowMock(
  job: BuildJob,
  inputs: GitHubWorkflowInputs
): Promise<{ success: boolean; error?: string }> {
  logger.info(`[MOCK] Triggering workflow for job ${job.id}`);

  updateJobStatus(job.id, 'queued', '[MOCK] Workflow triggered, simulating build...', 5);
  addJobLog(job.id, '[MOCK] Workflow triggered (mock mode)');

  // Simulate build progress
  simulateBuildProgress(job.id);

  return { success: true };
}

async function simulateBuildProgress(jobId: string): Promise<void> {
  const stages = [
    { progress: 10, message: '[MOCK] Checking out RustDesk source...' },
    { progress: 15, message: '[MOCK] Installing Flutter...' },
    { progress: 20, message: '[MOCK] Installing Rust toolchain...' },
    { progress: 25, message: '[MOCK] Applying patches...' },
    { progress: 35, message: '[MOCK] Installing vcpkg dependencies...' },
    { progress: 50, message: '[MOCK] Building RustDesk (this takes ~5 min)...' },
    { progress: 70, message: '[MOCK] Building MSI installer...' },
    { progress: 85, message: '[MOCK] Signing binaries...' },
    { progress: 95, message: '[MOCK] Uploading artifacts...' },
    { progress: 100, message: 'Success' },
  ];

  updateJobStatus(jobId, 'in_progress', stages[0].message, stages[0].progress);

  for (let i = 1; i < stages.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds per stage

    const stage = stages[i];
    addJobLog(jobId, stage.message);

    if (i === stages.length - 1) {
      // Final stage - complete the job
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        statusMessage: 'Success',
        artifactUrl: `/api/artifact/${jobId}?type=exe`,
        artifactMsiUrl: `/api/artifact/${jobId}?type=msi`,
        workflowRunUrl: 'https://github.com/nextcoreti/rdgen/actions',
      });
    } else {
      updateJobStatus(jobId, 'in_progress', stage.message, stage.progress);
    }
  }
}

async function pollWorkflowStatus(jobId: string, uuid: string): Promise<void> {
  if (MOCK_MODE) {
    return; // Mock mode handles its own progress
  }

  const maxAttempts = 1080; // 90 minutes max (5 sec intervals = 1080 attempts)
  let attempts = 0;
  let runId: number | null = null;
  let lastJobStatus: string | null = null;

  const poll = async () => {
    attempts++;

    if (attempts > maxAttempts) {
      updateJobStatus(jobId, 'failed', 'Build timed out after 90 minutes', 0);
      return;
    }

    // The workflow reports completion itself (/api/updategh) before GitHub finishes its
    // post-job steps (cache save, cleanup); never move a finished job back to in_progress.
    const latest = getJob(jobId);
    if (!latest || ['completed', 'failed', 'cancelled'].includes(latest.status)) {
      return;
    }

    try {
      // Find the workflow run by searching recent runs
      if (!runId) {
        const runs = await octokit!.actions.listWorkflowRunsForRepo({
          owner: OWNER,
          repo: REPO,
          per_page: 10,
        });

        // Look for a run that matches our UUID in the name or was started recently
        for (const run of runs.data.workflow_runs) {
          if (run.status !== 'completed') {
            runId = run.id;
            updateJob(jobId, {
              workflowRunId: runId,
              workflowRunUrl: run.html_url,
            });
            addJobLog(jobId, `Found workflow run: ${run.html_url}`);
            break;
          }
        }
      }

      if (runId) {
        const run = await octokit!.actions.getWorkflowRun({
          owner: OWNER,
          repo: REPO,
          run_id: runId,
        });

        if (run.data.status === 'completed') {
          if (run.data.conclusion === 'success') {
            // Get current job to check if artifact URLs were already set by /api/save_custom_client
            const currentJob = getJob(jobId);

            // Only look for GitHub artifacts if URLs weren't already set by the workflow upload
            let artifactUrl: string | undefined = currentJob?.artifactUrl;
            let artifactMsiUrl: string | undefined = currentJob?.artifactMsiUrl;

            // If artifacts weren't set by save_custom_client, try to get from GitHub
            if (!artifactUrl || !artifactMsiUrl) {
              const artifacts = await octokit!.actions.listWorkflowRunArtifacts({
                owner: OWNER,
                repo: REPO,
                run_id: runId,
              });

              for (const artifact of artifacts.data.artifacts) {
                if (artifact.name.endsWith('.exe') && !artifactUrl) {
                  artifactUrl = `/api/artifact/${jobId}?artifact_id=${artifact.id}`;
                } else if (artifact.name.endsWith('.msi') && !artifactMsiUrl) {
                  artifactMsiUrl = `/api/artifact/${jobId}?artifact_id=${artifact.id}`;
                }
              }
            }

            updateJob(jobId, {
              status: 'completed',
              progress: 100,
              statusMessage: 'Success',
              artifactUrl,
              artifactMsiUrl,
            });
          } else {
            updateJobStatus(
              jobId,
              'failed',
              `Build failed: ${run.data.conclusion}`,
              0
            );
          }
          return;
        }

        // Try to get current job status from workflow jobs
        try {
          const jobs = await octokit!.actions.listJobsForWorkflowRun({
            owner: OWNER,
            repo: REPO,
            run_id: runId,
          });

          let currentStep = '';
          let stepsCompleted = 0;
          let totalSteps = 0;

          for (const job of jobs.data.jobs) {
            if (job.status === 'in_progress' && job.steps) {
              totalSteps = job.steps.length;
              for (const step of job.steps) {
                if (step.status === 'completed') {
                  stepsCompleted++;
                } else if (step.status === 'in_progress') {
                  currentStep = step.name;
                  break;
                }
              }
            }
          }

          // Calculate progress based on steps or time
          let progress: number;
          let statusMessage: string;

          if (totalSteps > 0 && currentStep) {
            progress = Math.min(95, Math.round((stepsCompleted / totalSteps) * 100));
            statusMessage = currentStep;
          } else {
            // Fallback: estimate based on time (builds usually take 40-70 min)
            const elapsedMin = (attempts * 5) / 60;
            progress = Math.min(95, Math.round((elapsedMin / 50) * 100));
            statusMessage = `Building... (~${Math.round(elapsedMin)} min elapsed)`;
          }

          updateJobStatus(jobId, 'in_progress', statusMessage, progress);
        } catch (stepError) {
          // Fallback if we can't get job steps
          const elapsedMin = (attempts * 5) / 60;
          const progress = Math.min(95, Math.round((elapsedMin / 50) * 100));
          updateJobStatus(
            jobId,
            'in_progress',
            `Building... (~${Math.round(elapsedMin)} min elapsed)`,
            progress
          );
        }
      }

      // Continue polling
      setTimeout(poll, 5000);
    } catch (error: any) {
      logger.error('Error polling workflow status:', error);
      // Keep retrying on poll errors - don't fail the job just because of a transient API error
      if (attempts < maxAttempts) {
        setTimeout(poll, 10000); // Wait 10s on error before retrying
      } else {
        updateJobStatus(jobId, 'failed', `Build timed out`, 0);
      }
    }
  };

  // Start polling after a short delay
  setTimeout(poll, 5000);
}

export async function cancelWorkflow(
  jobId: string,
  runId: number
): Promise<{ success: boolean; error?: string }> {
  if (MOCK_MODE) {
    updateJobStatus(jobId, 'cancelled', '[MOCK] Build cancelled', 0);
    return { success: true };
  }

  try {
    await octokit!.actions.cancelWorkflowRun({
      owner: OWNER,
      repo: REPO,
      run_id: runId,
    });

    updateJobStatus(jobId, 'cancelled', 'Build cancelled by user', 0);
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to cancel workflow:', error);
    return { success: false, error: error.message };
  }
}

export function isMockMode(): boolean {
  return MOCK_MODE;
}
