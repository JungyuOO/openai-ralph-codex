import { spawn } from 'node:child_process';

export interface RunnerOptions {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
}

export interface RunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export async function runCodexCli(opts: RunnerOptions): Promise<RunnerResult> {
  const start = Date.now();
  return new Promise<RunnerResult>((resolve, reject) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (err) => {
      reject(
        new Error(
          `Failed to launch runner \`${opts.command}\`: ${err.message}`,
        ),
      );
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });

    if (opts.stdin !== undefined) {
      child.stdin.end(opts.stdin);
    } else {
      child.stdin.end();
    }
  });
}
