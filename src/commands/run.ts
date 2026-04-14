import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ralphPaths, type RalphPaths } from '../utils/paths.js';
import {
  exists,
  readJson,
  readTextUtf8,
  writeJson,
  writeTextUtf8,
} from '../utils/fs.js';
import { ConfigSchema, type Config } from '../schemas/config.js';
import { TaskGraphSchema, type Task, type TaskGraph } from '../schemas/tasks.js';
import { loadState, saveState } from '../core/state-manager.js';
import { pickNextTask } from '../core/scheduler.js';
import { runCodexCli } from '../runners/codex-cli.js';
import { runVerificationCommands } from '../core/verify-runner.js';

export interface RunCommandOptions {
  cwd?: string;
  dryRun?: boolean;
}

export async function runRun(options: RunCommandOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const p = ralphPaths(cwd);

  for (const [label, file] of [
    ['config', p.config],
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

  const config: Config = ConfigSchema.parse(
    parseYaml(await readTextUtf8(p.config)),
  );
  const graph: TaskGraph = TaskGraphSchema.parse(await readJson<unknown>(p.tasks));
  const baseState = await loadState(p.state);

  const next = pickNextTask(graph);
  if (!next) {
    console.log('No runnable task. Either all tasks are done or blocked by dependencies.');
    return;
  }

  next.status = 'in_progress';
  await writeJson(p.tasks, graph);
  await saveState(
    p.state,
    {
      phase: 'running',
      currentTask: next.id,
      lastStatus: `running ${next.id}`,
      nextAction: `awaiting runner result for ${next.id}`,
    },
    baseState,
  );

  console.log(`Running task ${next.id}: ${next.title}`);

  const prompt = buildPrompt(next);

  if (options.dryRun) {
    console.log('--- dry run: prompt would be sent to runner stdin ---');
    console.log(prompt);
    console.log('--- /dry run ---');
    console.log(
      `Runner command: ${config.runner.command} ${config.runner.args.join(' ')}`.trim(),
    );
    console.log(`(dry-run: leaving ${next.id} as in_progress)`);
    return;
  }

  const runnerResult = await runCodexCli({
    command: config.runner.command,
    args: config.runner.args,
    cwd,
    stdin: prompt,
  });

  if (runnerResult.exitCode !== 0) {
    await handleTaskFailure({
      task: next,
      graph,
      paths: p,
      config,
      reason: `runner exit ${runnerResult.exitCode}`,
      stderr: runnerResult.stderr,
    });
    return;
  }

  if (runnerResult.stdout.trim()) {
    console.log('--- runner stdout ---');
    console.log(runnerResult.stdout.trimEnd());
  }

  if (config.verification.commands.length > 0) {
    console.log(
      `Running ${config.verification.commands.length} verification command(s)...`,
    );
    const verifyResult = await runVerificationCommands(
      config.verification.commands,
      cwd,
    );
    if (!verifyResult.ok) {
      const failed = verifyResult.results.find((r) => r.exitCode !== 0);
      const reason = failed
        ? `verify failed: \`${failed.command}\` (exit ${failed.exitCode})`
        : 'verify failed';
      await handleTaskFailure({
        task: next,
        graph,
        paths: p,
        config,
        reason,
      });
      return;
    }
  }

  next.status = 'done';
  next.retryCount = 0;
  await writeJson(p.tasks, graph);
  const following = pickNextTask(graph);
  const afterState = await loadState(p.state);
  await saveState(
    p.state,
    {
      phase: following ? 'running' : 'completed',
      currentTask: following?.id ?? null,
      lastStatus: `completed ${next.id}`,
      retryCount: 0,
      nextAction: following
        ? `start task ${following.id}: ${following.title}`
        : 'all tasks done',
    },
    afterState,
  );
  await appendProgress(
    p.progress,
    `- ${new Date().toISOString()} — completed ${next.id} (${runnerResult.durationMs}ms)\n`,
  );
  console.log(`OK ${next.id} completed in ${runnerResult.durationMs}ms`);
}

interface FailureInput {
  task: Task;
  graph: TaskGraph;
  paths: RalphPaths;
  config: Config;
  reason: string;
  stderr?: string;
}

async function handleTaskFailure(input: FailureInput): Promise<void> {
  const { task, graph, paths, config, reason, stderr } = input;
  task.retryCount += 1;
  const max = config.recovery.max_retries_per_task;
  const canRetry = task.retryCount <= max;

  if (canRetry) {
    task.status = 'pending';
  } else {
    task.status = 'failed';
  }
  await writeJson(paths.tasks, graph);

  const afterState = await loadState(paths.state);
  if (canRetry) {
    await saveState(
      paths.state,
      {
        phase: 'running',
        currentTask: task.id,
        lastStatus: `retry ${task.retryCount}/${max} — ${reason}`,
        retryCount: task.retryCount,
        nextAction: `re-run \`ralph run\` to retry ${task.id}`,
      },
      afterState,
    );
    await appendProgress(
      paths.progress,
      `- ${new Date().toISOString()} — retry queued for ${task.id} (${reason})\n`,
    );
    console.error(
      `RETRY ${task.id} (${task.retryCount}/${max}) — ${reason}`,
    );
  } else {
    await saveState(
      paths.state,
      {
        phase: 'blocked',
        currentTask: task.id,
        lastStatus: `failed ${task.id}: ${reason}`,
        retryCount: task.retryCount,
        nextAction: `diagnose ${task.id}; recovery policy exhausted (${task.retryCount} attempts)`,
      },
      afterState,
    );
    await appendProgress(
      paths.progress,
      `- ${new Date().toISOString()} — failed ${task.id} after ${task.retryCount} attempt(s) (${reason})\n`,
    );
    console.error(
      `FAIL ${task.id} after ${task.retryCount} attempt(s) — ${reason}`,
    );
  }

  if (stderr && stderr.trim()) {
    console.error('--- runner stderr ---');
    console.error(stderr.trimEnd());
  }

  process.exitCode = 1;
}

function buildPrompt(task: Task): string {
  const lines = [
    `Task: ${task.id} — ${task.title}`,
    task.description ? `Description: ${task.description}` : '',
    '',
    'Implement this task in the current repository.',
    'Keep changes minimal and surgical.',
    'Do not modify files unrelated to this task.',
  ];
  return lines.filter((l) => l !== '').join('\n') + '\n';
}

async function appendProgress(file: string, entry: string): Promise<void> {
  const existing = (await exists(file)) ? await readTextUtf8(file) : '# Progress\n\n';
  const base = existing.endsWith('\n') ? existing : `${existing}\n`;
  await writeTextUtf8(file, base + entry);
}
