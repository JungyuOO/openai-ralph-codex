import { beforeAll, describe, expect, test } from 'vitest';

let hookModule: {
  buildBootstrapPrd: (promptText: string) => string;
  buildClassifierPrompt: (context: Record<string, unknown>) => string;
  buildPostWriteMessage: (state: unknown, task: { id: string } | null) => string;
  buildPromptMessage: (
    decision: { stage: string; reason: string },
    state: { phase: string; nextAction?: string },
    task: { id: string; status: string; splitRecommended?: boolean } | null,
  ) => string;
  buildSessionStartMessage: (
    state: { phase: string; nextAction?: string },
    task: { id: string; title: string; status: string; splitRecommended?: boolean } | null,
  ) => string;
  classifyHeuristically: (context: {
    projectRoot: string;
    promptText: string;
    state: { phase?: string; nextAction?: string } | null;
    task: { id: string; status: string; splitRecommended?: boolean } | null;
    hasState: boolean;
    hasProjectPrd: boolean;
  }) => string;
  determineStage: (
    context: {
      projectRoot: string;
      promptText: string;
      state: { phase?: string; nextAction?: string } | null;
      task: { id: string; status: string; splitRecommended?: boolean } | null;
      hasState: boolean;
      hasProjectPrd: boolean;
    },
    options?: { mode?: 'auto' | 'classifier' | 'heuristic'; allowBootstrap?: boolean },
  ) => Promise<{ stage: string; reason: string; source: string }>;
  extractText: (payload: unknown) => string;
  matchesRalphIntent: (text: string) => boolean;
  recommendCommands: (
    intent: string,
    state: { phase: string; nextAction?: string },
    task: { id: string; status: string; splitRecommended?: boolean } | null,
  ) => string[];
  shouldBootstrapProject: (text: string) => boolean;
};

beforeAll(async () => {
  hookModule = (await import(
    '../../plugins/openai-ralph-codex/scripts/ralph-hook.mjs'
  )) as unknown as typeof hookModule;
});

describe('ralph plugin stage classifier', () => {
  test('heuristically detects multilingual planning / execution / verify / resume prompts', () => {
    expect(
      hookModule.classifyHeuristically({
        projectRoot: '.',
        promptText: 'Please plan this PRD and resume blocked work',
        state: { phase: 'planned' },
        task: null,
        hasState: true,
        hasProjectPrd: false,
      }),
    ).toBe('plan');

    expect(
      hookModule.classifyHeuristically({
        projectRoot: '.',
        promptText: 'Just tell me a joke',
        state: null,
        task: null,
        hasState: false,
        hasProjectPrd: false,
      }),
    ).toBe('ignore');

    expect(
      hookModule.classifyHeuristically({
        projectRoot: '.',
        promptText: '검증부터 하고 진행하자',
        state: { phase: 'running' },
        task: null,
        hasState: true,
        hasProjectPrd: false,
      }),
    ).toBe('verify');

    expect(
      hookModule.classifyHeuristically({
        projectRoot: '.',
        promptText: 'この機能の要件を整理してタスクに分解して',
        state: { phase: 'planned' },
        task: null,
        hasState: true,
        hasProjectPrd: false,
      }),
    ).toBe('plan');

    expect(
      hookModule.classifyHeuristically({
        projectRoot: '.',
        promptText: '继续卡住的工作并告诉我下一步',
        state: { phase: 'blocked', nextAction: 're-run `ralph plan`' },
        task: { id: 'T001', status: 'blocked', splitRecommended: true },
        hasState: true,
        hasProjectPrd: false,
      }),
    ).toBe('resume');
  });

  test('chooses bootstrap when no Ralph state exists yet', async () => {
    const decision = await hookModule.determineStage(
      {
        projectRoot: '.',
        promptText: 'Create a PRD and break this feature down',
        state: null,
        task: null,
        hasState: false,
        hasProjectPrd: false,
      },
      { mode: 'heuristic' },
    );
    expect(decision.stage).toBe('bootstrap');
  });

  test('falls back heuristically in auto mode when the classifier is unavailable', async () => {
    const previous = process.env.RALPH_DISABLE_CLASSIFIER;
    process.env.RALPH_DISABLE_CLASSIFIER = '1';

    try {
      const decision = await hookModule.determineStage(
        {
          projectRoot: '.',
          promptText: 'Create a PRD and break this feature down',
          state: null,
          task: null,
          hasState: false,
          hasProjectPrd: false,
        },
        { mode: 'auto' },
      );

      expect(decision).toMatchObject({
        stage: 'bootstrap',
        source: 'heuristic',
      });
    } finally {
      if (previous === undefined) {
        delete process.env.RALPH_DISABLE_CLASSIFIER;
      } else {
        process.env.RALPH_DISABLE_CLASSIFIER = previous;
      }
    }
  });

  test('does not fall back heuristically in classifier-only mode', async () => {
    const previous = process.env.RALPH_DISABLE_CLASSIFIER;
    process.env.RALPH_DISABLE_CLASSIFIER = '1';

    try {
      const decision = await hookModule.determineStage(
        {
          projectRoot: '.',
          promptText: 'Create a PRD and break this feature down',
          state: null,
          task: null,
          hasState: false,
          hasProjectPrd: false,
        },
        { mode: 'classifier' },
      );

      expect(decision).toMatchObject({
        stage: 'ignore',
        source: 'classifier',
      });
      expect(decision.reason).toContain('classifier mode enabled');
    } finally {
      if (previous === undefined) {
        delete process.env.RALPH_DISABLE_CLASSIFIER;
      } else {
        process.env.RALPH_DISABLE_CLASSIFIER = previous;
      }
    }
  });

  test('builds classifier prompt and routing message', () => {
    const classifierPrompt = hookModule.buildClassifierPrompt({
      projectRoot: '.',
      promptText: 'Plan this feature before implementing it',
      state: { phase: 'running', currentTask: 'T003' },
      task: { id: 'T003', status: 'pending' },
      hasState: true,
      hasProjectPrd: false,
    });
    expect(classifierPrompt).toContain('Classify the user request');
    expect(classifierPrompt).toContain('"stage":"ignore|bootstrap|plan|run|verify|resume|status"');

    const message = hookModule.buildPromptMessage(
      {
        stage: 'plan',
        reason: 'prompt looks like planning work',
      },
      { phase: 'running' },
      { id: 'T003', status: 'pending' },
    );
    expect(message).toContain('Ralph stage classifier (plan)');
    expect(message).toContain('ralph plan');
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

  test('builds session start, post-write, and blocked resume hints', () => {
    expect(
      hookModule.buildSessionStartMessage(
        { phase: 'planned' },
        { id: 'T001', title: 'Implement verify', status: 'pending' },
      ),
    ).toContain('Recommended next command: ralph status');

    expect(hookModule.buildPostWriteMessage({ phase: 'running' }, { id: 'T001' })).toContain(
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
