import { Command } from 'commander';
import { initCommand } from './commands/init';
import { generateManifestCommand } from './commands/generate-manifest';
import { publishCommand } from './commands/publish';

const program = new Command();

program
  .name('tauri-eu')
  .description('CLI for tauri-easy-updater')
  .version('0.1.0');

initCommand(program);
generateManifestCommand(program);
publishCommand(program);

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

