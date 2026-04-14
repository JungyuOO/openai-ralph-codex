import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    'tests/runners/codex-cli.smoke.test.ts',
  ],
  {
    stdio: 'inherit',
    shell: false,
    cwd: root,
    env: {
      ...process.env,
      RUN_CODEX_SMOKE: '1',
    },
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
