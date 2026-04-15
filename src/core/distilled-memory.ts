import { exists, readJson, writeJson } from '../utils/fs.js';
import {
  createInitialDistilledMemory,
  DistilledMemorySchema,
  type DistilledMemory,
  type DistilledMemoryCategory,
} from '../schemas/memory.js';

const MAX_MEMORY_ENTRIES = 12;
const PROMPT_MEMORY_LIMIT = 4;

export async function loadDistilledMemory(path: string): Promise<DistilledMemory> {
  if (!(await exists(path))) {
    return createInitialDistilledMemory();
  }
  return DistilledMemorySchema.parse(await readJson<unknown>(path));
}

export async function appendDistilledMemory(
  path: string,
  category: DistilledMemoryCategory,
  summary: string,
): Promise<DistilledMemory> {
  const normalizedSummary = normalize(summary);
  if (!normalizedSummary) {
    return loadDistilledMemory(path);
  }

  const current = await loadDistilledMemory(path);
  const nextEntries = [
    ...current.entries.filter(
      (entry) => !(entry.category === category && normalize(entry.summary) === normalizedSummary),
    ),
    {
      category,
      summary: normalizedSummary,
      updatedAt: new Date().toISOString(),
    },
  ].slice(-MAX_MEMORY_ENTRIES);

  const next = DistilledMemorySchema.parse({
    version: 1,
    entries: nextEntries,
  });
  await writeJson(path, next);
  return next;
}

export function renderDistilledMemory(
  memory: DistilledMemory,
  limit: number = PROMPT_MEMORY_LIMIT,
): string[] {
  return memory.entries
    .slice(-limit)
    .reverse()
    .map((entry) => `[${entry.category}] ${entry.summary}`);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
