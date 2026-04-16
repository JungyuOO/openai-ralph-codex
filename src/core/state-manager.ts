import { exists, readJson, writeJson } from '../utils/fs.js';
import { deriveLoopSession, StateSchema, type State } from '../schemas/state.js';

export async function loadState(path: string): Promise<State> {
  if (!(await exists(path))) {
    throw new Error(
      `State file not found: ${path}. Run \`orc init\` first.`,
    );
  }
  const raw = await readJson<unknown>(path);
  return StateSchema.parse(raw);
}

export async function saveState(
  path: string,
  patch: Partial<State> & Pick<State, 'phase' | 'lastStatus' | 'nextAction'>,
  base: State,
): Promise<State> {
  const updatedAt = new Date().toISOString();
  const nextPhase = patch.phase ?? base.phase;
  const nextCurrentTask = patch.currentTask === undefined ? base.currentTask : patch.currentTask;
  const next: State = StateSchema.parse({
    ...base,
    ...patch,
    loopSession: deriveLoopSession(
      patch.loopSession ?? base.loopSession,
      nextPhase,
      nextCurrentTask,
      updatedAt,
    ),
    updatedAt,
  });
  await writeJson(path, next);
  return next;
}
