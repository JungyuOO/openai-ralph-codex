import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';
import { runRun } from '../../src/commands/run.js';
import { StateSchema } from '../../src/schemas/state.js';
import { TaskGraphSchema } from '../../src/schemas/tasks.js';
import { ralphPaths, type RalphPaths } from '../../src/utils/paths.js';

let tmp: string;
let paths: RalphPaths;
let scriptPath: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-run-'));
  paths = ralphPaths(tmp);
  scriptPath = path.join(tmp, 'exit-with-marker.mjs');

  await mkdir(paths.root, { recursive: true });
  await writeFile(
    scriptPath,
    [
      "import { writeFileSync } from 'node:fs';",
      "const [exitCode = '0', markerPath = '', markerText = ''] = process.argv.slice(2);",
      "if (markerPath && markerPath !== '-') {",
      "  writeFileSync(markerPath, markerText || exitCode, 'utf8');",
      '}',
      'process.exit(Number(exitCode));',
      '',
    ].join('\n'),
    'utf8',
  );
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

describe('runRun', () => {
  test('marks a task done only after runner and verification both succeed', async () => {
    const verifyMarker = path.join(tmp, 'verify-ok.txt');
    await seedRunFixture({
      runnerCode: 0,
      verificationCommands: [shellCommand(process.execPath, scriptPath, '0', verifyMarker)],
    });

    await runRun({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();
    const progress = await readFile(paths.progress, 'utf8');

    expect(graph.tasks[0].status).toBe('done');
    expect(graph.tasks[0].retryCount).toBe(0);
    expect(state.phase).toBe('completed');
    expect(state.currentTask).toBeNull();
    expect(state.lastStatus).toBe('completed T001');
    expect(state.nextAction).toBe('all tasks done');
    expect(progress).toContain('completed T001');
    expect(await fileExists(verifyMarker)).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  test('queues a retry when verification fails and skips later verification commands', async () => {
    const failedMarker = path.join(tmp, 'verify-fail.txt');
    const skippedMarker = path.join(tmp, 'verify-skipped.txt');
    await seedRunFixture({
      runnerCode: 0,
      verificationCommands: [
        shellCommand(process.execPath, scriptPath, '1', failedMarker),
        shellCommand(process.execPath, scriptPath, '0', skippedMarker),
      ],
      maxRetries: 2,
    });

    await runRun({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();
    const progress = await readFile(paths.progress, 'utf8');

    expect(graph.tasks[0].status).toBe('pending');
    expect(graph.tasks[0].retryCount).toBe(1);
    expect(state.phase).toBe('running');
    expect(state.currentTask).toBe('T001');
    expect(state.retryCount).toBe(1);
    expect(state.lastStatus).toContain('retry 1/2');
    expect(state.nextAction).toContain('re-run `ralph run`');
    expect(progress).toContain('retry queued for T001');
    expect(await fileExists(failedMarker)).toBe(true);
    expect(await fileExists(skippedMarker)).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  test('blocks the task after the retry budget is exhausted on runner failure', async () => {
    const verifyMarker = path.join(tmp, 'verify-never-runs.txt');
    await seedRunFixture({
      runnerCode: 1,
      verificationCommands: [shellCommand(process.execPath, scriptPath, '0', verifyMarker)],
      maxRetries: 1,
      initialRetryCount: 1,
    });

    await runRun({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();
    const progress = await readFile(paths.progress, 'utf8');

    expect(graph.tasks[0].status).toBe('failed');
    expect(graph.tasks[0].retryCount).toBe(2);
    expect(state.phase).toBe('blocked');
    expect(state.currentTask).toBe('T001');
    expect(state.retryCount).toBe(2);
    expect(state.lastStatus).toContain('failed T001: runner exit 1');
    expect(state.nextAction).toContain('recovery policy exhausted (2 attempts)');
    expect(progress).toContain('failed T001 after 2 attempt(s)');
    expect(await fileExists(verifyMarker)).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});

interface RunFixtureInput {
  runnerCode: number;
  verificationCommands: string[];
  maxRetries?: number;
  initialRetryCount?: number;
}

async function seedRunFixture(input: RunFixtureInput): Promise<void> {
  const {
    runnerCode,
    verificationCommands,
    maxRetries = 1,
    initialRetryCount = 0,
  } = input;

  await writeFile(
    paths.config,
    stringifyYaml({
      version: 1,
      runner: {
        command: process.execPath,
        args: [scriptPath, String(runnerCode)],
      },
      verification: {
        commands: verificationCommands,
      },
      recovery: {
        max_retries_per_task: maxRetries,
      },
    }),
    'utf8',
  );

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
            title: 'Test task',
            description: '',
            dependsOn: [],
            status: 'pending',
            retryCount: initialRetryCount,
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
        phase: 'planned',
        currentTask: 'T001',
        lastStatus: 'planned 1 task(s)',
        retryCount: initialRetryCount,
        nextAction: 'start task T001: Test task',
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

function shellCommand(...parts: string[]): string {
  return parts.map((part) => `"${part}"`).join(' ');
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
