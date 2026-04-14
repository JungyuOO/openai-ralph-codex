import path from 'node:path';
import { ralphPaths } from '../utils/paths.js';
import {
  exists,
  readJson,
  readTextUtf8,
  writeJson,
  writeTextUtf8,
} from '../utils/fs.js';
import { StateSchema, type State } from '../schemas/state.js';
import { TaskGraphSchema, type TaskGraph } from '../schemas/tasks.js';
import { extractTasksFromPrd } from '../core/prd-parse.js';

export interface PlanOptions {
  cwd?: string;
}

export async function runPlan(options: PlanOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  if (!(await exists(p.prd))) {
    console.error(`Missing PRD: ${path.relative(cwd, p.prd)}`);
    console.error('Run `ralph init` first.');
    process.exitCode = 1;
    return;
  }
  if (!(await exists(p.state))) {
    console.error(`Missing state: ${path.relative(cwd, p.state)}`);
    console.error('Run `ralph init` first.');
    process.exitCode = 1;
    return;
  }

  const prdText = await readTextUtf8(p.prd);
  const tasks = extractTasksFromPrd(prdText);

  const graph: TaskGraph = TaskGraphSchema.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    source: '.ralph/prd.md',
    tasks,
  });
  await writeJson(p.tasks, graph);

  const currentState = StateSchema.parse(await readJson<unknown>(p.state));
  const nextTask = tasks[0];
  const updatedState: State = {
    ...currentState,
    phase: 'planned',
    currentTask: nextTask?.id ?? null,
    lastStatus: `planned ${tasks.length} task(s)`,
    retryCount: 0,
    nextAction: nextTask
      ? `start task ${nextTask.id}: ${nextTask.title}`
      : 'no tasks generated — revise .ralph/prd.md and re-run `ralph plan`',
    updatedAt: new Date().toISOString(),
  };
  await writeJson(p.state, updatedState);

  const entry = `- ${updatedState.updatedAt} — plan generated (${tasks.length} task(s))\n`;
  await appendProgress(p.progress, entry);

  console.log(
    `Planned ${tasks.length} task(s) from ${path.relative(cwd, p.prd)}.`,
  );
  for (const t of tasks) {
    console.log(`  - ${t.id}: ${t.title}`);
  }
  console.log('');
  console.log(`Wrote: ${path.relative(cwd, p.tasks)}`);
  console.log(`Next:  ${updatedState.nextAction}`);
}

async function appendProgress(file: string, entry: string): Promise<void> {
  const existing = (await exists(file)) ? await readTextUtf8(file) : '# Progress\n\n';
  const base = existing.endsWith('\n') ? existing : `${existing}\n`;
  await writeTextUtf8(file, base + entry);
}
