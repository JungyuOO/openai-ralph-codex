import type { Task, TaskGraph } from '../schemas/tasks.js';

export function pickNextTask(graph: TaskGraph): Task | undefined {
  const byId = new Map(graph.tasks.map((t) => [t.id, t]));
  for (const t of graph.tasks) {
    if (t.status !== 'pending') continue;
    const depsDone = t.dependsOn.every((d) => byId.get(d)?.status === 'done');
    if (depsDone) return t;
  }
  return undefined;
}
