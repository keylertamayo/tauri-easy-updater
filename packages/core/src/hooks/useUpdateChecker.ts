import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UpdaterConfig, UpdateInfo, UpdateProvider } from '../types';

type CheckUpdateParams = {
  current_version: string;
  manifest_url: string;
  github_owner?: string | null;
  github_repo?: string | null;
};

const SESSION_DISMISS_KEY = 'tauri-easy-updater:dismissed-version';

function getDismissedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY);
  } catch {
    return null;
  }
}

function setDismissedVersion(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, version);
  } catch {
    // ignore
  }
}

function buildParamsFromProvider(
  provider: UpdateProvider,
  currentVersion: string
): CheckUpdateParams | null {
  const anyProvider = provider as UpdateProvider & {
    __tauriParams?: {
      manifest_url?: string;
      github_owner?: string;
      github_repo?: string;
    };
  };

  const base: CheckUpdateParams = {
    current_version: currentVersion,
    manifest_url: ''
  };

  if (!anyProvider.__tauriParams) {
    return null;
  }

  const { manifest_url, github_owner, github_repo } = anyProvider.__tauriParams;

  if (github_owner && github_repo) {
    return {
      ...base,
      manifest_url: manifest_url ?? '',
      github_owner,
      github_repo
    };
  }

  if (manifest_url) {
    return {
      ...base,
      manifest_url,
      github_owner: null,
      github_repo: null
    };
  }

  return null;
}

/**
 * React hook that checks for updates using the configured provider and the Tauri plugin.
 */
export function useUpdateChecker(config: UpdaterConfig): {
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  error: Error | null;
  checkNow: () => Promise<void>;
  dismiss: () => void;
  isDismissed: boolean;
} {
  const {
    currentVersion,
    provider,
    checkOnStartup = true,
    checkIntervalMs = 0,
    silent = false
  } = config;

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const dismissed = getDismissedVersion();
    if (dismissed) {
      setIsDismissed(true);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null && typeof window !== 'undefined') {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const canUseTauri = typeof window !== 'undefined';

  const checkNow = useCallback(async () => {
    if (!canUseTauri) {
      return;
    }

    const params = buildParamsFromProvider(provider, currentVersion);
    if (!params) {
      // Fallback to pure JS provider logic when we cannot build plugin params.
      try {
        setIsChecking(true);
        setError(null);
        const manifest = await provider.fetchManifest();
        const platformInfo = Object.values(manifest.platforms)[0];
        if (!platformInfo) {
          if (!silent) {
            setError(new Error('No platform information in manifest'));
          }
          setUpdateInfo(null);
          return;
        }
        const info: UpdateInfo = {
          hasUpdate: true,
          currentVersion,
          latestVersion: manifest.version,
          downloadUrl: platformInfo.url,
          releaseNotes: manifest.notes,
          pubDate: manifest.pub_date
        };
        if (!mountedRef.current) return;
        setUpdateInfo(info);
      } catch (e) {
        if (!mountedRef.current) return;
        if (!silent) {
          setError(e instanceof Error ? e : new Error('Failed to check for updates'));
        }
      } finally {
        if (mountedRef.current) {
          setIsChecking(false);
        }
      }
      return;
    }

    try {
      setIsChecking(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/tauri');
      const result = (await invoke('plugin:easy-updater|check_update', {
        params
      })) as UpdateInfo;

      if (!mountedRef.current) return;

      // Do not show if user has dismissed this version in this session.
      const dismissed = getDismissedVersion();
      if (dismissed && dismissed === result.latestVersion) {
        setIsDismissed(true);
        setUpdateInfo(result);
        return;
      }

      setUpdateInfo(result);
    } catch (e) {
      if (!mountedRef.current) return;
      if (!silent) {
        setError(e instanceof Error ? e : new Error('Failed to check for updates'));
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [canUseTauri, provider, currentVersion, silent]);

  useEffect(() => {
    if (!checkOnStartup) {
      return;
    }
    void checkNow();
  }, [checkOnStartup, checkNow]);

  useEffect(() => {
    if (checkIntervalMs <= 0 || typeof window === 'undefined') {
      return;
    }

    const id = window.setInterval(() => {
      void checkNow();
    }, checkIntervalMs);
    intervalRef.current = id;

    return () => {
      window.clearInterval(id);
    };
  }, [checkIntervalMs, checkNow]);

  const dismiss = useCallback(() => {
    if (updateInfo) {
      setDismissedVersion(updateInfo.latestVersion);
    }
    setIsDismissed(true);
  }, [updateInfo]);

  const value = useMemo(
    () => ({
      updateInfo,
      isChecking,
      error,
      checkNow,
      dismiss,
      isDismissed
    }),
    [updateInfo, isChecking, error, checkNow, dismiss, isDismissed]
  );

  return value;
}

