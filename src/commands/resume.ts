import path from 'node:path';
import { ralphPaths } from '../utils/paths.js';
import { exists } from '../utils/fs.js';
import { resumeExecution } from '../core/resume-manager.js';

export interface ResumeOptions {
  cwd?: string;
}

export async function runResume(options: ResumeOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  for (const [label, file] of [
    ['tasks', p.tasks],
    ['state', p.state],
  ] as const) {
    if (!(await exists(file))) {
      console.error(`Missing ${label}: ${path.relative(cwd, file)}`);
      console.error('Run `ralph init` and `ralph plan` first.');
      process.exitCode = 1;
      return;
    }
  }

  try {
    const result = await resumeExecution(p);
    console.log(`Resumed ${result.task.id}: ${result.task.title}`);
    if (result.mode === 'manual-retry') {
      console.log('Retry budget reset after manual unblock.');
    }
    console.log(`Next: run \`ralph run\` to continue ${result.task.id}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
