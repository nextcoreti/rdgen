import { BuildJob, BuildStatus } from '../types';
import logger from '../utils/logger';
import db from './db';

function rowToJob(row: any): BuildJob {
  return {
    id: row.id,
    uuid: row.uuid,
    config: JSON.parse(row.config),
    status: row.status as BuildStatus,
    progress: row.progress,
    statusMessage: row.status_message,
    logs: JSON.parse(row.logs),
    artifactUrl: row.artifact_url ?? undefined,
    artifactMsiUrl: row.artifact_msi_url ?? undefined,
    artifactDebUrl: row.artifact_deb_url ?? undefined,
    artifactRpmUrl: row.artifact_rpm_url ?? undefined,
    artifactRpmSuseUrl: row.artifact_rpm_suse_url ?? undefined,
    artifactAppImageUrl: row.artifact_app_image_url ?? undefined,
    artifactPkgUrl: row.artifact_pkg_url ?? undefined,
    artifactDmgX64Url: row.artifact_dmg_x64_url ?? undefined,
    artifactDmgArm64Url: row.artifact_dmg_arm64_url ?? undefined,
    artifactApkUrl: row.artifact_apk_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    workflowRunId: row.workflow_run_id ?? undefined,
    workflowRunUrl: row.workflow_run_url ?? undefined,
  };
}

export function createJob(job: BuildJob): BuildJob {
  db.prepare(`
    INSERT INTO jobs (
      id, uuid, config, status, progress, status_message, logs,
      artifact_url, artifact_msi_url, artifact_deb_url, artifact_rpm_url,
      artifact_rpm_suse_url, artifact_app_image_url, artifact_pkg_url,
      artifact_dmg_x64_url, artifact_dmg_arm64_url, artifact_apk_url,
      created_at, updated_at, completed_at, workflow_run_id, workflow_run_url
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    job.id, job.uuid, JSON.stringify(job.config), job.status, job.progress,
    job.statusMessage, JSON.stringify(job.logs),
    job.artifactUrl ?? null, job.artifactMsiUrl ?? null,
    job.artifactDebUrl ?? null, job.artifactRpmUrl ?? null,
    job.artifactRpmSuseUrl ?? null, job.artifactAppImageUrl ?? null, job.artifactPkgUrl ?? null,
    job.artifactDmgX64Url ?? null, job.artifactDmgArm64Url ?? null, job.artifactApkUrl ?? null,
    job.createdAt, job.updatedAt, job.completedAt ?? null,
    job.workflowRunId ?? null, job.workflowRunUrl ?? null
  );

  logger.info(`Created job ${job.id}`);
  return job;
}

export function getJob(id: string): BuildJob | undefined {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
  return row ? rowToJob(row) : undefined;
}

export function getJobByUuid(uuid: string): BuildJob | undefined {
  const row = db.prepare('SELECT * FROM jobs WHERE uuid = ?').get(uuid) as any;
  return row ? rowToJob(row) : undefined;
}

export function updateJob(id: string, updates: Partial<BuildJob>): BuildJob | undefined {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
  if (!row) {
    logger.warn(`Job ${id} not found for update`);
    return undefined;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE jobs SET
      config = ?, status = ?, progress = ?, status_message = ?, logs = ?,
      artifact_url = ?, artifact_msi_url = ?, artifact_deb_url = ?, artifact_rpm_url = ?,
      artifact_rpm_suse_url = ?, artifact_app_image_url = ?, artifact_pkg_url = ?,
      artifact_dmg_x64_url = ?, artifact_dmg_arm64_url = ?, artifact_apk_url = ?,
      updated_at = ?, completed_at = ?, workflow_run_id = ?, workflow_run_url = ?
    WHERE id = ?
  `).run(
    JSON.stringify(updates.config ?? JSON.parse(row.config)),
    updates.status ?? row.status,
    updates.progress ?? row.progress,
    updates.statusMessage ?? row.status_message,
    JSON.stringify(updates.logs ?? JSON.parse(row.logs)),
    updates.artifactUrl ?? row.artifact_url,
    updates.artifactMsiUrl ?? row.artifact_msi_url,
    updates.artifactDebUrl ?? row.artifact_deb_url,
    updates.artifactRpmUrl ?? row.artifact_rpm_url,
    updates.artifactRpmSuseUrl ?? row.artifact_rpm_suse_url,
    updates.artifactAppImageUrl ?? row.artifact_app_image_url,
    updates.artifactPkgUrl ?? row.artifact_pkg_url,
    updates.artifactDmgX64Url ?? row.artifact_dmg_x64_url,
    updates.artifactDmgArm64Url ?? row.artifact_dmg_arm64_url,
    updates.artifactApkUrl ?? row.artifact_apk_url,
    now,
    updates.completedAt ?? row.completed_at,
    updates.workflowRunId ?? row.workflow_run_id,
    updates.workflowRunUrl ?? row.workflow_run_url,
    id
  );

  logger.info(`Updated job ${id}: ${updates.status || 'no status change'}`);
  return rowToJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any);
}

export function updateJobStatus(
  id: string,
  status: BuildStatus,
  statusMessage: string,
  progress?: number
): BuildJob | undefined {
  const updates: Partial<BuildJob> = { status, statusMessage };
  if (progress !== undefined) updates.progress = progress;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completedAt = new Date().toISOString();
  }
  return updateJob(id, updates);
}

export function addJobLog(id: string, log: string): BuildJob | undefined {
  const job = getJob(id);
  if (!job) return undefined;
  const logs = [...job.logs, `[${new Date().toISOString()}] ${log}`];
  return updateJob(id, { logs });
}

export function getAllJobs(): BuildJob[] {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToJob);
}

export function deleteJob(id: string): boolean {
  const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  if (result.changes > 0) {
    logger.info(`Deleted job ${id}`);
    return true;
  }
  return false;
}

export function cleanupOldJobs(): number {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM jobs WHERE created_at < ?').run(cutoff);
  if (result.changes > 0) {
    logger.info(`Cleaned up ${result.changes} old jobs`);
  }
  return result.changes;
}

// Run cleanup every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);
