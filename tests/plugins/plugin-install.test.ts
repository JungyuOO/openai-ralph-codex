import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let tmpHome: string;
let installerModule: {
  installHomePlugin: (options?: {
    homeDir?: string;
    installation?: string;
    authentication?: string;
    category?: string;
  }) => Promise<{
    targetPluginDir: string;
    marketplacePath: string;
    marketplaceEntry: { policy: { installation: string } };
  }>;
  shouldAutoInstall: (env?: Record<string, string | undefined>) => boolean;
};

beforeEach(async () => {
  tmpHome = await mkdtemp(path.join(os.tmpdir(), 'ralph-plugin-home-'));
  installerModule = (await import(
    '../../scripts/install-home-plugin.mjs'
  )) as unknown as typeof installerModule;
});

afterEach(async () => {
  await rm(tmpHome, { recursive: true, force: true });
});

describe('home plugin installer', () => {
  test('copies the plugin and writes an installed-by-default marketplace entry', async () => {
    const result = await installerModule.installHomePlugin({ homeDir: tmpHome });

    const marketplace = JSON.parse(
      await readFile(result.marketplacePath, 'utf8'),
    ) as {
      plugins: Array<{ name: string; policy: { installation: string } }>;
    };

    expect(result.marketplaceEntry.policy.installation).toBe(
      'INSTALLED_BY_DEFAULT',
    );
    expect(marketplace.plugins[0].name).toBe('openai-ralph-codex');
    expect(marketplace.plugins[0].policy.installation).toBe(
      'INSTALLED_BY_DEFAULT',
    );
  });

  test('auto-installs only on global npm installs unless overridden', () => {
    expect(installerModule.shouldAutoInstall({ npm_config_global: 'true' })).toBe(
      true,
    );
    expect(installerModule.shouldAutoInstall({ npm_config_global: 'false' })).toBe(
      false,
    );
    expect(
      installerModule.shouldAutoInstall({
        npm_config_global: 'false',
        RALPH_FORCE_PLUGIN_AUTO_INSTALL: '1',
      }),
    ).toBe(true);
  });
});
