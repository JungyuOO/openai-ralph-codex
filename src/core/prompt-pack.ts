import type { Task } from '../schemas/tasks.js';

export interface PromptPack {
  stableRules: string[];
  taskContract: string[];
  iterationDelta: string[];
  prompt: string;
  mode: PromptMode;
}

export type PromptMode = 'small' | 'balanced' | 'recovery';

const MODES = {
  small: {
    acceptanceCriteria: 1,
    verificationCommands: 1,
    verificationNotes: 0,
    distilledMemory: 0,
  },
  balanced: {
    acceptanceCriteria: 2,
    verificationCommands: 1,
    verificationNotes: 1,
    distilledMemory: 2,
  },
  recovery: {
    acceptanceCriteria: 3,
    verificationCommands: 2,
    verificationNotes: 2,
    distilledMemory: 2,
  },
} as const;

const SMALL_TASK_MAX_LOAD = 0.25;
const SMALL_TASK_MAX_FILES = 2;
const RECOVERY_TASK_MIN_LOAD = 0.55;

export function buildPromptPack(
  task: Pick<
    Task,
    | 'id'
    | 'title'
    | 'description'
    | 'acceptanceCriteria'
    | 'verificationHints'
    | 'contextFiles'
    | 'estimatedLoad'
    | 'crossLayer'
    | 'splitRecommended'
    | 'lastFailure'
  >,
  options: {
    distilledMemory?: string[];
  } = {},
): PromptPack {
  const mode = selectPromptMode(task, options.distilledMemory ?? []);
  const caps = MODES[mode];

  const stableRules = [
    '- Implement only this task.',
    '- Keep edits minimal and surgical.',
    '- Prefer the listed context files before exploring new files.',
    '- Avoid unrelated files unless they are required to complete this task.',
    '- If the scope grows beyond this task, stop in a state that is easy to re-plan.',
  ];

  const compactAcceptanceCriteria = compactList(
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((criterion) => `- ${normalize(criterion)}`)
      : ['- Match the task title intent and keep the result verifiable.'],
    caps.acceptanceCriteria,
    (omitted) => `- (+${omitted} more acceptance criteria omitted; see task metadata if needed)`,
  );

  const taskContract = [
    '[TASK]',
    `id: ${task.id}`,
    `title: ${normalize(task.title)}`,
    task.description ? `description: ${normalize(task.description)}` : '',
    '',
    '[ACCEPTANCE_CRITERIA]',
    ...compactAcceptanceCriteria,
    '',
    '[SCOPE]',
    task.contextFiles.length > 0
      ? `primary_files: ${task.contextFiles.join(', ')}`
      : 'primary_files: none explicitly listed',
    `estimated_load: ${task.estimatedLoad.toFixed(2)}`,
    `cross_layer: ${task.crossLayer ? 'yes' : 'no'}`,
    `split_recommended: ${task.splitRecommended ? 'yes' : 'no'}`,
    `prompt_mode: ${mode}`,
  ];

  const iterationDelta = task.lastFailure
    ? [
        '[RECENT_FAILURE]',
        `kind: ${task.lastFailure.kind}`,
        `summary: ${normalize(task.lastFailure.summary)}`,
        task.lastFailure.firstErrorLine
          ? `first_error: ${normalize(task.lastFailure.firstErrorLine)}`
          : '',
      ]
    : [];

  const verificationHints =
    task.verificationHints.commands.length > 0 || task.verificationHints.notes.length > 0
      ? [
          '[VERIFICATION_HINTS]',
          ...compactList(
            task.verificationHints.commands.map((command) => `command: ${command}`),
            caps.verificationCommands,
            (omitted) => `command: (+${omitted} more verification commands omitted)`,
          ),
          ...compactList(
            task.verificationHints.notes.map((note) => `note: ${normalize(note)}`),
            caps.verificationNotes,
            (omitted) => `note: (+${omitted} more verification notes omitted)`,
          ),
        ]
      : [];

  const distilledMemory =
    options.distilledMemory && options.distilledMemory.length > 0 && caps.distilledMemory > 0
      ? [
          '[DISTILLED_MEMORY]',
          ...compactList(
            options.distilledMemory.map((entry) => `memory: ${normalize(entry)}`),
            caps.distilledMemory,
            (omitted) => `memory: (+${omitted} more distilled memory entries omitted)`,
          ),
        ]
      : [];

  const prompt = [
    ...taskContract,
    '',
    ...verificationHints,
    distilledMemory.length > 0 ? '' : '',
    ...distilledMemory,
    iterationDelta.length > 0 ? '' : '',
    ...iterationDelta,
    '',
    '[EXECUTION_RULES]',
    ...stableRules,
  ]
    .filter((line) => line !== '')
    .join('\n') + '\n';

  return {
    stableRules,
    taskContract: taskContract.filter((line) => line !== ''),
    iterationDelta: [...verificationHints, ...distilledMemory, ...iterationDelta].filter((line) => line !== ''),
    prompt,
    mode,
  };
}

export function selectPromptMode(
  task: Pick<
    Task,
    | 'contextFiles'
    | 'estimatedLoad'
    | 'crossLayer'
    | 'splitRecommended'
    | 'lastFailure'
    | 'verificationHints'
  >,
  distilledMemory: string[] = [],
): PromptMode {
  if (
    task.lastFailure ||
    task.splitRecommended ||
    task.crossLayer ||
    task.estimatedLoad >= RECOVERY_TASK_MIN_LOAD
  ) {
    return 'recovery';
  }

  if (
    task.estimatedLoad <= SMALL_TASK_MAX_LOAD &&
    task.contextFiles.length <= SMALL_TASK_MAX_FILES &&
    distilledMemory.length === 0 &&
    task.verificationHints.notes.length === 0
  ) {
    return 'small';
  }

  return 'balanced';
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compactList(
  items: string[],
  maxItems: number,
  overflowLine: (omitted: number) => string,
): string[] {
  if (maxItems <= 0) {
    return [];
  }
  if (items.length <= maxItems) {
    return items;
  }
  return [...items.slice(0, maxItems), overflowLine(items.length - maxItems)];
}
