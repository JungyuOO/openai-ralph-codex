import {
  exists,
  readJson,
  readTextUtf8,
  writeJson,
  writeTextUtf8,
} from '../utils/fs.js';
import type { RalphPaths } from '../utils/paths.js';
import { TaskGraphSchema, type Task, type TaskGraph } from '../schemas/tasks.js';
import type { Phase } from '../schemas/state.js';
import { loadState, saveState } from './state-manager.js';
import { pickNextTask } from './scheduler.js';

type ResumeMode = 'manual-retry' | 'requeue' | 'continue';

export interface ResumeResult {
  task: Task;
  mode: ResumeMode;
}

export async function resumeExecution(paths: RalphPaths): Promise<ResumeResult> {
  const graph = TaskGraphSchema.parse(await readJson<unknown>(paths.tasks));
  const state = await loadState(paths.state);

  const task = findTaskToResume(graph, state.currentTask);
  if (!task) {
    throw new Error('No task is available to resume.');
  }

  const mode = classifyResume(state.phase, task);
  if (!mode) {
    throw new Error(
      `Nothing resumable in phase \`${state.phase}\`. Use \`ralph run\` when work is already ready to continue.`,
    );
  }

  if (mode === 'manual-retry') {
    task.status = 'pending';
    task.retryCount = 0;
  } else if (mode === 'requeue') {
    task.status = 'pending';
  }

  await writeJson(paths.tasks, graph);
  await saveState(
    paths.state,
    {
      phase: 'running',
      currentTask: task.id,
      lastStatus: buildLastStatus(mode, task.id),
      retryCount: task.retryCount,
      nextAction: `re-run \`ralph run\` to continue ${task.id}`,
    },
    state,
  );
  await appendProgress(paths.progress, progressEntry(mode, task.id));

  return { task, mode };
}

function findTaskToResume(
  graph: TaskGraph,
  currentTaskId: string | null,
): Task | undefined {
  const byId = new Map(graph.tasks.map((task) => [task.id, task]));

  const current =
    currentTaskId === null ? undefined : byId.get(currentTaskId);
  if (current && current.status !== 'done') {
    return current;
  }

  return (
    graph.tasks.find((task) => task.status === 'in_progress') ??
    graph.tasks.find((task) => task.status === 'failed') ??
    pickNextTask(graph)
  );
}

function classifyResume(phase: Phase, task: Task): ResumeMode | null {
  if (phase === 'blocked') {
    if (task.status === 'failed' || task.status === 'blocked') {
      return 'manual-retry';
    }
    if (task.status === 'in_progress') {
      return 'requeue';
    }
    if (task.status === 'pending') {
      return 'continue';
    }
    return null;
  }

  if (phase === 'running') {
    if (task.status === 'in_progress') {
      return 'requeue';
    }
    if (task.status === 'pending') {
      return 'continue';
    }
    return null;
  }

  return null;
}

function buildLastStatus(mode: ResumeMode, taskId: string): string {
  if (mode === 'manual-retry') {
    return `resumed ${taskId} after manual unblock`;
  }
  if (mode === 'requeue') {
    return `re-queued ${taskId} for resume`;
  }
  return `resumed queue at ${taskId}`;
}

function progressEntry(mode: ResumeMode, taskId: string): string {
  const detail =
    mode === 'manual-retry'
      ? 'manual unblock'
      : mode === 'requeue'
        ? 're-queued'
        : 'continue';
  return `- ${new Date().toISOString()} - resumed ${taskId} (${detail})\n`;
}

async function appendProgress(file: string, entry: string): Promise<void> {
  const existing = (await exists(file)) ? await readTextUtf8(file) : '# Progress\n\n';
  const base = existing.endsWith('\n') ? existing : `${existing}\n`;
  await writeTextUtf8(file, base + entry);
}
