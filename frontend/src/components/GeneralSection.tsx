'use client';

import { BuildConfig, ConnectionDirection, RUSTDESK_VERSIONS, RustDeskVersion } from '@/types';

interface GeneralSectionProps {
  config: BuildConfig;
  onChange: (updates: Partial<BuildConfig>) => void;
}

export default function GeneralSection({ config, onChange }: GeneralSectionProps) {
  return (
    <div className="section">
      <h2 className="section-title">
        <i className="fas fa-sliders-h text-sm"></i>
        General
      </h2>

      <label className="input-label">RustDesk Version</label>
      <select
        value={config.version}
        onChange={(e) => onChange({ version: e.target.value as RustDeskVersion })}
        className="input-field"
      >
        {RUSTDESK_VERSIONS.map((v) => (
          <option key={v} value={v}>
            {v.endsWith('-nextcore') ? `${v.replace(/-nextcore$/, '')} — tema NextCore (só Windows)` : v}
          </option>
        ))}
      </select>

      <label className="input-label">Configuration Name</label>
      <input
        type="text"
        value={config.configName}
        onChange={(e) =>
          onChange({
            configName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
          })
        }
        className="input-field"
        placeholder="MyRustDesk"
      />

      <label className="input-label">Application Name</label>
      <input
        type="text"
        value={config.appName}
        onChange={(e) => onChange({ appName: e.target.value })}
        className="input-field"
        placeholder="RustDesk"
      />

      <label className="input-label">Output Filename</label>
      <input
        type="text"
        value={config.filename}
        onChange={(e) =>
          onChange({
            filename: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
          })
        }
        className="input-field"
        placeholder="rustdesk"
      />

      <label className="input-label">Connection Type</label>
      <select
        value={config.connectionDirection}
        onChange={(e) =>
          onChange({ connectionDirection: e.target.value as ConnectionDirection })
        }
        className="input-field"
      >
        <option value="Both">Bidirectional</option>
        <option value="Incoming">Incoming Only</option>
        <option value="Outgoing">Outgoing Only</option>
      </select>

      <div className="mt-3 checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.disableInstallation}
            onChange={(e) => onChange({ disableInstallation: e.target.checked })}
          />
          <span>Disable Installation</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.disableSettings}
            onChange={(e) => onChange({ disableSettings: e.target.checked })}
          />
          <span>Disable Settings</span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.delayFix}
            onChange={(e) => onChange({ delayFix: e.target.checked })}
          />
          <span>Fix connection delay</span>
        </label>
      </div>
    </div>
  );
}
