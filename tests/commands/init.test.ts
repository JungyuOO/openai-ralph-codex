import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInit } from '../../src/commands/init.js';
import { StateSchema } from '../../src/schemas/state.js';
import { TaskGraphSchema } from '../../src/schemas/tasks.js';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-init-'));
  await mkdir(path.join(tmp, '.ralph'), { recursive: true });
  await writeFile(
    path.join(tmp, '.ralph', 'config.example.yaml'),
    'version: 1\nrunner:\n  type: codex-cli\n  command: codex\n',
    'utf8',
  );
  await writeFile(
    path.join(tmp, '.ralph', 'prd.example.md'),
    '# PRD\n\n## Acceptance Criteria\n- foo\n- bar\n',
    'utf8',
  );
  await writeFile(
    path.join(tmp, '.ralph', 'context-map.example.md'),
    '# Context Map\n',
    'utf8',
  );
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('runInit', () => {
  test('creates all working files from templates', async () => {
    await runInit({ cwd: tmp });

    const config = await readFile(path.join(tmp, '.ralph', 'config.yaml'), 'utf8');
    expect(config).toContain('version: 1');

    const prd = await readFile(path.join(tmp, '.ralph', 'prd.md'), 'utf8');
    expect(prd).toContain('Acceptance Criteria');

    const state = StateSchema.parse(
      JSON.parse(await readFile(path.join(tmp, '.ralph', 'state.json'), 'utf8')),
    );
    expect(state.phase).toBe('initialized');
    expect(state.currentTask).toBeNull();

    const graph = TaskGraphSchema.parse(
      JSON.parse(await readFile(path.join(tmp, '.ralph', 'tasks.json'), 'utf8')),
    );
    expect(graph.tasks).toEqual([]);

    const progress = await readFile(path.join(tmp, '.ralph', 'progress.md'), 'utf8');
    expect(progress).toContain('project initialized');
  });

  test('is idempotent: does not overwrite existing working files', async () => {
    await runInit({ cwd: tmp });

    const customState = '{"custom":true}';
    await writeFile(path.join(tmp, '.ralph', 'state.json'), customState, 'utf8');
    const customConfig = 'custom: true\n';
    await writeFile(path.join(tmp, '.ralph', 'config.yaml'), customConfig, 'utf8');

    await runInit({ cwd: tmp });

    expect(
      await readFile(path.join(tmp, '.ralph', 'state.json'), 'utf8'),
    ).toBe(customState);
    expect(
      await readFile(path.join(tmp, '.ralph', 'config.yaml'), 'utf8'),
    ).toBe(customConfig);
  });
});
