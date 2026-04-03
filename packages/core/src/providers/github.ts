import type { UpdateManifest, UpdateProvider } from '../types';
import { getCurrentPlatform } from '../utils/platform';

export interface GitHubProviderConfig {
  owner: string;
  repo: string;
  manifestAssetName?: string;
  /**
   * If true, falls back to the GitHub Releases API when the manifest
   * asset is not found.
   * @default true
   */
  fallbackToReleaseApi?: boolean;
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  tag_name: string;
  published_at: string;
  body: string;
  assets: GitHubReleaseAsset[];
}

/**
 * Creates an update provider backed by GitHub Releases.
 *
 * It tries to download a manifest asset first and, if not found,
 * optionally falls back to the Releases API.
 */
export function createGitHubProvider(config: GitHubProviderConfig): UpdateProvider {
  const {
    owner,
    repo,
    manifestAssetName = 'update-manifest.json',
    fallbackToReleaseApi = true
  } = config;

  const manifestUrl = `https://github.com/${owner}/${repo}/releases/latest/download/${manifestAssetName}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const provider: UpdateProvider & {
    __tauriParams?: {
      github_owner: string;
      github_repo: string;
      manifest_url?: string;
    };
  } = {
    type: 'github',
    async fetchManifest(): Promise<UpdateManifest> {
      // First try manifest asset.
      try {
        const res = await fetch(manifestUrl);
        if (res.ok) {
          const data = (await res.json()) as UpdateManifest;
          return data;
        }
        if (!fallbackToReleaseApi || res.status !== 404) {
          throw new Error(`GitHub manifest request failed with status ${res.status}`);
        }
      } catch (err) {
        if (!fallbackToReleaseApi) {
          throw err instanceof Error ? err : new Error('Failed to fetch GitHub manifest');
        }
      }

      // Fallback to Releases API.
      try {
        const res = await fetch(apiUrl, {
          headers: {
            Accept: 'application/vnd.github+json'
          }
        });
        if (!res.ok) {
          throw new Error(`GitHub releases API failed with status ${res.status}`);
        }

        const release = (await res.json()) as GitHubReleaseResponse;
        const platform = await getCurrentPlatform();

        let url = '';
        if (platform) {
          const asset = selectAssetForPlatform(release.assets, platform);
          if (asset) {
            url = asset.browser_download_url;
          }
        }

        const manifest: UpdateManifest = {
          version: release.tag_name,
          pub_date: release.published_at,
          notes: release.body ?? '',
          platforms: url
            ? {
                [platform]: {
                  url
                }
              }
            : {}
        };

        return manifest;
      } catch (error) {
        throw error instanceof Error ? error : new Error('Failed to fetch GitHub release');
      }
    }
  };

  provider.__tauriParams = {
    github_owner: owner,
    github_repo: repo,
    manifest_url: manifestUrl
  };

  return provider;
}

function selectAssetForPlatform(
  assets: GitHubReleaseAsset[],
  platform: string
): GitHubReleaseAsset | undefined {
  if (!platform) return undefined;

  const lowerPlatform = platform.toLowerCase();

  return assets.find((asset) => {
    const name = asset.name.toLowerCase();
    if (lowerPlatform === 'windows-x86_64') {
      return name.endsWith('.exe') || name.endsWith('.msi');
    }
    if (lowerPlatform === 'darwin-x86_64') {
      return name.endsWith('.dmg') && !name.includes('arm64') && !name.includes('aarch64');
    }
    if (lowerPlatform === 'darwin-aarch64') {
      return name.endsWith('.dmg') && (name.includes('arm64') || name.includes('aarch64'));
    }
    if (lowerPlatform === 'linux-x86_64') {
      return (
        name.endsWith('.appimage') ||
        name.endsWith('.AppImage') ||
        name.endsWith('.deb') ||
        name.endsWith('.rpm')
      );
    }
    return false;
  });
}

