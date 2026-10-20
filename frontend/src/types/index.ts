export type Platform = 'windows' | 'windows-x86' | 'linux' | 'android' | 'macos';

export type RustDeskVersion =
  | 'nightly'
  | '1.5.0'
  | '1.4.9'
  | '1.4.8'
  | '1.4.7'
  | '1.4.6'
  | '1.4.5'
  | '1.4.4'
  | '1.4.3'
  | '1.4.2'
  | '1.4.1'
  | '1.4.0'
  | '1.3.9'
  | '1.3.8'
  | '1.3.7'
  | '1.3.6'
  | '1.3.5'
  | '1.3.4'
  | '1.3.3'
  | '1.3.2'
  | '1.3.1'
  | '1.3.0'
  | '1.2.7'
  | '1.2.6'
  | '1.2.5'
  | '1.2.3-1';

export type ConnectionDirection = 'Both' | 'Incoming' | 'Outgoing';

export type ThemeMode = 'system' | 'light' | 'dark';

export type ApproveMode = 'password' | 'click' | 'password-click';

export type PermissionMode = 'default' | 'override';

export type PermissionType = 'full' | 'view' | 'custom';

export type CodecPreference = 'vp9' | 'vp8' | 'h264' | 'h265' | 'av1';

export type DisplayMode = 'original' | 'adaptive' | 'fit';

export interface BuildConfig {
  // Platform & Version
  platform: Platform;
  version: RustDeskVersion;

  // General
  configName: string;
  appName: string;
  filename: string;
  connectionDirection: ConnectionDirection;
  disableInstallation: boolean;
  disableSettings: boolean;

  // Server
  host: string;
  key: string;
  apiServer: string;
  urlLink: string;
  downloadLink: string;
  companyName: string;

  // Security
  approveMode: ApproveMode;
  permanentPassword: string;
  denyLanDiscovery: boolean;
  enableDirectIp: boolean;
  autoCloseInactivity: boolean;
  allowHideConnectionWindow: boolean;

  // Visual
  iconBase64?: string;
  logoBase64?: string;
  privacyBase64?: string;
  theme: ThemeMode;
  themeMode: PermissionMode;

  // Permissions
  permissionsMode: PermissionMode;
  permissionsType: PermissionType;
  enableKeyboard: boolean;
  enableClipboard: boolean;
  enableFileTransfer: boolean;
  enableAudio: boolean;
  enableTcp: boolean;
  enableRemoteRestart: boolean;
  enableRecording: boolean;
  enableBlockingInput: boolean;
  enableRemoteConfig: boolean;
  enablePrinter: boolean;
  enableCamera: boolean;
  enableTerminal: boolean;

  // Code Changes
  cycleMonitor: boolean;
  xOffline: boolean;
  removeNewVersionNotif: boolean;
  delayFix: boolean;

  // Peer Tabs Visibility
  showRecentTab: boolean;
  showFavoritesTab: boolean;
  showDiscoveredTab: boolean;
  showAddressBookTab: boolean;
  showMyGroupTab: boolean;

  // Other
  removeWallpaper: boolean;
  defaultSettings: string;
  overrideSettings: string;

  // Display Settings
  customImageQuality: number;
  codecPreference: CodecPreference;
  enableHwCodec: boolean;
  fps: number;
  displayMode: DisplayMode;
}

