import { describe, expect, test } from 'vitest';
import { buildPromptPack } from '../../src/core/prompt-pack.js';

describe('buildPromptPack', () => {
  test('builds a task-only contract with compact scope and rules', () => {
    const pack = buildPromptPack({
      id: 'T001',
      title: 'Implement the scheduler update',
      description: 'Update the scheduler to prefer narrower runnable tasks first.',
      contextFiles: ['src/core/scheduler.ts', 'tests/core/scheduler.test.ts'],
      estimatedLoad: 0.34,
      crossLayer: false,
      splitRecommended: false,
      lastFailure: null,
    });

    expect(pack.prompt).toContain('[TASK]');
    expect(pack.prompt).toContain('primary_files: src/core/scheduler.ts, tests/core/scheduler.test.ts');
    expect(pack.prompt).toContain('[EXECUTION_RULES]');
    expect(pack.prompt).not.toContain('[RECENT_FAILURE]');
    expect(pack.stableRules).toHaveLength(5);
  });

  test('includes recent failure context without replaying raw logs', () => {
    const pack = buildPromptPack({
      id: 'T002',
      title: 'Fix verification failure',
      description: '',
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
  });
});
