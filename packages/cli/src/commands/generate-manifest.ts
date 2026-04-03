import { promises as fs } from 'fs';
import path from 'path';
import type { Command } from 'commander';

interface GenerateOptions {
  version?: string;
  artifactsDir?: string;
  notes?: string;
  notesFile?: string;
  baseUrl?: string;
  output?: string;
}

interface ManifestPlatformInfo {
  url: string;
}

interface Manifest {
  version: string;
  pub_date: string;
  notes: string;
  platforms: Record<string, ManifestPlatformInfo>;
}

async function detectVersion(cwd: string, explicit?: string): Promise<string> {
  if (explicit) return explicit;

  const tauriConfPath = path.join(cwd, 'tauri.conf.json');
  try {
    const raw = await fs.readFile(tauriConfPath, 'utf8');
    const json = JSON.parse(raw) as { package?: { version?: string } };
    if (json.package?.version) {
      return json.package.version;
    }
  } catch {
    // ignore
  }

  const cargoPath = path.join(cwd, 'Cargo.toml');
  try {
    const raw = await fs.readFile(cargoPath, 'utf8');
    const match = raw.match(/version\s*=\s*\"([^\"]+)\"/);
    if (match) {
      return match[1];
    }
  } catch {
    // ignore
  }

  throw new Error('Could not detect version. Use --version or configure tauri.conf.json/Cargo.toml.');
}

async function readNotes(cwd: string, opts: GenerateOptions): Promise<string> {
  if (opts.notes) return opts.notes;
  if (opts.notesFile) {
    const full = path.isAbsolute(opts.notesFile)
      ? opts.notesFile
      : path.join(cwd, opts.notesFile);
    return fs.readFile(full, 'utf8');
  }

  const changelog = path.join(cwd, 'CHANGELOG.md');
  try {
    return await fs.readFile(changelog, 'utf8');
  } catch {
    return 'Release notes not provided.';
  }
}

async function detectArtifacts(
  artifactsDir: string
): Promise<Array<{ platform: string; filename: string }>> {
  const entries: Array<{ platform: string; filename: string }> = [];

  async function walk(dir: string) {
    let items: fs.Dirent[];
    try {
      items = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile()) {
        const rel = full.replace(/\\/g, '/');
        const lower = rel.toLowerCase();
        if (lower.includes('/nsis/') && lower.endsWith('.exe')) {
          entries.push({ platform: 'windows-x86_64', filename: path.basename(rel) });
        } else if (lower.includes('/msi/') && lower.endsWith('.msi')) {
          entries.push({ platform: 'windows-x86_64', filename: path.basename(rel) });
        } else if (lower.includes('/dmg/') && lower.endsWith('.dmg')) {
          const name = path.basename(rel).toLowerCase();
          const platform = name.includes('arm64') || name.includes('aarch64')
            ? 'darwin-aarch64'
            : 'darwin-x86_64';
          entries.push({ platform, filename: path.basename(rel) });
        } else if (lower.includes('/appimage/') && lower.endsWith('.appimage')) {
          entries.push({ platform: 'linux-x86_64', filename: path.basename(rel) });
        } else if (lower.includes('/deb/') && lower.endsWith('.deb')) {
          entries.push({ platform: 'linux-x86_64', filename: path.basename(rel) });
        }
      }
    }
  }

  await walk(artifactsDir);
  return entries;
}

/**
 * Register the `generate-manifest` command.
 */
export function generateManifestCommand(program: Command): void {
  program
    .command('generate-manifest')
    .description('Generate update-manifest.json for tauri-easy-updater')
    .option('--version <version>', 'Version to use for the manifest')
    .option(
      '--artifacts-dir <dir>',
      'Directory containing Tauri artifacts',
      './src-tauri/target/release/bundle'
    )
    .option('--notes <text>', 'Release notes text')
    .option('--notes-file <path>', 'Path to a markdown file with release notes')
    .option('--base-url <url>', 'Base URL where artifacts will be hosted')
    .option('--output <path>', 'Output manifest path', './update-manifest.json')
    .action(async (opts: GenerateOptions) => {
      const cwd = process.cwd();
      const version = await detectVersion(cwd, opts.version);
      const notes = await readNotes(cwd, opts);

      if (!opts.baseUrl) {
        // eslint-disable-next-line no-console
        console.error('--base-url is required');
        process.exitCode = 1;
        return;
      }

      const artifactsDir = path.isAbsolute(opts.artifactsDir!)
        ? opts.artifactsDir!
        : path.join(cwd, opts.artifactsDir!);

      const detected = await detectArtifacts(artifactsDir);
      if (detected.length === 0) {
        // eslint-disable-next-line no-console
        console.warn('No artifacts detected in', artifactsDir);
      }

      const platforms: Manifest['platforms'] = {};
      for (const entry of detected) {
        const url = `${opts.baseUrl!.replace(/\/+$/, '')}/${entry.filename}`;
        platforms[entry.platform] = { url };
        // eslint-disable-next-line no-console
        console.log(`✓ Detected: ${entry.platform} → ${entry.filename}`);
      }

      const manifest: Manifest = {
        version,
        pub_date: new Date().toISOString(),
        notes,
        platforms
      };

      const outPath = path.isAbsolute(opts.output!)
        ? opts.output!
        : path.join(cwd, opts.output!);
      await fs.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      // eslint-disable-next-line no-console
      console.log(`✓ Generated: ${path.relative(cwd, outPath)}`);
    });
}

