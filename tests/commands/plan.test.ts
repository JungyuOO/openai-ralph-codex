import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInit } from '../../src/commands/init.js';
import { runPlan } from '../../src/commands/plan.js';
import { StateSchema } from '../../src/schemas/state.js';
import { TaskGraphSchema } from '../../src/schemas/tasks.js';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-plan-'));
  await mkdir(path.join(tmp, '.ralph'), { recursive: true });
  await writeFile(
    path.join(tmp, '.ralph', 'config.example.yaml'),
    'version: 1\n',
    'utf8',
  );
  await writeFile(
    path.join(tmp, '.ralph', 'prd.example.md'),
    '# PRD\n\n## Acceptance Criteria\n- build the thing\n- test the thing\n- ship the thing\n',
    'utf8',
  );
  await writeFile(
    path.join(tmp, '.ralph', 'context-map.example.md'),
    '# Context Map\n',
    'utf8',
  );
  await runInit({ cwd: tmp });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('runPlan', () => {
  test('generates task graph from PRD acceptance criteria', async () => {
    await runPlan({ cwd: tmp });

    const graph = TaskGraphSchema.parse(
      JSON.parse(await readFile(path.join(tmp, '.ralph', 'tasks.json'), 'utf8')),
    );
    expect(graph.tasks.map((t) => t.title)).toEqual([
      'build the thing',
      'test the thing',
      'ship the thing',
    ]);
    expect(graph.tasks[0].id).toBe('T001');
    expect(graph.tasks.every((t) => t.status === 'pending')).toBe(true);
  });

  test('moves state to planned and sets currentTask to first task', async () => {
    await runPlan({ cwd: tmp });

    const state = StateSchema.parse(
      JSON.parse(await readFile(path.join(tmp, '.ralph', 'state.json'), 'utf8')),
    );
    expect(state.phase).toBe('planned');
    expect(state.currentTask).toBe('T001');
    expect(state.lastStatus).toContain('3');
  });

  test('appends a progress entry', async () => {
    await runPlan({ cwd: tmp });
    const progress = await readFile(
      path.join(tmp, '.ralph', 'progress.md'),
      'utf8',
    );
    expect(progress).toContain('plan generated (3 task(s))');
  });

  test('stores context budget metadata for broad tasks', async () => {
    await writeFile(
      path.join(tmp, '.ralph', 'config.yaml'),
      [
        'version: 1',
        'context:',
        '  max_estimated_load: 0.4',
        '  split_if_files_over: 2',
        '  split_if_cross_layer: true',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(tmp, '.ralph', 'prd.md'),
      [
        '# PRD',
        '',
        '## Acceptance Criteria',
        '- Update `src/commands/run.ts`, `src/core/verify-runner.ts`, and `tests/commands/run.test.ts`',
        '',
      ].join('\n'),
      'utf8',
    );

    await runPlan({ cwd: tmp });

    const graph = TaskGraphSchema.parse(
      JSON.parse(await readFile(path.join(tmp, '.ralph', 'tasks.json'), 'utf8')),
    );
    expect(graph.tasks[0].contextFiles).toEqual([
      'src/commands/run.ts',
      'src/core/verify-runner.ts',
      'tests/commands/run.test.ts',
    ]);
    expect(graph.tasks[0].splitRecommended).toBe(true);
    expect(graph.tasks[0].estimatedLoad).toBeGreaterThan(0.4);
  });
});
