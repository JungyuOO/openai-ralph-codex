import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runStatus } from '../../src/commands/status.js';
import { ralphPaths, type RalphPaths } from '../../src/utils/paths.js';

let tmp: string;
let paths: RalphPaths;
let logs: string[];
let errors: string[];

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-status-'));
  paths = ralphPaths(tmp);
  logs = [];
  errors = [];
  await mkdir(paths.root, { recursive: true });

  vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await rm(tmp, { recursive: true, force: true });
});

describe('runStatus', () => {
  test('prints current task context details and blocked hint', async () => {
    await writeFile(
      paths.state,
      JSON.stringify(
        {
          version: 1,
          phase: 'blocked',
          currentTask: 'T001',
          lastStatus: 'blocked T001: 3 files exceed limit 2',
          retryCount: 0,
          lastFailureKind: 'context_overflow',
          lastFailureSummary: '3 files exceed limit 2',
          loopSession: {
            active: true,
            enteredAt: '2026-01-01T00:00:00.000Z',
            lastRoutedAt: '2026-01-01T00:00:00.000Z',
            lastPromptHash: 'deadbeef',
            lastStage: 'resume',
            lastDecisionReason: 'continuing the existing Ralph loop',
            lastTaskId: 'T001',
            routingMode: 'latched',
          },
          nextAction:
            'split T001 in .ralph/prd.md or relax context limits in .ralph/config.yaml, then re-run `ralph plan`',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        null,
        2,
      ) + '\n',
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
              title: 'Broad task',
              description: '',
              dependsOn: [],
              status: 'blocked',
              retryCount: 0,
              contextFiles: [
                'src/commands/run.ts',
                'src/core/scheduler.ts',
                'tests/commands/run.test.ts',
              ],
              estimatedLoad: 0.62,
              crossLayer: true,
              splitRecommended: true,
            },
          ],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    await runStatus({ cwd: tmp });

    const output = logs.join('\n');
    expect(output).toContain('Ralph status');
    expect(output).toContain('Current task details');
    expect(output).toContain('split this task before continuing');
    expect(output).toContain('The current task is blocked by the context budget.');
    expect(output).toContain('last failure:  3 files exceed limit 2');
    expect(output).toContain('loop session:  active (latched, stage=resume)');
    expect(errors).toEqual([]);
  });

  test('fails when state is missing', async () => {
    await runStatus({ cwd: tmp });

    expect(errors.join('\n')).toContain('Ralph project not initialized.');
    expect(process.exitCode).toBe(1);
  });
});
