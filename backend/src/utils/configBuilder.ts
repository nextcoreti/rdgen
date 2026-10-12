import { BuildConfig, CustomJson, ExtrasJson, GitHubWorkflowInputs } from '../types';

export function buildCustomJson(config: BuildConfig): CustomJson {
  const custom: CustomJson = {
    'override-settings': {},
    'default-settings': {},
  };

  // Connection direction - RustDesk expects lowercase values
  if (config.connectionDirection !== 'Both') {
    custom['conn-type'] = config.connectionDirection.toLowerCase();
  }

  // Installation and settings
  if (config.disableInstallation) {
    custom['disable-installation'] = 'Y';
  }
  if (config.disableSettings) {
    custom['disable-settings'] = 'Y';
  }

  // App name
  if (config.appName && config.appName.toUpperCase() !== 'RUSTDESK') {
    custom['app-name'] = config.appName;
  }

  // Password
  if (config.permanentPassword) {
    custom.password = config.permanentPassword;
  }

  // LAN discovery and auto close
  custom['enable-lan-discovery'] = config.denyLanDiscovery ? 'N' : 'Y';
  custom['allow-auto-disconnect'] = config.autoCloseInactivity ? 'Y' : 'N';

  // Settings based on mode
  const settings =
    config.permissionsMode === 'override'
      ? custom['override-settings']
      : custom['default-settings'];

  // Theme
  if (config.theme !== 'system') {
    if (config.themeMode === 'default') {
      if (config.platform === 'windows-x86') {
        custom['default-settings']['allow-darktheme'] = config.theme === 'dark' ? 'Y' : 'N';
      } else {
        custom['default-settings'].theme = config.theme;
      }
    } else {
      if (config.platform === 'windows-x86') {
        custom['override-settings']['allow-darktheme'] = config.theme === 'dark' ? 'Y' : 'N';
      } else {
        custom['override-settings'].theme = config.theme;
      }
    }
  }

  // Permissions
  settings['access-mode'] = config.permissionsType;
  settings['enable-keyboard'] = config.enableKeyboard ? 'Y' : 'N';
  settings['enable-clipboard'] = config.enableClipboard ? 'Y' : 'N';
  settings['enable-file-transfer'] = config.enableFileTransfer ? 'Y' : 'N';
  settings['enable-audio'] = config.enableAudio ? 'Y' : 'N';
  settings['enable-tunnel'] = config.enableTcp ? 'Y' : 'N';
  settings['enable-remote-restart'] = config.enableRemoteRestart ? 'Y' : 'N';
  settings['enable-record-session'] = config.enableRecording ? 'Y' : 'N';
  settings['enable-block-input'] = config.enableBlockingInput ? 'Y' : 'N';
  settings['allow-remote-config-modification'] = config.enableRemoteConfig ? 'Y' : 'N';
  settings['direct-server'] = config.enableDirectIp ? 'Y' : 'N';
  settings['verification-method'] = config.allowHideConnectionWindow
    ? 'use-permanent-password'
    : 'use-both-passwords';
  settings['approve-mode'] = config.approveMode;
  settings['allow-hide-cm'] = config.allowHideConnectionWindow ? 'Y' : 'N';
  settings['allow-remove-wallpaper'] = config.removeWallpaper ? 'Y' : 'N';
  settings['enable-remote-printer'] = config.enablePrinter ? 'Y' : 'N';
  settings['enable-camera'] = config.enableCamera ? 'Y' : 'N';
  settings['enable-terminal'] = config.enableTerminal ? 'Y' : 'N';

  // Display Settings
  if (config.customImageQuality !== undefined && config.customImageQuality !== 50) {
    settings['custom-image-quality'] = config.customImageQuality.toString();
  }
  if (config.codecPreference && config.codecPreference !== 'vp9') {
    settings['codec-preference'] = config.codecPreference;
  }
  settings['enable-hwcodec'] = config.enableHwCodec ? 'Y' : 'N';
  if (config.fps !== undefined && config.fps !== 30) {
    settings['custom-fps'] = config.fps.toString();
  }
  if (config.displayMode && config.displayMode !== 'adaptive') {
    settings['view-style'] = config.displayMode;
  }

  // Peer Tabs Visibility - always use override to enforce
  // Note: This should be an actual array, not a stringified array, as RustDesk parses
  // the entire JSON and expects arrays to be actual arrays
  const peerTabVisible = [
    config.showRecentTab ?? false,
    config.showFavoritesTab ?? false,
    config.showDiscoveredTab ?? false,
    config.showAddressBookTab ?? true,
    config.showMyGroupTab ?? true,
  ];
  custom['override-settings']['peer-tab-visible'] = peerTabVisible;

  // Parse manual settings
  if (config.defaultSettings) {
    for (const line of config.defaultSettings.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=');
        custom['default-settings'][key.trim()] = value.trim();
      }
    }
  }

  if (config.overrideSettings) {
    for (const line of config.overrideSettings.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=');
        custom['override-settings'][key.trim()] = value.trim();
      }
    }
  }

  return custom;
}

