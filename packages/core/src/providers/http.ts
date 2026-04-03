import type { UpdateManifest, UpdateProvider } from '../types';

export interface HttpProviderConfig {
  manifestUrl: string;
  headers?: Record<string, string>;
}

/**
 * Creates a generic HTTP(S) update provider backed by a direct manifest URL.
 */
export function createHttpProvider(config: HttpProviderConfig): UpdateProvider {
  const { manifestUrl, headers } = config;

  const provider: UpdateProvider & {
    __tauriParams?: {
      manifest_url: string;
    };
  } = {
    type: 'http',
    async fetchManifest(): Promise<UpdateManifest> {
      const init: RequestInit = {
        method: 'GET',
        headers
      };

      try {
        const res = await fetch(manifestUrl, init);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as UpdateManifest;
        return data;
      } catch (error) {
        // Network or parsing errors should be surfaced to the caller,
        // but not crash the app; the hook will treat them as non-fatal.
        throw error instanceof Error ? error : new Error('Failed to fetch update manifest');
      }
    }
  };

  provider.__tauriParams = { manifest_url: manifestUrl };

  return provider;
}

