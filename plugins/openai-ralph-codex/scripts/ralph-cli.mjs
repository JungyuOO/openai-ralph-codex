import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const repoCliPath = path.join(packageRoot, 'dist', 'cli.js');

const command =
  process.env.RALPH_CLI_BIN ||
  (existsSync(repoCliPath) ? process.execPath : 'ralph');
const args =
  command === process.execPath
    ? [repoCliPath, ...process.argv.slice(2)]
    : process.argv.slice(2);
const cwd = existsSync(repoCliPath) ? packageRoot : process.cwd();

const child = spawn(command, args, {
  cwd,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  if (command !== process.execPath) {
    console.error(
      'Unable to find the `ralph` CLI. Install the package globally or build the repository first.',
    );
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
