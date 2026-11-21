'use client';

import { BuildConfig } from '@/types';

interface ServerSectionProps {
  config: BuildConfig;
  onChange: (updates: Partial<BuildConfig>) => void;
}

export default function ServerSection({ config, onChange }: ServerSectionProps) {
  return (
    <div className="section">
      <h2 className="section-title">
        <i className="fas fa-server text-sm"></i>
        Custom Server
      </h2>

      <label className="input-label">Host (Rendezvous Server)</label>
      <input
        type="text"
        value={config.host}
        onChange={(e) => onChange({ host: e.target.value })}
        className="input-field"
        placeholder="rustdesk.example.com"
      />

      <label className="input-label">Key (Public Key)</label>
      <input
        type="text"
        value={config.key}
        onChange={(e) => onChange({ key: e.target.value })}
        className="input-field"
        placeholder="YOUR_PUBLIC_KEY_BASE64"
      />

      <label className="input-label">API Server</label>
      <input
        type="text"
        value={config.apiServer}
        onChange={(e) => onChange({ apiServer: e.target.value })}
        className="input-field"
        placeholder="https://rustdesk.example.com:21114"
      />

      <label className="input-label">Custom URL (links)</label>
      <input
        type="text"
        value={config.urlLink}
        onChange={(e) => onChange({ urlLink: e.target.value })}
        className="input-field"
        placeholder="https://rustdesk.com"
      />

      <label className="input-label">Custom URL (updates)</label>
      <input
        type="text"
        value={config.downloadLink}
        onChange={(e) => onChange({ downloadLink: e.target.value })}
        className="input-field"
        placeholder="https://rustdesk.com/download"
      />

      <label className="input-label">Company Name</label>
      <input
        type="text"
        value={config.companyName}
        onChange={(e) => onChange({ companyName: e.target.value })}
        className="input-field"
        placeholder="ex.: Next Core TI Ltda."
      />
      <p className="text-xs text-gray-500 mt-1">
        Aparece em Sobre, nas propriedades do programa e no instalador. Prefira só o nome, sem endereço.
      </p>

      <label className="input-label mt-3">Nome no aviso de conexão</label>
      <input
        type="text"
        value={config.supportName || ''}
        onChange={(e) => onChange({ supportName: e.target.value })}
        className="input-field"
        placeholder="ex.: Suporte Next Core TI"
        maxLength={40}
      />
      <p className="text-xs text-gray-500 mt-1">
        Fica em destaque na janela que o cliente vê quando alguém conecta, com o nome do técnico menor embaixo.
        Só nas versões com tema NextCore.
      </p>
    </div>
  );
}
