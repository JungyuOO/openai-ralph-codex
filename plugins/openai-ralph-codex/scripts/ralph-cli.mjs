import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const repoCliPath = path.join(packageRoot, 'dist', 'cli.js');
const projectRoot = process.env.RALPH_PROJECT_ROOT || process.cwd();

const command =
  process.env.RALPH_CLI_BIN ||
  (existsSync(repoCliPath)
    ? process.execPath
    : process.platform === 'win32'
      ? 'ralph.cmd'
      : 'ralph');
const args =
  command === process.execPath
    ? [repoCliPath, ...process.argv.slice(2)]
    : process.argv.slice(2);

const useShell = process.platform === 'win32' && command.endsWith('.cmd');
const child = spawn(
  useShell ? buildShellCommand(command, args) : command,
  useShell ? [] : args,
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: useShell,
  },
);

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

function buildShellCommand(cmd, parts) {
  return [cmd, ...parts].map(quoteForShell).join(' ');
}

function quoteForShell(value) {
  if (/^[A-Za-z0-9_./:\\=-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}
