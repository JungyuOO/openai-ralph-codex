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
  test('detects multilingual planning / execution / verify / resume prompts', () => {
    expect(hookModule.matchesRalphIntent('Please plan this PRD and resume blocked work')).toBe(true);
    expect(hookModule.matchesRalphIntent('Just tell me a joke')).toBe(false);

    expect(hookModule.classifyPromptIntent('Please verify this task before we continue')).toBe('verify');
    expect(hookModule.classifyPromptIntent('Implement the next task from the PRD')).toBe('plan');
    expect(hookModule.classifyPromptIntent('Add authentication with password reset to this app')).toBe('plan');
    expect(hookModule.classifyPromptIntent('Fix src/hooks/bridge.ts:326 null check')).toBe('run');
    expect(hookModule.classifyPromptIntent('Continue the blocked work in this repo')).toBe('resume');

    expect(hookModule.classifyPromptIntent('이거 먼저 요구사항부터 정리하자')).toBe('plan');
    expect(hookModule.classifyPromptIntent('지금 막힌 작업 이어서 하자')).toBe('resume');
    expect(hookModule.classifyPromptIntent('검증부터 하고 진행하자')).toBe('verify');

    expect(hookModule.classifyPromptIntent('この機能の要件を整理してタスクに分解して')).toBe('plan');
    expect(hookModule.classifyPromptIntent('先に検証してから続けて')).toBe('verify');

    expect(hookModule.classifyPromptIntent('先把这个需求拆分成任务再做')).toBe('plan');
    expect(hookModule.classifyPromptIntent('继续卡住的工作并告诉我下一步')).toBe('resume');

    expect(hookModule.shouldBootstrapProject('Fix this blocked bug')).toBe(true);
    expect(hookModule.shouldBootstrapProject('Create a PRD and break this feature down')).toBe(true);
    expect(hookModule.matchesRalphIntent('그냥 농담 하나 해줘')).toBe(false);
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
