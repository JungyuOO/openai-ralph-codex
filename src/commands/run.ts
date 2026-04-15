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
import { findContextBlockedTask, pickNextTask } from '../core/scheduler.js';
import { formatTaskContext } from '../core/task-graph.js';
import { runCodexCli } from '../runners/codex-cli.js';
import { runVerificationCommands } from '../core/verify-runner.js';
import { buildPromptPack } from '../core/prompt-pack.js';
import { resolveVerificationCommands } from '../core/verification-profile.js';
import {
  fingerprintContextBudgetFailure,
  fingerprintRunnerFailure,
  fingerprintVerificationFailure,
} from '../core/failure-fingerprint.js';

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

  const next = pickNextTask(graph, config.context);
  if (!next) {
    const blockedByContext = findContextBlockedTask(graph, config.context);
    if (blockedByContext) {
      await handleContextBudgetBlock({
        task: blockedByContext,
        graph,
        paths: p,
        config,
      });
      return;
    }
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
      lastFailureKind: next.lastFailure?.kind ?? null,
      lastFailureSummary: next.lastFailure?.summary ?? null,
    },
    baseState,
  );

  console.log(`Running task ${next.id}: ${next.title}`);
  if (next.splitRecommended) {
    console.log(
      `Context hint: ${next.id} looks broad (load ${next.estimatedLoad.toFixed(2)}). Consider splitting if the edit expands.`,
    );
  }

  const promptPack = buildPromptPack(next);
  const prompt = promptPack.prompt;

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

  const verificationCommands = resolveVerificationCommands(next, config);

  if (verificationCommands.length > 0) {
    const evidenceDir = path.join(p.evidenceRoot, next.id, timestampLabel());
    console.log(
      `Running ${verificationCommands.length} verification command(s)...`,
    );
    const verifyResult = await runVerificationCommands(
      verificationCommands,
      cwd,
      { evidenceDir },
    );
    console.log(`Evidence saved to: ${path.relative(cwd, evidenceDir)}`);
    if (!verifyResult.ok) {
      const failed = verifyResult.results.find((r) => r.exitCode !== 0);
      const reason = failed
        ? `verify failed: \`${failed.command}\` (exit ${failed.exitCode})`
        : 'verify failed';
      const fingerprint = failed
        ? fingerprintVerificationFailure({
            result: failed,
            evidencePath: evidenceDir,
          })
        : undefined;
      await handleTaskFailure({
        task: next,
        graph,
        paths: p,
        config,
        reason,
        fingerprint,
      });
      return;
    }
  }

  next.status = 'done';
  next.retryCount = 0;
  next.lastFailure = null;
  await writeJson(p.tasks, graph);
  const following = pickNextTask(graph, config.context);
  const contextBlocked = findContextBlockedTask(graph, config.context);
  const unresolved = graph.tasks.find((task) => task.status !== 'done');
  const afterState = await loadState(p.state);
  await saveState(
    p.state,
    {
      phase: following ? 'running' : unresolved ? 'blocked' : 'completed',
      currentTask: following?.id ?? unresolved?.id ?? null,
      lastStatus: contextBlocked
        ? `completed ${next.id}; blocked ${contextBlocked.id} by context budget`
        : unresolved
          ? `completed ${next.id}; unresolved work remains`
          : `completed ${next.id}`,
      retryCount: 0,
      lastFailureKind: null,
      lastFailureSummary: null,
      nextAction: following
        ? `start task ${following.id}: ${following.title}`
        : contextBlocked
          ? `split ${contextBlocked.id} in .ralph/prd.md or relax context limits in .ralph/config.yaml, then re-run \`ralph plan\``
          : unresolved
            ? `inspect ${unresolved.id} and resolve the blocked task before re-running \`ralph run\``
            : 'all tasks done',
    },
    afterState,
  );
  await appendProgress(
    p.progress,
    `- ${new Date().toISOString()} ??completed ${next.id} (${runnerResult.durationMs}ms)\n`,
  );
  console.log(`OK ${next.id} completed in ${runnerResult.durationMs}ms`);
}

interface FailureInput {
  task: Task;
  graph: TaskGraph;
  paths: RalphPaths;
  config: Config;
  reason: string;
  fingerprint?: Task['lastFailure'];
  stderr?: string;
}

