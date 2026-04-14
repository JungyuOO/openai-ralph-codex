import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = process.cwd();

describe('openai-ralph-codex plugin packaging', () => {
  test('ships a concrete plugin manifest with local skills', async () => {
    const pluginJson = JSON.parse(
      await readFile(
        path.join(
          repoRoot,
          'plugins',
          'openai-ralph-codex',
          '.codex-plugin',
          'plugin.json',
        ),
        'utf8',
      ),
    ) as {
      name: string;
      version: string;
      skills?: string;
      hooks?: string;
      interface: { displayName: string; defaultPrompt: string[] };
    };

    expect(pluginJson.name).toBe('openai-ralph-codex');
    expect(pluginJson.version).toBe('0.1.0');
    expect(pluginJson.skills).toBe('./skills/');
    expect(pluginJson.hooks).toBe('./hooks.json');
    expect(pluginJson.interface.displayName).toBe('OpenAI Ralph Codex');
    expect(pluginJson.interface.defaultPrompt).toHaveLength(3);
  });

  test('publishes a marketplace entry pointing at the local plugin path', async () => {
    const marketplaceJson = JSON.parse(
      await readFile(
        path.join(repoRoot, '.agents', 'plugins', 'marketplace.json'),
        'utf8',
      ),
    ) as {
      plugins: Array<{
        name: string;
        source: { path: string };
        policy: { installation: string; authentication: string };
      }>;
    };

    expect(marketplaceJson.plugins).toEqual([
      {
        name: 'openai-ralph-codex',
        source: {
          source: 'local',
          path: './plugins/openai-ralph-codex',
        },
        policy: {
          installation: 'AVAILABLE',
          authentication: 'ON_INSTALL',
        },
        category: 'Productivity',
      },
    ]);
  });

  test('ships hook registrations for session start, prompt submit, and post-write checks', async () => {
    const hooksJson = JSON.parse(
      await readFile(
        path.join(repoRoot, 'plugins', 'openai-ralph-codex', 'hooks.json'),
        'utf8',
      ),
    ) as {
      hooks: Record<string, unknown[]>;
    };

    expect(Object.keys(hooksJson.hooks)).toEqual([
      'SessionStart',
      'UserPromptSubmit',
      'PostToolUse',
    ]);
  });
});
