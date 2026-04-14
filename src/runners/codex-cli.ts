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
  const useShell = shouldUseShellForRunner(opts.command);
  return new Promise<RunnerResult>((resolve, reject) => {
    const child = spawn(useShell ? buildShellCommand(opts.command, opts.args) : opts.command, useShell ? [] : opts.args, {
      cwd: opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: useShell,
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

export function shouldUseShellForRunner(
  command: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== 'win32') {
    return false;
  }
  return command.endsWith('.cmd') || command.endsWith('.bat') || !command.includes('.');
}

export function buildShellCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteForWindowsShell).join(' ');
}

function quoteForWindowsShell(value: string): string {
  if (/^[A-Za-z0-9_./:\\=-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}
