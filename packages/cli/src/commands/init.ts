import { promises as fs } from 'fs';
import path from 'path';
import type { Command } from 'commander';
import prompts from 'prompts';

interface TauriConfig {
  package?: {
    productName?: string;
    version?: string;
  };
}

interface UpdaterConfig {
  provider: 'github';
  github: {
    owner: string;
    repo: string;
  };
  manifestFileName: string;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Register the `init` command.
 */
export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize updater.config.json for tauri-easy-updater')
    .action(async () => {
      const cwd = process.cwd();
      const tauriConfPath = path.join(cwd, 'tauri.conf.json');

      const tauriConf = await readJsonIfExists<TauriConfig>(tauriConfPath);
      if (!tauriConf) {
        // eslint-disable-next-line no-console
        console.error('tauri.conf.json not found in current directory.');
      }

      const appName = tauriConf?.package?.productName ?? '';
      const version = tauriConf?.package?.version ?? '';

      // eslint-disable-next-line no-console
      console.log(`Detected appName="${appName}" version="${version}" (if available).`);

      const response = await prompts([
        {
          type: 'text',
          name: 'owner',
          message: 'GitHub owner:',
          validate: (value: string) => (value.trim() ? true : 'Owner is required')
        },
        {
          type: 'text',
          name: 'repo',
          message: 'GitHub repository name:',
          validate: (value: string) => (value.trim() ? true : 'Repository is required')
        }
      ]);

      if (!response.owner || !response.repo) {
        // eslint-disable-next-line no-console
        console.error('Initialization cancelled.');
        return;
      }

      const updaterConfigPath = path.join(cwd, 'updater.config.json');
      const existing = await readJsonIfExists<UpdaterConfig>(updaterConfigPath);

      const newConfig: UpdaterConfig = {
        provider: 'github',
        github: {
          owner: response.owner,
          repo: response.repo
        },
        manifestFileName: existing?.manifestFileName ?? 'update-manifest.json'
      };

      await fs.writeFile(updaterConfigPath, `${JSON.stringify(newConfig, null, 2)}\n`, 'utf8');

      // eslint-disable-next-line no-console
      console.log(`Created ${path.relative(cwd, updaterConfigPath)}`);
    });
}

