import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  appendDistilledMemory,
  loadDistilledMemory,
  renderDistilledMemory,
} from '../../src/core/distilled-memory.js';

let tmp: string;
let memoryPath: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-memory-'));
  memoryPath = path.join(tmp, 'memory.json');
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('distilled memory', () => {
  test('creates memory on demand and renders newest entries first', async () => {
    await appendDistilledMemory(memoryPath, 'success', 'Completed T001 touching src/core/run.ts.');
    await appendDistilledMemory(memoryPath, 'failure', 'Avoid retrying the same broken verify command.');

    const memory = await loadDistilledMemory(memoryPath);
    expect(memory.entries).toHaveLength(2);
    expect(renderDistilledMemory(memory)).toEqual([
      '[failure] Avoid retrying the same broken verify command.',
      '[success] Completed T001 touching src/core/run.ts.',
    ]);
  });

  test('dedupes repeated summaries within the same category', async () => {
    await appendDistilledMemory(memoryPath, 'success', 'Completed T001.');
    await appendDistilledMemory(memoryPath, 'success', 'Completed T001.');

    const memory = await loadDistilledMemory(memoryPath);
    expect(memory.entries).toHaveLength(1);
  });
});
