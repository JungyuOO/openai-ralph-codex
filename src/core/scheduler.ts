import type { ContextConfig } from '../schemas/config.js';
import type { Task, TaskGraph } from '../schemas/tasks.js';

export function pickNextTask(
  graph: TaskGraph,
  context?: ContextConfig,
): Task | undefined {
  const runnable = runnableTasks(graph);
  if (!context) {
    return runnable[0];
  }
  return runnable.find((task) => isTaskWithinContextBudget(task, context));
}

export function findContextBlockedTask(
  graph: TaskGraph,
  context: ContextConfig,
): Task | undefined {
  return runnableTasks(graph).find((task) => !isTaskWithinContextBudget(task, context));
}

export function isTaskWithinContextBudget(
  task: Pick<Task, 'contextFiles' | 'estimatedLoad' | 'crossLayer'>,
  context: ContextConfig,
): boolean {
  const tooManyFiles =
    context.split_if_files_over > 0 &&
    task.contextFiles.length > context.split_if_files_over;
  const tooBroad = task.estimatedLoad > context.max_estimated_load;
  const crossLayerBlocked = context.split_if_cross_layer && task.crossLayer;
  return !(tooManyFiles || tooBroad || crossLayerBlocked);
}

function runnableTasks(graph: TaskGraph): Task[] {
  const byId = new Map(graph.tasks.map((task) => [task.id, task]));
  return graph.tasks
    .filter((task) => {
      if (task.status !== 'pending') {
        return false;
      }
      return task.dependsOn.every((dependency) => byId.get(dependency)?.status === 'done');
    })
    .sort((left, right) => compareTaskPriority(left, right, graph));
}

export function scoreTaskPriority(
  task: Pick<
    Task,
    'id' | 'retryCount' | 'contextFiles' | 'estimatedLoad' | 'crossLayer' | 'splitRecommended'
  >,
  graph: TaskGraph,
): number {
  const unlockCount = graph.tasks.filter(
    (candidate) => candidate.status === 'pending' && candidate.dependsOn.includes(task.id),
  ).length;

  return (
    unlockCount * 20 -
    task.estimatedLoad * 50 -
    task.contextFiles.length * 2 -
    task.retryCount * 10 -
    (task.crossLayer ? 5 : 0) -
    (task.splitRecommended ? 15 : 0)
  );
}

function compareTaskPriority(left: Task, right: Task, graph: TaskGraph): number {
  const scoreDelta = scoreTaskPriority(right, graph) - scoreTaskPriority(left, graph);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const loadDelta = left.estimatedLoad - right.estimatedLoad;
  if (loadDelta !== 0) {
    return loadDelta;
  }

  const fileDelta = left.contextFiles.length - right.contextFiles.length;
  if (fileDelta !== 0) {
    return fileDelta;
  }

  return left.id.localeCompare(right.id);
}
