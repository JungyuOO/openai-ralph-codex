import { beforeAll, describe, expect, test } from 'vitest';

let hookModule: {
  buildBootstrapPrd: (promptText: string) => string;
  writeProjectPrd: (projectRoot: string, promptText: string) => Promise<string>;
  buildPostWriteMessage: (state: unknown, task: { id: string } | null) => string;
  buildPromptMessage: (
    payload: unknown,
    state: { phase: string; nextAction?: string },
    task: { id: string; status: string; splitRecommended?: boolean } | null,
  ) => string;
  buildSessionStartMessage: (
    state: { phase: string; nextAction?: string },
    task: { id: string; title: string; status: string; splitRecommended?: boolean } | null,
  ) => string;
  classifyPromptIntent: (text: string) => string;
  findProjectPrdPath: (projectRoot: string) => string | null;
  recommendCommands: (
    intent: string,
    state: { phase: string; nextAction?: string },
    task: { id: string; status: string; splitRecommended?: boolean } | null,
  ) => string[];
  extractText: (payload: unknown) => string;
  matchesRalphIntent: (text: string) => boolean;
  shouldBootstrapProject: (text: string) => boolean;
};

beforeAll(async () => {
  hookModule = (await import(
    '../../plugins/openai-ralph-codex/scripts/ralph-hook.mjs'
  )) as unknown as typeof hookModule;
});

describe('ralph plugin hooks', () => {
  test('detects Ralph-oriented prompts', () => {
    expect(
      hookModule.matchesRalphIntent('Please plan this PRD and resume blocked work'),
    ).toBe(true);
    expect(hookModule.matchesRalphIntent('Just tell me a joke')).toBe(false);
    expect(hookModule.classifyPromptIntent('Please verify this Ralph task')).toBe(
      'verify',
    );
    expect(
      hookModule.classifyPromptIntent('Implement the next Ralph task from the PRD'),
    ).toBe('plan');
    expect(hookModule.shouldBootstrapProject('Fix this blocked Ralph bug')).toBe(
      true,
    );
  });

  test('extracts prompt text from common payload shapes', () => {
    expect(hookModule.extractText({ user_prompt: 'plan the PRD' })).toBe(
      'plan the PRD',
    );
    expect(hookModule.extractText({ prompt: 'resume the blocked task' })).toBe(
      'resume the blocked task',
    );
    expect(hookModule.extractText('ralph status')).toBe('ralph status');
  });

  test('builds a routing hint when a current task exists', () => {
    const message = hookModule.buildPromptMessage(
      { user_prompt: 'Please plan this PRD and continue Ralph' },
      { phase: 'running' },
      { id: 'T003', status: 'pending' },
    );
    expect(message).toContain('Ralph auto-routing policy');
    expect(message).toContain('ralph plan');
  });

  test('builds session start, post-write, and blocked resume hints', () => {
    expect(
      hookModule.buildSessionStartMessage(
        { phase: 'planned' },
        { id: 'T001', title: 'Implement verify', status: 'pending' },
      ),
    ).toContain('Recommended next command: ralph status');

    expect(hookModule.buildPostWriteMessage({}, { id: 'T001' })).toContain(
      'ralph verify',
    );

    expect(
      hookModule.recommendCommands(
        'resume',
        {
          phase: 'blocked',
          nextAction:
            'split T001 in .ralph/prd.md or relax context limits in .ralph/config.yaml, then re-run `ralph plan`',
        },
        { id: 'T001', status: 'blocked', splitRecommended: true },
      ),
    ).toEqual(['ralph status', 'ralph plan']);
  });

  test('creates a bootstrap PRD from a first prompt', () => {
    const prd = hookModule.buildBootstrapPrd(
      'Build a PRD-driven delivery loop for this repository',
    );
    expect(prd).toContain('# Product Requirements Document');
    expect(prd).toContain('Build a PRD-driven delivery loop for this repository');
    expect(prd).toContain('## Acceptance Criteria');
  });
});