export type BuildStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BuildJob {
  id: string;
  uuid: string;
  config: BuildConfig;
  status: BuildStatus;
  progress: number;
  statusMessage: string;
  logs: string[];
  artifactUrl?: string;
  artifactMsiUrl?: string;
  // Linux artifacts
  artifactDebUrl?: string;
  artifactRpmUrl?: string;
  artifactRpmSuseUrl?: string;
  artifactAppImageUrl?: string;
  artifactPkgUrl?: string;
  // macOS artifacts
  artifactDmgX64Url?: string;
  artifactDmgArm64Url?: string;
  // Android artifacts
  artifactApkUrl?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflowRunId?: number;
  workflowRunUrl?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const DEFAULT_BUILD_CONFIG: BuildConfig = {
  platform: 'windows',
  version: '1.4.9',
  configName: '',
  appName: '',
  filename: '',
  connectionDirection: 'Both',
  disableInstallation: false,
  disableSettings: false,
  host: '',
  key: '',
  apiServer: '',
  urlLink: '',
  downloadLink: '',
  companyName: '',
  approveMode: 'password-click',
  permanentPassword: '',
  denyLanDiscovery: false,
  enableDirectIp: false,
  autoCloseInactivity: false,
  allowHideConnectionWindow: false,
  theme: 'system',
  themeMode: 'default',
  permissionsMode: 'default',
  permissionsType: 'full',
  enableKeyboard: true,
  enableClipboard: true,
  enableFileTransfer: true,
  enableAudio: true,
  enableTcp: true,
  enableRemoteRestart: true,
  enableRecording: true,
  enableBlockingInput: true,
  enableRemoteConfig: true,
  enablePrinter: false,
  enableCamera: true,
  enableTerminal: true,
  cycleMonitor: false,
  xOffline: false,
  removeNewVersionNotif: true,
  delayFix: false,
  showRecentTab: false,
  showFavoritesTab: false,
  showDiscoveredTab: false,
  showAddressBookTab: true,
  showMyGroupTab: true,
  removeWallpaper: false,
  defaultSettings: '',
  overrideSettings: '',
  customImageQuality: 50,
  codecPreference: 'vp9',
  enableHwCodec: true,
  fps: 30,
  displayMode: 'adaptive',
};

export const RUSTDESK_VERSIONS: RustDeskVersion[] = [
  'nightly',
  '1.5.0',
  '1.4.9',
  '1.4.8',
  '1.4.7',
  '1.4.6',
  '1.4.5',
  '1.4.4',
  '1.4.3',
  '1.4.2',
  '1.4.1',
  '1.4.0',
  '1.3.9',
  '1.3.8',
  '1.3.7',
  '1.3.6',
  '1.3.5',
  '1.3.4',
  '1.3.3',
  '1.3.2',
  '1.3.1',
  '1.3.0',
  '1.2.7',
  '1.2.6',
  '1.2.5',
  '1.2.3-1',
];

export const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
  { value: 'windows', label: 'Windows 64-bit', icon: 'fab fa-windows' },
  { value: 'windows-x86', label: 'Windows 32-bit', icon: 'fab fa-windows' },
  { value: 'linux', label: 'Linux', icon: 'fab fa-linux' },
  { value: 'android', label: 'Android', icon: 'fab fa-android' },
  { value: 'macos', label: 'macOS', icon: 'fab fa-apple' },
];

// Template type
export type TemplateType = 'admin' | 'host' | 'cliente' | 'custom';

export interface ConfigTemplate {
  id: TemplateType;
  name: string;
  description: string;
  icon: string;
  config: Partial<BuildConfig>;
}

