import { promises as fs } from 'fs';
import path from 'path';
import type { Command } from 'commander';
import https from 'https';
import { URL } from 'url';

interface PublishOptions {
  manifest?: string;
  token?: string;
  tag?: string;
  repo?: string;
}

interface UpdaterConfigGitHub {
  github?: {
    owner?: string;
    repo?: string;
  };
}

interface ManifestFile {
  version: string;
}

function readJson<T>(filePath: string): Promise<T> {
  return fs.readFile(filePath, 'utf8').then((t) => JSON.parse(t) as T);
}

async function resolveRepo(cwd: string, explicit?: string): Promise<{ owner: string; repo: string }> {
  if (explicit) {
    const [owner, repo] = explicit.split('/');
    if (!owner || !repo) {
      throw new Error('--repo must be in the form owner/repo');
    }
    return { owner, repo };
  }

  const updaterPath = path.join(cwd, 'updater.config.json');
  const conf = await readJson<UpdaterConfigGitHub>(updaterPath).catch(() => null);
  if (conf?.github?.owner && conf.github.repo) {
    return { owner: conf.github.owner, repo: conf.github.repo };
  }

  throw new Error('Repository not specified. Use --repo or configure updater.config.json');
}

async function resolveTag(cwd: string, manifestPath: string, explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const manifest = await readJson<ManifestFile>(manifestPath);
  return `v${manifest.version}`;
}

function githubRequest<T>(
  token: string,
  method: string,
  urlStr: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const urlObj = new URL(urlStr);

  const headers: Record<string, string> = {
    'User-Agent': 'tauri-easy-updater-cli',
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    ...extraHeaders
  };

  const options: https.RequestOptions = {
    method,
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    headers
  };

  return new Promise<T>((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          if (!text) {
            resolve({} as T);
            return;
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(
            new Error(
              `GitHub API ${method} ${urlStr} failed with status ${res.statusCode}: ${text}`
            )
          );
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body !== undefined) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }

    req.end();
  });
}

async function uploadAsset(
  token: string,
  owner: string,
  repo: string,
  releaseId: number,
  name: string,
  content: Buffer
): Promise<void> {
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(
    name
  )}`;

  const urlObj = new URL(uploadUrl);

  const options: https.RequestOptions = {
    method: 'POST',
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    headers: {
      'User-Agent': 'tauri-easy-updater-cli',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': content.length.toString()
    }
  };

  await new Promise<void>((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          const text = Buffer.concat(chunks).toString('utf8');
          reject(
            new Error(
              `GitHub asset upload failed with status ${res.statusCode}: ${text}`
            )
          );
        }
      });
    });

    req.on('error', (err) => reject(err));

    req.write(content);
    req.end();
  });
}

/**
 * Register the `publish` command.
 */
export function publishCommand(program: Command): void {
  program
    .command('publish')
    .description('Upload update manifest as a GitHub Release asset')
    .option('--manifest <path>', 'Path to manifest JSON', './update-manifest.json')
    .option('--token <token>', 'GitHub token (or use GITHUB_TOKEN env)')
    .option('--tag <tag>', 'Git tag for the release (defaults to v{version})')
    .option('--repo <owner/repo>', 'GitHub repo (owner/repo)')
    .action(async (opts: PublishOptions) => {
      const cwd = process.cwd();
      const manifestPath = path.isAbsolute(opts.manifest!)
        ? opts.manifest!
        : path.join(cwd, opts.manifest!);

      const token = opts.token || process.env.GITHUB_TOKEN;
      if (!token) {
        // eslint-disable-next-line no-console
        console.error('GitHub token is required (--token or GITHUB_TOKEN env)');
        process.exitCode = 1;
        return;
      }

      const { owner, repo } = await resolveRepo(cwd, opts.repo);
      const tag = await resolveTag(cwd, manifestPath, opts.tag);

      // Get release by tag
      const release = await githubRequest<{ id: number }>(
        token,
        'GET',
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`
      );

      const content = await fs.readFile(manifestPath);
      const assetName = path.basename(manifestPath);

      await uploadAsset(token, owner, repo, release.id, assetName, content);

      // eslint-disable-next-line no-console
      console.log(
        `✓ Uploaded ${assetName} to release ${tag} in ${owner}/${repo}`
      );
    });
}

