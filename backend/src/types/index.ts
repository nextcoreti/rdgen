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
  platform: Platform;
  version: RustDeskVersion;
  configName: string;
  appName: string;
  filename: string;
  connectionDirection: ConnectionDirection;
  disableInstallation: boolean;
  disableSettings: boolean;
  host: string;
  key: string;
  apiServer: string;
  urlLink: string;
  downloadLink: string;
  companyName: string;
  approveMode: ApproveMode;
  permanentPassword: string;
  denyLanDiscovery: boolean;
  enableDirectIp: boolean;
  autoCloseInactivity: boolean;
  allowHideConnectionWindow: boolean;
  iconBase64?: string;
  logoBase64?: string;
  privacyBase64?: string;
  theme: ThemeMode;
  themeMode: PermissionMode;
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
  cycleMonitor: boolean;
  xOffline: boolean;
  removeNewVersionNotif: boolean;
  delayFix: boolean;
  showRecentTab: boolean;
  showFavoritesTab: boolean;
  showDiscoveredTab: boolean;
  showAddressBookTab: boolean;
  showMyGroupTab: boolean;
  removeWallpaper: boolean;
  defaultSettings: string;
  overrideSettings: string;
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

export interface GitHubWorkflowInputs {
  server: string;
  key: string;
  apiServer: string;
  custom: string;
  uuid: string;
  iconlink: string;
  logolink: string;
  privacylink: string;
  appname: string;
  filename: string;
  extras: string;
}

export interface CustomJson {
  'conn-type'?: string;
  'disable-installation'?: string;
  'disable-settings'?: string;
  'app-name'?: string;
  password?: string;
  'override-settings': Record<string, string | boolean[]>;
  'default-settings': Record<string, string>;
  'enable-lan-discovery'?: string;
  'allow-auto-disconnect'?: string;
}

export interface ExtrasJson {
  genurl: string;
  urlLink: string;
  downloadLink: string;
  delayFix: string;
  version: string;
  rdgen: string;
  cycleMonitor: string;
  xOffline: string;
  removeNewVersionNotif: string;
  compname: string;
  token?: string;
  tokenApiUrl?: string;  // URL for token-based authentication (MVP)
}

// API Key types for multi-tenant authentication
export interface ApiKey {
  id: string;
  key: string;
  name: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  // Rate limiting
  rateLimit?: number; // builds per day
  buildsToday?: number;
  lastResetDate?: string;
  // Default config overrides (tenant can set defaults)
  defaultConfig?: Partial<BuildConfig>;
}
