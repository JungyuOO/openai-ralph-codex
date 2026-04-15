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
    | 'contextFiles'
    | 'estimatedLoad'
    | 'crossLayer'
    | 'splitRecommended'
    | 'lastFailure'
  >,
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

  const prompt = [
    ...taskContract,
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
    iterationDelta: iterationDelta.filter((line) => line !== ''),
    prompt,
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
