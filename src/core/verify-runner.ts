import path from 'node:path';
import { spawn } from 'node:child_process';
import { ensureDir, writeJson, writeTextUtf8 } from '../utils/fs.js';

export interface VerifyCommandResult {
  command: string;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  artifactDir?: string;
}

export interface VerifyResult {
  ok: boolean;
  results: VerifyCommandResult[];
}

export interface VerifyRunOptions {
  evidenceDir?: string;
}

export async function runVerificationCommands(
  commands: string[],
  cwd: string,
  options: VerifyRunOptions = {},
): Promise<VerifyResult> {
  const results: VerifyCommandResult[] = [];
  for (const [index, command] of commands.entries()) {
    const result = await runOne(command, cwd, index, options.evidenceDir);
    results.push(result);
    if (result.exitCode !== 0) {
      return { ok: false, results };
    }
  }
  return { ok: true, results };
}

async function runOne(
  command: string,
  cwd: string,
  index: number,
  evidenceDir?: string,
): Promise<VerifyCommandResult> {
  const start = Date.now();
  const artifactDir = evidenceDir
    ? path.join(evidenceDir, `command-${String(index + 1).padStart(2, '0')}`)
    : undefined;

  return new Promise<VerifyCommandResult>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    child.on('error', (err) => {
      reject(
        new Error(
          `Failed to launch verification command \`${command}\`: ${err.message}`,
        ),
      );
    });

    child.on('close', (code) => {
      void finalizeArtifacts({
        artifactDir,
        command,
        exitCode: code ?? -1,
        durationMs: Date.now() - start,
        stdout,
        stderr,
      })
        .then((result) => resolve(result))
        .catch(reject);
    });
  });
}

async function finalizeArtifacts(
  result: VerifyCommandResult,
): Promise<VerifyCommandResult> {
  if (!result.artifactDir) {
    return result;
  }

  await ensureDir(result.artifactDir);
  await writeTextUtf8(path.join(result.artifactDir, 'command.txt'), `${result.command}\n`);
  await writeTextUtf8(path.join(result.artifactDir, 'stdout.txt'), result.stdout);
  await writeTextUtf8(path.join(result.artifactDir, 'stderr.txt'), result.stderr);
  await writeJson(path.join(result.artifactDir, 'result.json'), {
    command: result.command,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  });

  return result;
}
