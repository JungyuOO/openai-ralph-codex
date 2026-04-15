import { describe, expect, test } from 'vitest';
import { buildPromptPack, selectPromptMode } from '../../src/core/prompt-pack.js';

describe('buildPromptPack', () => {
  test('builds a task-only contract with compact scope and rules', () => {
    const pack = buildPromptPack({
      id: 'T001',
      title: 'Implement the scheduler update',
      description: 'Update the scheduler to prefer narrower runnable tasks first.',
      acceptanceCriteria: ['Scheduler picks the narrowest runnable task first.'],
      verificationHints: {
        commands: ['npm test'],
        notes: ['Confirm the scheduler behavior with a focused regression test.'],
      },
      contextFiles: ['src/core/scheduler.ts', 'tests/core/scheduler.test.ts'],
      estimatedLoad: 0.34,
      crossLayer: false,
      splitRecommended: false,
      lastFailure: null,
    });

    expect(pack.prompt).toContain('[TASK]');
    expect(pack.prompt).toContain('[ACCEPTANCE_CRITERIA]');
    expect(pack.prompt).toContain('Scheduler picks the narrowest runnable task first.');
    expect(pack.prompt).toContain('[VERIFICATION_HINTS]');
    expect(pack.prompt).toContain('command: npm test');
    expect(pack.prompt).toContain('primary_files: src/core/scheduler.ts, tests/core/scheduler.test.ts');
    expect(pack.prompt).toContain('[EXECUTION_RULES]');
    expect(pack.prompt).not.toContain('[RECENT_FAILURE]');
    expect(pack.stableRules).toHaveLength(5);
    expect(pack.mode).toBe('balanced');
  });

  test('includes recent failure context without replaying raw logs', () => {
    const pack = buildPromptPack({
      id: 'T002',
      title: 'Fix verification failure',
      description: '',
      acceptanceCriteria: ['The verification command passes cleanly.'],
      verificationHints: {
        commands: ['npm test'],
        notes: [],
      },
      contextFiles: ['src/commands/run.ts'],
      estimatedLoad: 0.21,
      crossLayer: false,
      splitRecommended: false,
      lastFailure: {
        kind: 'verification_failure',
        source: 'verification',
        summary: 'verification failed: npm test; first error: Expected true to be false',
        failedCommand: 'npm test',
        exitCode: 1,
        firstErrorLine: 'Expected true to be false',
        evidencePath: '.ralph/evidence/T002/2026-01-01T00-00-00-000Z',
      },
    });

    expect(pack.prompt).toContain('[RECENT_FAILURE]');
    expect(pack.prompt).toContain('kind: verification_failure');
    expect(pack.prompt).toContain('first_error: Expected true to be false');
    expect(pack.prompt).not.toContain('stderr.txt');
    expect(pack.mode).toBe('recovery');
  });

  test('includes distilled memory when provided', () => {
    const pack = buildPromptPack(
      {
        id: 'T003',
        title: 'Keep loop prompts compact',
        description: '',
        acceptanceCriteria: ['Prompts remain task-local.'],
        verificationHints: { commands: [], notes: [] },
        contextFiles: [],
        estimatedLoad: 0.1,
        crossLayer: false,
        splitRecommended: false,
        lastFailure: null,
      },
      {
        distilledMemory: ['[success] T001 completed touching src/core/scheduler.ts.'],
      },
    );

    expect(pack.prompt).toContain('[DISTILLED_MEMORY]');
    expect(pack.prompt).toContain('memory: [success] T001 completed touching src/core/scheduler.ts.');
    expect(pack.mode).toBe('balanced');
  });

  test('applies small-mode trimming for simple clean tasks', () => {
    const pack = buildPromptPack(
      {
        id: 'T004',
        title: 'Tighten a small helper',
        description: '',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        verificationHints: {
          commands: ['npm test', 'npm run typecheck'],
          notes: [],
        },
        contextFiles: ['src/core/prompt-pack.ts'],
        estimatedLoad: 0.18,
        crossLayer: false,
        splitRecommended: false,
        lastFailure: null,
      },
      {
        distilledMemory: [],
      },
    );

    expect(pack.mode).toBe('small');
    expect(pack.prompt).toContain('prompt_mode: small');
    expect(pack.prompt).toContain('Criterion 1');
    expect(pack.prompt).not.toContain('Criterion 2');
    expect(pack.prompt).toContain('command: npm test');
    expect(pack.prompt).not.toContain('[DISTILLED_MEMORY]');
  });

  test('keeps balanced caps for medium tasks', () => {
    const pack = buildPromptPack(
      {
        id: 'T005',
        title: 'Compact a broad task contract',
        description: '',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
        verificationHints: {
          commands: ['npm test', 'npm run typecheck'],
          notes: ['Note 1', 'Note 2'],
        },
        contextFiles: ['src/core/prompt-pack.ts'],
        estimatedLoad: 0.33,
        crossLayer: false,
        splitRecommended: false,
        lastFailure: null,
      },
      {
        distilledMemory: ['[success] memory one', '[failure] memory two', '[context] memory three'],
      },
    );

    expect(pack.mode).toBe('balanced');
    expect(pack.prompt).toContain('Criterion 1');
    expect(pack.prompt).toContain('Criterion 2');
    expect(pack.prompt).toContain('(+1 more acceptance criteria omitted');
    expect(pack.prompt).toContain('command: npm test');
    expect(pack.prompt).toContain('(+1 more verification commands omitted)');
    expect(pack.prompt).toContain('note: Note 1');
    expect(pack.prompt).toContain('(+1 more verification notes omitted)');
    expect(pack.prompt).toContain('memory: [success] memory one');
    expect(pack.prompt).toContain('memory: [failure] memory two');
    expect(pack.prompt).toContain('(+1 more distilled memory entries omitted)');
  });
});

describe('selectPromptMode', () => {
  test('returns recovery for failure or broad-risk tasks', () => {
    expect(
      selectPromptMode({
        contextFiles: ['src/commands/run.ts'],
        estimatedLoad: 0.2,
        crossLayer: false,
        splitRecommended: false,
        lastFailure: {
          kind: 'code_bug',
          source: 'runner',
          summary: 'runner exit 1',
          failedCommand: null,
          exitCode: 1,
          firstErrorLine: 'runner exit 1',
          evidencePath: null,
        },
        verificationHints: { commands: [], notes: [] },
      }),
    ).toBe('recovery');
  });

  test('returns small only for low-load clean tasks', () => {
    expect(
      selectPromptMode({
        contextFiles: ['src/core/scheduler.ts'],
        estimatedLoad: 0.2,
        crossLayer: false,
        splitRecommended: false,
        lastFailure: null,
        verificationHints: { commands: ['npm test'], notes: [] },
      }),
    ).toBe('small');
  });
});