export function buildExtrasJson(
  config: BuildConfig,
  genUrl: string,
  token?: string
): ExtrasJson {
  // Token API URL for MVP - use the same server as genUrl
  const tokenApiUrl = process.env.TOKEN_API_URL || genUrl;

  return {
    genurl: genUrl,
    urlLink: config.urlLink || 'https://rustdesk.com',
    downloadLink: config.downloadLink || 'https://rustdesk.com/download',
    delayFix: config.delayFix ? 'true' : 'false',
    version: config.version,
    rdgen: 'true',
    cycleMonitor: config.cycleMonitor ? 'true' : 'false',
    xOffline: config.xOffline ? 'true' : 'false',
    removeNewVersionNotif: config.removeNewVersionNotif ? 'true' : 'false',
    compname: config.companyName || 'Purslane Ltd',
    token,
    tokenApiUrl,  // MVP: Token authentication API URL
  };
}

export function buildWorkflowInputs(
  config: BuildConfig,
  uuid: string,
  genUrl: string,
  token?: string
): GitHubWorkflowInputs {
  const extras = buildExtrasJson(config, genUrl, token);


  // Build icon/logo/privacy links if provided
  let iconlink = 'false';
  let logolink = 'false';
  let privacylink = 'false';

  if (config.iconBase64) {
    iconlink = JSON.stringify({
      url: genUrl + '/api',
      uuid,
      file: 'icon.png',
    });
  }

  if (config.logoBase64) {
    logolink = JSON.stringify({
      url: genUrl + '/api',
      uuid,
      file: 'logo.png',
    });
  }

  if (config.privacyBase64) {
    privacylink = JSON.stringify({
      url: genUrl + '/api',
      uuid,
      file: 'privacy.png',
    });
  }

  return {
    server: config.host || 'rs-ny.rustdesk.com',
    key: config.key || 'OeVuKk5nlHiXp+APNn0Y3pC1Iwpwn44JGqrQCsWqmBw=',
    apiServer: config.apiServer || `https://${config.host || 'admin.rustdesk.com'}`,
    // Never sent as an input: Actions logs of this public repo are public. The
    // workflow fetches it from GET /api/build-config/:uuid (GitHub OIDC auth).
    custom: 'fetch',
    uuid,
    iconlink,
    logolink,
    privacylink,
    appname: config.appName || 'rustdesk',
    filename: config.filename || config.configName || 'rustdesk',
    extras: JSON.stringify(extras),
  };
}

export function getWorkflowName(platform: string): string {
  const workflowMap: Record<string, string> = {
    windows: 'generator-windows.yml',
    'windows-x86': 'generator-windows-x86.yml',
    linux: 'generator-linux.yml',
    android: 'generator-android.yml',
    macos: 'generator-macos.yml',
  };
  return workflowMap[platform] || 'generator-windows.yml';
}

// Base64 custom client JSON, served to the build workflow by /api/build-config/:uuid.
// RustDesk's read_custom_client() calls decode64() first, so it must stay base64.
export function buildCustomBase64(config: BuildConfig): string {
  return Buffer.from(JSON.stringify(buildCustomJson(config))).toString('base64');
}
