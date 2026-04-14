import { beforeAll, describe, expect, test } from 'vitest';

let hookModule: {
  buildPostWriteMessage: (state: unknown, task: { id: string } | null) => string;
  buildPromptMessage: (
    payload: unknown,
    state: { phase: string },
    task: { id: string; status: string } | null,
  ) => string;
  buildSessionStartMessage: (
    state: { phase: string },
    task: { id: string; title: string; status: string } | null,
  ) => string;
  extractText: (payload: unknown) => string;
  matchesRalphIntent: (text: string) => boolean;
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
    expect(message).toContain('T003');
    expect(message).toContain('ralph run');
  });

  test('builds session start and post-write hints', () => {
    expect(
      hookModule.buildSessionStartMessage(
        { phase: 'planned' },
        { id: 'T001', title: 'Implement verify', status: 'pending' },
      ),
    ).toContain('T001 Implement verify');

    expect(hookModule.buildPostWriteMessage({}, { id: 'T001' })).toContain(
      'ralph verify',
    );
  });
});
