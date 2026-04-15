import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ralphPaths } from '../utils/paths.js';
import { exists, readJson, readTextUtf8 } from '../utils/fs.js';
import { ConfigSchema, type Config } from '../schemas/config.js';
import { TaskGraphSchema } from '../schemas/tasks.js';
import { StateSchema } from '../schemas/state.js';
import { runVerificationCommands } from '../core/verify-runner.js';
import { resolveVerificationCommands } from '../core/verification-profile.js';

export interface VerifyOptions {
  cwd?: string;
}

export async function runVerify(options: VerifyOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  if (!(await exists(p.config))) {
    console.error(`Missing config: ${path.relative(cwd, p.config)}`);
    console.error('Run `ralph init` first.');
    process.exitCode = 1;
    return;
  }

  const config: Config = ConfigSchema.parse(
    parseYaml(await readTextUtf8(p.config)),
  );

  const task = await loadCurrentTask(p.tasks, p.state);
  const commands = resolveVerificationCommands(task, config);
  if (commands.length === 0) {
    console.log('No verification commands configured.');
    return;
  }

  const evidenceDir = path.join(p.evidenceRoot, 'manual-verify', timestampLabel());
  console.log(`Running ${commands.length} verification command(s)...`);
  const result = await runVerificationCommands(commands, cwd, { evidenceDir });

  console.log('');
  console.log('Verification summary:');
  for (const item of result.results) {
    const mark = item.exitCode === 0 ? 'OK  ' : 'FAIL';
    console.log(`  ${mark} ${item.command} (${item.durationMs}ms, exit ${item.exitCode})`);
  }
  console.log(`Evidence saved to: ${path.relative(cwd, evidenceDir)}`);

  if (!result.ok) {
    console.error('Verification failed.');
    process.exitCode = 1;
  }
}

function timestampLabel(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function loadCurrentTask(tasksPath: string, statePath: string) {
  if (!(await exists(tasksPath)) || !(await exists(statePath))) {
    return null;
  }

  const graph = TaskGraphSchema.safeParse(
    await readJson<unknown>(tasksPath),
  );
  const state = StateSchema.safeParse(await readJson<unknown>(statePath));

  if (!graph.success || !state.success || !state.data.currentTask) {
    return null;
  }

  return graph.data.tasks.find((task) => task.id === state.data.currentTask) ?? null;
}
