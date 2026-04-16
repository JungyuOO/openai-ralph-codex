import { beforeAll, describe, expect, test } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let hookModule: {
  buildBootstrapPrd: (promptText: string) => string;
  buildClassifierPrompt: (context: Record<string, unknown>) => string;
  buildContinuationClassifierPrompt: (context: Record<string, unknown>) => string;
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
  classifyWithCodex: (context: {
    projectRoot: string;
    promptText: string;
    state: { phase?: string; nextAction?: string } | null;
    task: { id: string; status: string; splitRecommended?: boolean } | null;
    hasState: boolean;
    hasProjectPrd: boolean;
  }) => Promise<{ stage: string; reason: string; source: string } | null>;
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
  isLoopSessionLatched: (state: Record<string, unknown> | null) => boolean;
  matchesRalphIntent: (text: string) => boolean;
  recommendCommands: (
    intent: string,
    state: { phase: string; nextAction?: string },
    task: { id: string; status: string; splitRecommended?: boolean } | null,
  ) => string[];
  resolveClassifierPrompt: (context: Record<string, unknown>) => string;
  findEnabledProjectRoot: (startDir: string) => string | null;
  readProjectActivation: (projectRoot: string) => Promise<{ enabled: boolean } | null>;
  shouldBootstrapProject: (text: string) => boolean;
};

beforeAll(async () => {
  hookModule = (await import(
    '../../plugins/openai-ralph-codex/scripts/ralph-hook.mjs'
  )) as unknown as typeof hookModule;
});

describe('ralph plugin stage classifier', () => {
  test('legacy keyword helpers no longer trigger Ralph routing', () => {
    expect(
      hookModule.classifyHeuristically({
        projectRoot: '.',
        promptText: '요구사항 정리하고 이어서 진행해줘',
        state: { phase: 'planned' },
        task: null,
        hasState: true,
        hasProjectPrd: false,
      }),
    ).toBe('ignore');
    expect(hookModule.shouldBootstrapProject('PRD 만들고 작업 나눠줘')).toBe(false);
    expect(hookModule.matchesRalphIntent('계속해줘')).toBe(false);
  });

  test('returns ignore when heuristic mode is requested', async () => {
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

    expect(decision).toMatchObject({
      stage: 'ignore',
      source: 'classifier',
    });
    expect(decision.reason).toContain('heuristic routing has been removed');
  });

  test('returns ignore when the classifier is unavailable', async () => {
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
        stage: 'ignore',
        source: 'classifier',
      });
      expect(decision.reason).toContain('no classifier decision');
    } finally {
      if (previous === undefined) {
        delete process.env.RALPH_DISABLE_CLASSIFIER;
      } else {
        process.env.RALPH_DISABLE_CLASSIFIER = previous;
      }
    }
  });

  test('classifier can be explicitly disabled without crashing', async () => {
    const previous = process.env.RALPH_DISABLE_CLASSIFIER;
    process.env.RALPH_DISABLE_CLASSIFIER = '1';

    try {
      await expect(
        hookModule.classifyWithCodex({
          projectRoot: '.',
          promptText: 'continue the blocked task',
          state: { phase: 'blocked' },
          task: null,
          hasState: true,
          hasProjectPrd: true,
        }),
      ).resolves.toBeNull();
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

  test('uses a continuation classifier prompt for active loop sessions', () => {
    const prompt = hookModule.resolveClassifierPrompt({
      projectRoot: '.',
      promptText: 'continue with the current task',
      state: {
        phase: 'running',
        currentTask: 'T003',
        nextAction: 're-run `ralph run` to continue T003',
        loopSession: { active: true, routingMode: 'latched' },
      },
      task: { id: 'T003', status: 'pending' },
      hasState: true,
      hasProjectPrd: true,
    });

    expect(prompt).toContain('continuation stage classifier');
    expect(hookModule.isLoopSessionLatched({ phase: 'running', loopSession: { active: true } })).toBe(true);
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

  test('detects project-scoped activation markers before routing', async () => {
    expect(hookModule.findEnabledProjectRoot(process.cwd())).toBeNull();
    await expect(hookModule.readProjectActivation(process.cwd())).resolves.toBeNull();
  });

  test('finds the nearest enabled project root from nested directories', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ralph-hook-project-root-'));
    const nested = path.join(root, 'src', 'feature');
    await mkdir(path.join(root, '.ralph'), { recursive: true });
    await mkdir(nested, { recursive: true });
    await writeFile(
      path.join(root, '.ralph', 'project.json'),
      JSON.stringify({ version: 1, enabled: true }) + '\n',
      'utf8',
    );

    try {
      expect(hookModule.findEnabledProjectRoot(nested)).toBe(root);
      await expect(hookModule.readProjectActivation(root)).resolves.toMatchObject({
        enabled: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