async function handleContextBudgetBlock(input: {
  task: Task;
  graph: TaskGraph;
  paths: RalphPaths;
  config: Config;
}): Promise<void> {
  const { task, graph, paths, config } = input;
  task.status = 'blocked';
  const reason = contextBudgetReason(task, config);
  const fingerprint = fingerprintContextBudgetFailure(reason);
  task.lastFailure = fingerprint;
  await writeJson(paths.tasks, graph);

  const afterState = await loadState(paths.state);
  await saveState(
    paths.state,
    {
      phase: 'blocked',
      currentTask: task.id,
      lastStatus: `blocked ${task.id}: ${reason}`,
      retryCount: task.retryCount,
      lastFailureKind: fingerprint.kind,
      lastFailureSummary: fingerprint.summary,
      nextAction:
        `split ${task.id} in .ralph/prd.md or relax context limits in .ralph/config.yaml, ` +
        'then re-run `ralph plan`',
    },
    afterState,
  );
  await appendProgress(
    paths.progress,
    `- ${new Date().toISOString()} ??blocked ${task.id} by context budget (${reason})\n`,
  );
  console.error(`BLOCKED ${task.id} ??${reason}`);
  process.exitCode = 1;
}

async function handleTaskFailure(input: FailureInput): Promise<void> {
  const { task, graph, paths, config, reason, fingerprint, stderr } = input;
  task.retryCount += 1;
  task.lastFailure =
    fingerprint ??
    fingerprintRunnerFailure({
      reason,
      stderr,
    });
  const max = config.recovery.max_retries_per_task;
  const canRetry = task.retryCount <= max;

  task.status = canRetry ? 'pending' : 'failed';
  await writeJson(paths.tasks, graph);

  const afterState = await loadState(paths.state);
  if (canRetry) {
    await saveState(
      paths.state,
      {
        phase: 'running',
        currentTask: task.id,
        lastStatus: `retry ${task.retryCount}/${max} ??${reason}`,
        retryCount: task.retryCount,
        lastFailureKind: task.lastFailure.kind,
        lastFailureSummary: task.lastFailure.summary,
        nextAction: `re-run \`ralph run\` to retry ${task.id}`,
      },
      afterState,
    );
    await appendProgress(
      paths.progress,
      `- ${new Date().toISOString()} ??retry queued for ${task.id} (${reason})\n`,
    );
    console.error(`RETRY ${task.id} (${task.retryCount}/${max}) ??${reason}`);
  } else {
    await saveState(
      paths.state,
      {
        phase: 'blocked',
        currentTask: task.id,
        lastStatus: `failed ${task.id}: ${reason}`,
        retryCount: task.retryCount,
        lastFailureKind: task.lastFailure.kind,
        lastFailureSummary: task.lastFailure.summary,
        nextAction: `diagnose ${task.id}; recovery policy exhausted (${task.retryCount} attempts)`,
      },
      afterState,
    );
    await appendProgress(
      paths.progress,
      `- ${new Date().toISOString()} ??failed ${task.id} after ${task.retryCount} attempt(s) (${reason})\n`,
    );
    console.error(`FAIL ${task.id} after ${task.retryCount} attempt(s) ??${reason}`);
  }

  if (stderr && stderr.trim()) {
    console.error('--- runner stderr ---');
    console.error(stderr.trimEnd());
  }

  process.exitCode = 1;
}

function contextBudgetReason(task: Task, config: Config): string {
  if (
    config.context.split_if_files_over > 0 &&
    task.contextFiles.length > config.context.split_if_files_over
  ) {
    return `${task.contextFiles.length} files exceed limit ${config.context.split_if_files_over}`;
  }
  if (config.context.split_if_cross_layer && task.crossLayer) {
    return 'cross-layer scope exceeds current policy';
  }
  if (task.estimatedLoad > config.context.max_estimated_load) {
    return `estimated load ${task.estimatedLoad.toFixed(2)} exceeds limit ${config.context.max_estimated_load.toFixed(2)}`;
  }
  return 'task exceeds context budget';
}

function timestampLabel(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function appendProgress(file: string, entry: string): Promise<void> {
  const existing = (await exists(file)) ? await readTextUtf8(file) : '# Progress\n\n';
  const base = existing.endsWith('\n') ? existing : `${existing}\n`;
  await writeTextUtf8(file, base + entry);
}
