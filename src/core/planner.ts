import type { ContextConfig } from '../schemas/config.js';
import { TaskGraphSchema, type TaskGraph } from '../schemas/tasks.js';
import { extractTasksFromPrd } from './prd-parse.js';
import { compileTaskContract } from './task-contract.js';
import { assessTaskContext } from './task-graph.js';

export interface PlanTaskGraphOptions {
  prdText: string;
  context: ContextConfig;
  contextMapText?: string;
  source?: string;
}

export function planTaskGraph(options: PlanTaskGraphOptions): TaskGraph {
  const tasks = extractTasksFromPrd(options.prdText).map((task) => ({
    ...task,
    ...compileTaskContract(task),
    ...assessTaskContext(task, options.context, options.contextMapText),
  }));

  return TaskGraphSchema.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: options.source ?? '.ralph/prd.md',
    tasks,
  });
}

export function countSplitRecommendedTasks(graph: TaskGraph): number {
  return graph.tasks.filter((task) => task.splitRecommended).length;
}
