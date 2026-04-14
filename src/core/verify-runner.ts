import { spawn } from 'node:child_process';

export interface VerifyCommandResult {
  command: string;
  exitCode: number;
  durationMs: number;
}

export interface VerifyResult {
  ok: boolean;
  results: VerifyCommandResult[];
}

export async function runVerificationCommands(
  commands: string[],
  cwd: string,
): Promise<VerifyResult> {
  const results: VerifyCommandResult[] = [];
  for (const command of commands) {
    const start = Date.now();
    const exitCode = await runOne(command, cwd);
    results.push({ command, exitCode, durationMs: Date.now() - start });
    if (exitCode !== 0) {
      return { ok: false, results };
    }
  }
  return { ok: true, results };
}

function runOne(command: string, cwd: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (err) => {
      reject(
        new Error(
          `Failed to launch verification command \`${command}\`: ${err.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      resolve(code ?? -1);
    });
  });
}
