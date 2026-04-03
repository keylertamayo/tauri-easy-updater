import type { UpdateManifest, UpdateProvider } from '../types';
import { createHttpProvider } from './http';

export interface S3ProviderConfig {
  bucketUrl: string;
  /**
   * Path to the manifest inside the bucket.
   * @default "latest/update-manifest.json"
   */
  manifestPath?: string;
}

/**
 * Creates a provider that resolves a manifest served from S3-like storage.
 */
export function createS3Provider(config: S3ProviderConfig): UpdateProvider {
  const { bucketUrl, manifestPath = 'latest/update-manifest.json' } = config;

  const manifestUrl = `${bucketUrl.replace(/\/+$/, '')}/${manifestPath.replace(/^\/+/, '')}`;

  const httpProvider = createHttpProvider({ manifestUrl });

  const provider: UpdateProvider & {
    __tauriParams?: {
      manifest_url: string;
    };
  } = {
    type: 's3',
    async fetchManifest(): Promise<UpdateManifest> {
      return httpProvider.fetchManifest();
    }
  };

  provider.__tauriParams = { manifest_url: manifestUrl };

  return provider;
}