// Predefined templates
export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Acesso total, pode conectar e receber conexões. Sem senha permanente.',
    icon: 'fas fa-user-shield',
    config: {
      connectionDirection: 'Both',
      disableInstallation: false,
      disableSettings: false,
      approveMode: 'password-click',
      permanentPassword: '',
      denyLanDiscovery: false,
      enableDirectIp: true,
      autoCloseInactivity: false,
      allowHideConnectionWindow: false,
      theme: 'system',
      themeMode: 'default',
      permissionsMode: 'default',
      permissionsType: 'full',
      enableKeyboard: true,
      enableClipboard: true,
      enableFileTransfer: true,
      enableAudio: true,
      enableTcp: true,
      enableRemoteRestart: true,
      enableRecording: true,
      enableBlockingInput: true,
      enableRemoteConfig: true,
      enablePrinter: false,
      enableCamera: true,
      enableTerminal: true,
      cycleMonitor: false,
      xOffline: true,
      removeNewVersionNotif: true,
      delayFix: true,
      showRecentTab: false,
      showFavoritesTab: false,
      showDiscoveredTab: false,
      showAddressBookTab: true,
      showMyGroupTab: true,
      removeWallpaper: true,
      defaultSettings: '',
      overrideSettings: '',
    },
  },
  {
    id: 'host',
    name: 'Host',
    description: 'Apenas recebe conexões. Configurações bloqueadas. Requer senha.',
    icon: 'fas fa-server',
    config: {
      connectionDirection: 'Incoming',
      disableInstallation: false,
      disableSettings: true,
      approveMode: 'password-click',
      permanentPassword: '', // User must fill
      denyLanDiscovery: false,
      enableDirectIp: true,
      autoCloseInactivity: false,
      allowHideConnectionWindow: false,
      theme: 'system',
      themeMode: 'default',
      permissionsMode: 'default',
      permissionsType: 'full',
      enableKeyboard: true,
      enableClipboard: true,
      enableFileTransfer: true,
      enableAudio: true,
      enableTcp: true,
      enableRemoteRestart: true,
      enableRecording: true,
      enableBlockingInput: true,
      enableRemoteConfig: true,
      enablePrinter: false,
      enableCamera: true,
      enableTerminal: true,
      cycleMonitor: false,
      xOffline: false,
      removeNewVersionNotif: true,
      delayFix: true,
      showRecentTab: false,
      showFavoritesTab: false,
      showDiscoveredTab: false,
      showAddressBookTab: true,
      showMyGroupTab: true,
      removeWallpaper: true,
      defaultSettings: 'hide-security-settings=Y',
      overrideSettings: '',
    },
  },
  {
    id: 'cliente',
    name: 'Cliente',
    description: 'Pode conectar e receber conexões. Configurações habilitadas. Requer senha.',
    icon: 'fas fa-user',
    config: {
      connectionDirection: 'Both',
      disableInstallation: false,
      disableSettings: false,
      approveMode: 'password-click',
      permanentPassword: '', // User must fill
      denyLanDiscovery: false,
      enableDirectIp: true,
      autoCloseInactivity: false,
      allowHideConnectionWindow: false,
      theme: 'system',
      themeMode: 'default',
      permissionsMode: 'default',
      permissionsType: 'full',
      enableKeyboard: true,
      enableClipboard: true,
      enableFileTransfer: true,
      enableAudio: true,
      enableTcp: true,
      enableRemoteRestart: true,
      enableRecording: true,
      enableBlockingInput: true,
      enableRemoteConfig: true,
      enablePrinter: false,
      enableCamera: true,
      enableTerminal: true,
      cycleMonitor: false,
      xOffline: false,
      removeNewVersionNotif: true,
      delayFix: true,
      showRecentTab: false,
      showFavoritesTab: false,
      showDiscoveredTab: false,
      showAddressBookTab: true,
      showMyGroupTab: true,
      removeWallpaper: true,
      defaultSettings: 'hide-security-settings=Y',
      overrideSettings: '',
    },
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Comece do zero e configure manualmente.',
    icon: 'fas fa-cog',
    config: {},
  },
];

// =====================
// Client Profile types
// =====================

export interface ClientListItem {
  id: string;
  name: string;
  profileCount: number;
  updatedAt: string;
}

export interface ProfileListItem {
  profileId: string;
  name: string;
  host: string;
  platform: string;
  versionCount: number;
  latestVersionId: string;
  updatedAt: string;
}

export interface ClientVersionInfo {
  versionId: string;
  createdAt: string;
  label: string;
}

export interface ProfileDetail {
  profileId: string;
  name: string;
  host: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId: string;
  versions: ClientVersionInfo[];
}

export interface ClientDetail {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  profiles: ProfileDetail[];
}
