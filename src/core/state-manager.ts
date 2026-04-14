import { exists, readJson, writeJson } from '../utils/fs.js';
import { StateSchema, type State } from '../schemas/state.js';

export async function loadState(path: string): Promise<State> {
  if (!(await exists(path))) {
    throw new Error(
      `State file not found: ${path}. Run \`ralph init\` first.`,
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
  const next: State = StateSchema.parse({
    ...base,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await writeJson(path, next);
  return next;
}
