import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';
import { runVerify } from '../../src/commands/verify.js';
import { ralphPaths, type RalphPaths } from '../../src/utils/paths.js';

let tmp: string;
let paths: RalphPaths;
let scriptPath: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ralph-verify-'));
  paths = ralphPaths(tmp);
  scriptPath = path.join(tmp, 'emit-output.mjs');

  await mkdir(paths.root, { recursive: true });
  await writeFile(
    scriptPath,
    [
      "const [exitCode = '0', stdoutText = '', stderrText = ''] = process.argv.slice(2);",
      "if (stdoutText && stdoutText !== '-') process.stdout.write(stdoutText);",
      "if (stderrText && stderrText !== '-') process.stderr.write(stderrText);",
      'process.exit(Number(exitCode));',
      '',
    ].join('\n'),
    'utf8',
  );

  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await rm(tmp, { recursive: true, force: true });
});

describe('runVerify', () => {
  test('writes manual verification evidence and succeeds when all commands pass', async () => {
    await writeConfig([
      shellCommand(process.execPath, scriptPath, '0', 'alpha', '-'),
      shellCommand(process.execPath, scriptPath, '0', 'beta', 'warn'),
    ]);

    await runVerify({ cwd: tmp });

    const evidence = await readEvidenceFiles();
    expect(evidence['command-01/stdout.txt']).toBe('alpha');
    expect(evidence['command-02/stderr.txt']).toBe('warn');
    expect(process.exitCode).toBeUndefined();
  });

  test('stops after the first failing verification command', async () => {
    await writeConfig([
      shellCommand(process.execPath, scriptPath, '1', 'boom', 'bad'),
      shellCommand(process.execPath, scriptPath, '0', 'skip', '-'),
    ]);

    await runVerify({ cwd: tmp });

    const evidence = await readEvidenceFiles();
    expect(evidence['command-01/result.json']).toContain('"exitCode": 1');
    expect(evidence['command-02/result.json']).toBeUndefined();
    expect(process.exitCode).toBe(1);
  });
});

async function writeConfig(commands: string[]): Promise<void> {
  await writeFile(
    paths.config,
    stringifyYaml({
      version: 1,
      verification: {
        commands,
      },
    }),
    'utf8',
  );
}

function shellCommand(...parts: string[]): string {
  return parts.map((part) => `"${part}"`).join(' ');
}

async function readEvidenceFiles(): Promise<Record<string, string>> {
  const verifyRoot = path.join(paths.evidenceRoot, 'manual-verify');
  const sessions = await readdir(verifyRoot);
  expect(sessions).toHaveLength(1);
  const sessionRoot = path.join(verifyRoot, sessions[0]);
  const files: Record<string, string> = {};

  for (const commandDir of await readdir(sessionRoot)) {
    const commandRoot = path.join(sessionRoot, commandDir);
    for (const name of await readdir(commandRoot)) {
      files[`${commandDir}/${name}`] = await readFile(
        path.join(commandRoot, name),
        'utf8',
      );
    }
  }

  return files;
}
