'use client';

import { useRef, useState, useEffect } from 'react';
import { BuildConfig, ThemeMode, PermissionMode } from '@/types';

interface VisualSectionProps {
  config: BuildConfig;
  onChange: (updates: Partial<BuildConfig>) => void;
}

// Helper to ensure base64 has proper data URL prefix
function toDataUrl(base64: string | undefined): string | null {
  if (!base64) return null;
  if (base64.startsWith('data:')) return base64;
  return `data:image/png;base64,${base64}`;
}

export default function VisualSection({ config, onChange }: VisualSectionProps) {
  const iconInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const privacyInputRef = useRef<HTMLInputElement>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(toDataUrl(config.iconBase64));
  const [logoPreview, setLogoPreview] = useState<string | null>(toDataUrl(config.logoBase64));
  const [privacyPreview, setPrivacyPreview] = useState<string | null>(toDataUrl(config.privacyBase64));

  // Update previews when config changes (e.g., when loading a saved config)
  useEffect(() => {
    setIconPreview(toDataUrl(config.iconBase64));
  }, [config.iconBase64]);

  useEffect(() => {
    setLogoPreview(toDataUrl(config.logoBase64));
  }, [config.logoBase64]);

  useEffect(() => {
    setPrivacyPreview(toDataUrl(config.privacyBase64));
  }, [config.privacyBase64]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'icon' | 'logo' | 'privacy'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      alert('Please upload a PNG file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (type === 'icon') {
        setIconPreview(base64);
        onChange({ iconBase64: base64 });
      } else if (type === 'logo') {
        setLogoPreview(base64);
        onChange({ logoBase64: base64 });
      } else {
        setPrivacyPreview(base64);
        onChange({ privacyBase64: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="section">
      <h2 className="section-title">
        <i className="fas fa-paint-brush text-sm"></i>
        Visual
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="input-label">App Icon (PNG)</label>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/png"
            onChange={(e) => handleFileChange(e, 'icon')}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => iconInputRef.current?.click()}
            className="btn-secondary w-full text-xs"
          >
            <i className="fas fa-upload mr-1"></i>
            Upload Icon
          </button>
          {iconPreview && (
            <div className="mt-1 p-1 bg-[#222] rounded inline-flex items-center">
              <img src={iconPreview} alt="Icon" className="max-h-10 max-w-10" />
              <button
                type="button"
                onClick={() => { setIconPreview(null); onChange({ iconBase64: undefined }); }}
                className="ml-1 text-red-500 hover:text-red-400 text-xs"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="input-label">App Logo (PNG)</label>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png"
            onChange={(e) => handleFileChange(e, 'logo')}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="btn-secondary w-full text-xs"
          >
            <i className="fas fa-upload mr-1"></i>
            Upload Logo
          </button>
          {logoPreview && (
            <div className="mt-1 p-1 bg-[#222] rounded inline-flex items-center">
              <img src={logoPreview} alt="Logo" className="max-h-10" />
              <button
                type="button"
                onClick={() => { setLogoPreview(null); onChange({ logoBase64: undefined }); }}
                className="ml-1 text-red-500 hover:text-red-400 text-xs"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="input-label">Custom Privacy Screen (PNG)</label>
        <input
          ref={privacyInputRef}
          type="file"
          accept="image/png"
          onChange={(e) => handleFileChange(e, 'privacy')}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => privacyInputRef.current?.click()}
          className="btn-secondary w-full text-xs"
        >
          <i className="fas fa-upload mr-1"></i>
          Upload Privacy Screen
        </button>
        {privacyPreview && (
          <div className="mt-1 p-1 bg-[#222] rounded inline-flex items-center">
            <img src={privacyPreview} alt="Privacy Screen" className="max-h-10" />
            <button
              type="button"
              onClick={() => { setPrivacyPreview(null); onChange({ privacyBase64: undefined }); }}
              className="ml-1 text-red-500 hover:text-red-400 text-xs"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">Theme</label>
          <select
            value={config.theme}
            onChange={(e) => onChange({ theme: e.target.value as ThemeMode })}
            className="input-field"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <label className="input-label">Mode</label>
          <select
            value={config.themeMode}
            onChange={(e) => onChange({ themeMode: e.target.value as PermissionMode })}
            className="input-field"
          >
            <option value="default">Default</option>
            <option value="override">Override</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="input-label">Accent Color (cor de destaque)</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(config.accentColor || '') ? config.accentColor : '#0071FF'}
            onChange={(e) => onChange({ accentColor: e.target.value })}
            className="h-9 w-14 rounded cursor-pointer bg-transparent border border-[#333] p-0"
            aria-label="Accent color"
          />
          <input
            type="text"
            value={config.accentColor || ''}
            onChange={(e) => onChange({ accentColor: e.target.value })}
            placeholder="#0071FF — vazio = padrão RustDesk"
            className="input-field flex-1"
          />
          {config.accentColor && (
            <button
              type="button"
              onClick={() => onChange({ accentColor: '' })}
              className="text-red-500 hover:text-red-400 text-xs px-2"
              aria-label="Limpar cor de destaque"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Colore botões, abas selecionadas e destaques do app (tema Flutter). Deixe vazio para o azul padrão.
        </p>
      </div>
    </div>
  );
}
