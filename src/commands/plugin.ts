import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exists, readJson } from '../utils/fs.js';

export interface PluginCommandOptions {
  cwd?: string;
}

export async function runPluginInstall(
  options: PluginCommandOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const scriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../scripts/install-home-plugin.mjs',
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`plugin install exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

export async function runPluginStatus(): Promise<void> {
  const home = os.homedir();
  const pluginDir = path.join(home, 'plugins', 'openai-ralph-codex');
  const marketplacePath = path.join(home, '.agents', 'plugins', 'marketplace.json');
  const hooksPath = path.join(home, '.codex', 'hooks.json');

  console.log('Ralph plugin status');
  console.log(`  plugin dir:    ${pluginDir}`);
  console.log(`  installed:     ${(await exists(pluginDir)) ? 'yes' : 'no'}`);
  console.log(`  marketplace:   ${marketplacePath}`);
  console.log(`  codex hooks:   ${hooksPath}`);

  if (!(await exists(marketplacePath))) {
    console.log('  available:     no marketplace file found');
    return;
  }

  const marketplace = await readJson<{
    plugins?: Array<{ name: string; policy?: { installation?: string } }>;
  }>(marketplacePath);
  const entry = marketplace.plugins?.find(
    (plugin) => plugin.name === 'openai-ralph-codex',
  );

  if (!entry) {
    console.log('  available:     marketplace entry missing');
    return;
  }

  console.log('  available:     yes');
  console.log(
    `  installation:  ${entry.policy?.installation ?? '(unknown)'}`,
  );

  if (!(await exists(hooksPath))) {
    console.log('  hooks active:  no hooks.json found');
    return;
  }

  const hooks = await readJson<{
    hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
  }>(hooksPath);
  const active = Object.values(hooks.hooks ?? {}).some((entries) =>
    entries.some((entry) =>
      entry.hooks?.some((hook) => hook.command?.includes('ralph-hook.mjs')),
    ),
  );
  console.log(`  hooks active:  ${active ? 'yes' : 'no'}`);
}
