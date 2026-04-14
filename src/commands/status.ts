import path from 'node:path';
import { ralphPaths } from '../utils/paths.js';
import { exists, readJson } from '../utils/fs.js';
import { StateSchema } from '../schemas/state.js';

export interface StatusOptions {
  cwd?: string;
}

export async function runStatus(options: StatusOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  if (!(await exists(p.state))) {
    console.error('Ralph project not initialized.');
    console.error(`Missing: ${path.relative(cwd, p.state)}`);
    console.error('Run `ralph init` first.');
    process.exitCode = 1;
    return;
  }

  const raw = await readJson<unknown>(p.state);
  const parsed = StateSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`Ralph state file is invalid: ${path.relative(cwd, p.state)}`);
    console.error(parsed.error.message);
    process.exitCode = 1;
    return;
  }

  const s = parsed.data;
  console.log('Ralph status');
  console.log(`  phase:         ${s.phase}`);
  console.log(`  current task:  ${s.currentTask ?? '(none)'}`);
  console.log(`  last status:   ${s.lastStatus}`);
  console.log(`  retry count:   ${s.retryCount}`);
  console.log(`  next action:   ${s.nextAction}`);
  console.log(`  updated at:    ${s.updatedAt}`);
}
