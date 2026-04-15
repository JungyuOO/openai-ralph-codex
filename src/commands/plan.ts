import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ralphPaths } from '../utils/paths.js';
import {
  exists,
  readJson,
  readTextUtf8,
  writeJson,
  writeTextUtf8,
} from '../utils/fs.js';
import { ConfigSchema } from '../schemas/config.js';
import { deriveLoopSession, StateSchema, type State } from '../schemas/state.js';
import { type TaskGraph } from '../schemas/tasks.js';
import { countSplitRecommendedTasks, planTaskGraph } from '../core/planner.js';

export interface PlanOptions {
  cwd?: string;
}

export async function runPlan(options: PlanOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  for (const [label, file] of [
    ['config', p.config],
    ['prd', p.prd],
    ['state', p.state],
  ] as const) {
    if (!(await exists(file))) {
      console.error(`Missing ${label}: ${path.relative(cwd, file)}`);
      console.error('Run `ralph init` first.');
      process.exitCode = 1;
      return;
    }
  }

  const config = ConfigSchema.parse(parseYaml(await readTextUtf8(p.config)));
  const prdText = await readTextUtf8(p.prd);
  const contextMapText = (await exists(p.contextMap))
    ? await readTextUtf8(p.contextMap)
    : '';

  const graph: TaskGraph = planTaskGraph({
    prdText,
    context: config.context,
    contextMapText,
    source: '.ralph/prd.md',
  });
  await writeJson(p.tasks, graph);

  const currentState = StateSchema.parse(await readJson<unknown>(p.state));
  const nextTask = graph.tasks[0];
  const splitRecommended = countSplitRecommendedTasks(graph);
  const updatedAt = new Date().toISOString();
  const updatedState: State = {
    ...currentState,
    phase: 'planned',
    currentTask: nextTask?.id ?? null,
    lastStatus: `planned ${graph.tasks.length} task(s)`,
    retryCount: 0,
    nextAction: nextTask
      ? `start task ${nextTask.id}: ${nextTask.title}`
      : 'no tasks generated ??revise .ralph/prd.md and re-run `ralph plan`',
    updatedAt,
    loopSession: deriveLoopSession(
      currentState.loopSession,
      'planned',
      nextTask?.id ?? null,
      updatedAt,
    ),
    lastFailureKind: null,
    lastFailureSummary: null,
  };
  await writeJson(p.state, updatedState);

  const entry =
    `- ${updatedState.updatedAt} ??plan generated (${graph.tasks.length} task(s)` +
    (splitRecommended > 0 ? `, ${splitRecommended} split suggestion(s)` : '') +
    ')\n';
  await appendProgress(p.progress, entry);

  console.log(
    `Planned ${graph.tasks.length} task(s) from ${path.relative(cwd, p.prd)}.`,
  );
  for (const task of graph.tasks) {
    const note = task.splitRecommended
      ? ` [split suggested, load ${task.estimatedLoad.toFixed(2)}]`
      : '';
    console.log(`  - ${task.id}: ${task.title}${note}`);
  }
  if (splitRecommended > 0) {
    console.log('');
    console.log(
      `Context budget warning: ${splitRecommended} task(s) exceed the configured scope heuristics.`,
    );
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
