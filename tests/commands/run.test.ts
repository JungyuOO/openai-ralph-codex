import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
      "const [exitCode = '0', markerPath = '', markerText = '', stdoutText = '', stderrText = ''] = process.argv.slice(2);",
      "if (markerPath && markerPath !== '-') {",
      "  writeFileSync(markerPath, markerText || exitCode, 'utf8');",
      '}',
      "if (stdoutText && stdoutText !== '-') process.stdout.write(stdoutText);",
      "if (stderrText && stderrText !== '-') process.stderr.write(stderrText);",
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
    const verifyStdout = 'verify ok';
    const verifyStderr = 'verify warning';
    await seedRunFixture({
      runnerCode: 0,
      verificationCommands: [
        shellCommand(
          process.execPath,
          scriptPath,
          '0',
          verifyMarker,
          '-',
          verifyStdout,
          verifyStderr,
        ),
      ],
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
    expect(state.lastFailureKind).toBeNull();
    expect(state.lastFailureSummary).toBeNull();
    expect(state.loopSession.active).toBe(false);
    expect(progress).toContain('completed T001');
    expect(await fileExists(verifyMarker)).toBe(true);
    const evidence = await readEvidenceFiles('T001');
    expect(evidence['command-01/stdout.txt']).toBe(verifyStdout);
    expect(evidence['command-01/stderr.txt']).toBe(verifyStderr);
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
    expect(state.lastFailureKind).toBe('verification_failure');
    expect(state.lastFailureSummary).toContain('verification failed');
    expect(state.loopSession.active).toBe(true);
    expect(graph.tasks[0].lastFailure?.kind).toBe('verification_failure');
    expect(progress).toContain('retry queued for T001');
    expect(await fileExists(failedMarker)).toBe(true);
    expect(await fileExists(skippedMarker)).toBe(false);
    const evidence = await readEvidenceFiles('T001');
    expect(evidence['command-01/result.json']).toContain('"exitCode": 1');
    expect(evidence['command-02/result.json']).toBeUndefined();
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
    expect(state.lastFailureKind).toBe('code_bug');
    expect(state.lastFailureSummary).toContain('runner exit 1');
    expect(state.loopSession.active).toBe(true);
    expect(graph.tasks[0].lastFailure?.kind).toBe('code_bug');
    const failedSplitProposals = JSON.parse(await readFile(paths.splitProposals, 'utf8'));
    expect(failedSplitProposals.proposals[0].source).toBe('repeated-failure');
    expect(failedSplitProposals.proposals[0].taskId).toBe('T001');
    expect(state.nextAction).toContain('.ralph/split-proposals.json');
    expect(progress).toContain('failed T001 after 2 attempt(s)');
    expect(await fileExists(verifyMarker)).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  test('blocks broad work before launching the runner when it exceeds the context budget', async () => {
    await seedRunFixture({
      runnerCode: 0,
      verificationCommands: [],
      contextConfig: {
        max_estimated_load: 0.4,
        split_if_files_over: 2,
        split_if_cross_layer: true,
      },
      task: {
        contextFiles: [
          'src/commands/run.ts',
          'src/core/verify-runner.ts',
          'tests/commands/run.test.ts',
        ],
        estimatedLoad: 0.62,
        crossLayer: true,
        splitRecommended: true,
      },
    });

    await runRun({ cwd: tmp });

    const graph = await readGraph();
    const state = await readState();
    const progress = await readFile(paths.progress, 'utf8');

    expect(graph.tasks[0].status).toBe('blocked');
    expect(state.phase).toBe('blocked');
    expect(state.currentTask).toBe('T001');
    expect(state.lastStatus).toContain('blocked T001: 3 files exceed limit 2');
    expect(state.nextAction).toContain('re-run `ralph plan`');
    expect(state.lastFailureKind).toBe('context_overflow');
    expect(state.lastFailureSummary).toContain('3 files exceed limit 2');
    expect(state.loopSession.active).toBe(true);
    expect(graph.tasks[0].lastFailure?.kind).toBe('context_overflow');
    const contextSplitProposals = JSON.parse(await readFile(paths.splitProposals, 'utf8'));
    expect(contextSplitProposals.proposals[0].taskId).toBe('T001');
    expect(contextSplitProposals.proposals[0].source).toBe('context-budget');
    expect(contextSplitProposals.proposals[0].suggestions.length).toBeGreaterThan(1);
    expect(state.nextAction).toContain('.ralph/split-proposals.json');
    expect(progress).toContain('blocked T001 by context budget');
    await expect(access(path.join(paths.evidenceRoot, 'T001'))).rejects.toThrow();
    expect(process.exitCode).toBe(1);
  });

  test('uses task verification hints when config-level verification commands are empty', async () => {
    const verifyMarker = path.join(tmp, 'verify-hint.txt');
    await seedRunFixture({
      runnerCode: 0,
      verificationCommands: [],
      task: {
        verificationHints: {
          commands: [shellCommand(process.execPath, scriptPath, '0', verifyMarker)],
          notes: [],
        },
      },
    });

    await runRun({ cwd: tmp });

    const evidence = await readEvidenceFiles('T001');
    expect(evidence['command-01/result.json']).toContain('"exitCode": 0');
    expect(await fileExists(verifyMarker)).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });
});

interface RunFixtureInput {
  runnerCode: number;
  verificationCommands: string[];
  maxRetries?: number;
  initialRetryCount?: number;
  contextConfig?: {
    max_estimated_load?: number;
    split_if_files_over?: number;
    split_if_cross_layer?: boolean;
  };
  task?: {
    acceptanceCriteria?: string[];
    verificationHints?: {
      commands?: string[];
      notes?: string[];
    };
    contextFiles?: string[];
    estimatedLoad?: number;
    crossLayer?: boolean;
    splitRecommended?: boolean;
  };
}

async function seedRunFixture(input: RunFixtureInput): Promise<void> {
  const {
    runnerCode,
    verificationCommands,
    maxRetries = 1,
    initialRetryCount = 0,
    contextConfig,
    task,
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
      context: contextConfig,
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
            acceptanceCriteria: task?.acceptanceCriteria ?? ['Test task completes successfully'],
            verificationHints: {
              commands: task?.verificationHints?.commands ?? [],
              notes: task?.verificationHints?.notes ?? [],
            },
            dependsOn: [],
            status: 'pending',
            retryCount: initialRetryCount,
            contextFiles: task?.contextFiles ?? [],
            estimatedLoad: task?.estimatedLoad ?? 0,
            crossLayer: task?.crossLayer ?? false,
            splitRecommended: task?.splitRecommended ?? false,
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

async function readEvidenceFiles(taskId: string): Promise<Record<string, string>> {
  const taskRoot = path.join(paths.evidenceRoot, taskId);
  const sessions = await readdir(taskRoot);
  expect(sessions).toHaveLength(1);
  const sessionRoot = path.join(taskRoot, sessions[0]);
  const files: Record<string, string> = {};

  for (const commandDir of await readdir(sessionRoot)) {
    const commandRoot = path.join(sessionRoot, commandDir);
    for (const name of await readdir(commandRoot)) {
      files[`${commandDir}/${name}`] = await readFile(
        path.join(commandRoot, name),
        'utf8',
      );
    }
  }

  return files;
}
