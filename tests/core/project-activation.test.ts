import { afterEach, describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  disableProjectActivation,
  enableProjectActivation,
  readProjectActivation,
} from '../../src/core/project-activation.js';

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('project activation', () => {
  test('writes a project activation marker under .ralph/project.json', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'ralph-project-activation-'));
    tmpDirs.push(cwd);

    const result = await enableProjectActivation({ cwd });
    const persisted = JSON.parse(await readFile(result.activationPath, 'utf8')) as {
      enabled: boolean;
      source: string;
    };

    expect(persisted.enabled).toBe(true);
    expect(persisted.source).toBe('manual');
    await expect(readProjectActivation({ cwd })).resolves.toMatchObject({
      enabled: true,
    });
  });

  test('removes the activation marker when disabled', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'ralph-project-disable-'));
    tmpDirs.push(cwd);

    await enableProjectActivation({ cwd });
    await disableProjectActivation({ cwd });

    await expect(readProjectActivation({ cwd })).resolves.toBeNull();
  });
});
