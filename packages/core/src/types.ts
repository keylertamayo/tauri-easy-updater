/**
 * Manifest structure used by the updater.
 */
export interface UpdateManifest {
  version: string;
  pub_date: string;
  notes: string;
  platforms: {
    [platform: string]: {
      url: string;
    };
  };
}

/**
 * Information about an available update exposed to the UI.
 */
export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  pubDate: string;
}

/**
 * Provider interface used by the updater hook.
 */
export interface UpdateProvider {
  type: 'github' | 'http' | 's3';
  fetchManifest(): Promise<UpdateManifest>;
}

/**
 * Configuration options for the update checker hook.
 */
export interface UpdaterConfig {
  currentVersion: string;
  provider: UpdateProvider;
  /**
   * Whether to check for updates on startup.
   * @default true
   */
  checkOnStartup?: boolean;
  /**
   * Interval in milliseconds between automatic checks.
   * `0` means only check on startup or when `checkNow` is called.
   * @default 0
   */
  checkIntervalMs?: number;
  /**
   * When true, suppresses UI-driven side effects from errors.
   * Errors are still exposed via the hook return value.
   * @default false
   */
  silent?: boolean;
}

