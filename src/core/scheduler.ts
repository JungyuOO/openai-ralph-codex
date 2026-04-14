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
  return graph.tasks.filter((task) => {
    if (task.status !== 'pending') {
      return false;
    }
    return task.dependsOn.every((dependency) => byId.get(dependency)?.status === 'done');
  });
}
