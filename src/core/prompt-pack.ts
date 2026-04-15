import type { Task } from '../schemas/tasks.js';

export interface PromptPack {
  stableRules: string[];
  taskContract: string[];
  iterationDelta: string[];
  prompt: string;
}

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
  const stableRules = [
    '- Implement only this task.',
    '- Keep edits minimal and surgical.',
    '- Prefer the listed context files before exploring new files.',
    '- Avoid unrelated files unless they are required to complete this task.',
    '- If the scope grows beyond this task, stop in a state that is easy to re-plan.',
  ];

  const taskContract = [
    '[TASK]',
    `id: ${task.id}`,
    `title: ${normalize(task.title)}`,
    task.description ? `description: ${normalize(task.description)}` : '',
    '',
    '[ACCEPTANCE_CRITERIA]',
    ...(task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((criterion) => `- ${normalize(criterion)}`)
      : ['- Match the task title intent and keep the result verifiable.']),
    '',
    '[SCOPE]',
    task.contextFiles.length > 0
      ? `primary_files: ${task.contextFiles.join(', ')}`
      : 'primary_files: none explicitly listed',
    `estimated_load: ${task.estimatedLoad.toFixed(2)}`,
    `cross_layer: ${task.crossLayer ? 'yes' : 'no'}`,
    `split_recommended: ${task.splitRecommended ? 'yes' : 'no'}`,
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
          ...task.verificationHints.commands.map((command) => `command: ${command}`),
          ...task.verificationHints.notes.map((note) => `note: ${normalize(note)}`),
        ]
      : [];

  const distilledMemory =
    options.distilledMemory && options.distilledMemory.length > 0
      ? [
          '[DISTILLED_MEMORY]',
          ...options.distilledMemory.map((entry) => `memory: ${normalize(entry)}`),
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
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
