import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runResume } from '../../src/commands/resume.js';
import { StateSchema } from '../../src/schemas/state.js';
import { TaskGraphSchema } from '../../src/schemas/tasks.js';
import { ralphPaths, type RalphPaths } from '../../src/utils/paths.js';

let tmp: string;
let paths: RalphPaths;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-resume-'));
  paths = ralphPaths(tmp);
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.progress, '# Progress\n\n', 'utf8');

  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await rm(tmp, { recursive: true, force: true });
});

describe('runResume', () => {
  test('resets retry budget for a blocked failed task and re-queues it', async () => {
    await seedResumeFixture({
      phase: 'blocked',
      taskStatus: 'failed',
      taskRetryCount: 2,
      stateRetryCount: 2,
    });

    await runResume({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();
    const progress = await readFile(paths.progress, 'utf8');

    expect(graph.tasks[0].status).toBe('pending');
    expect(graph.tasks[0].retryCount).toBe(0);
    expect(state.phase).toBe('running');
    expect(state.currentTask).toBe('T001');
    expect(state.retryCount).toBe(0);
    expect(state.lastStatus).toBe('resumed T001 after manual unblock');
    expect(state.nextAction).toContain('re-run `ralph run`');
    expect(progress).toContain('resumed T001 (manual unblock)');
    expect(process.exitCode).toBeUndefined();
  });

  test('re-queues an interrupted in-progress task without resetting retry count', async () => {
    await seedResumeFixture({
      phase: 'running',
      taskStatus: 'in_progress',
      taskRetryCount: 1,
      stateRetryCount: 1,
    });

    await runResume({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();

    expect(graph.tasks[0].status).toBe('pending');
    expect(graph.tasks[0].retryCount).toBe(1);
    expect(state.phase).toBe('running');
    expect(state.currentTask).toBe('T001');
    expect(state.retryCount).toBe(1);
    expect(state.lastStatus).toBe('re-queued T001 for resume');
    expect(process.exitCode).toBeUndefined();
  });

  test('fails when there is nothing resumable', async () => {
    await seedResumeFixture({
      phase: 'completed',
      taskStatus: 'done',
      taskRetryCount: 0,
      stateRetryCount: 0,
    });

    await runResume({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();

    expect(graph.tasks[0].status).toBe('done');
    expect(state.phase).toBe('completed');
    expect(process.exitCode).toBe(1);
  });
});

type ResumeFixtureInput = {
  phase: 'initialized' | 'planned' | 'running' | 'completed' | 'blocked';
  taskStatus: 'pending' | 'in_progress' | 'done' | 'blocked' | 'failed';
  taskRetryCount: number;
  stateRetryCount: number;
};

async function seedResumeFixture(input: ResumeFixtureInput): Promise<void> {
  await writeFile(
    paths.tasks,
    JSON.stringify(
      {
        version: 1,
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: '.ralph/prd.md',
        tasks: [
          {
            id: 'T001',
            title: 'Resume task',
            description: '',
            dependsOn: [],
            status: input.taskStatus,
            retryCount: input.taskRetryCount,
          },
        ],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  await writeFile(
    paths.state,
    JSON.stringify(
      {
        version: 1,
        phase: input.phase,
        currentTask: 'T001',
        lastStatus: `${input.phase} T001`,
        retryCount: input.stateRetryCount,
        nextAction: 'test resume',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}

async function readGraph() {
  return TaskGraphSchema.parse(
    JSON.parse(await readFile(paths.tasks, 'utf8')),
  );
}

async function readState() {
  return StateSchema.parse(JSON.parse(await readFile(paths.state, 'utf8')));
}
