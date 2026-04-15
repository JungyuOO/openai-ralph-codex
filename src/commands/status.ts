import path from 'node:path';
import { ralphPaths } from '../utils/paths.js';
import { exists, readJson } from '../utils/fs.js';
import { StateSchema } from '../schemas/state.js';
import { TaskGraphSchema } from '../schemas/tasks.js';
import { findSplitProposal } from '../core/split-proposal.js';

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

  const state = parsed.data;
  const currentTask = await loadCurrentTask(p.tasks, state.currentTask);
  const splitProposal = await findSplitProposal(p.splitProposals, state.currentTask);

  console.log('Ralph status');
  console.log(`  phase:         ${state.phase}`);
  console.log(`  current task:  ${state.currentTask ?? '(none)'}`);
  console.log(`  last status:   ${state.lastStatus}`);
  console.log(`  retry count:   ${state.retryCount}`);
  console.log(`  next action:   ${state.nextAction}`);
  if (state.lastFailureSummary) {
    console.log(`  last failure:  ${state.lastFailureSummary}`);
  }
  if (state.loopSession.active) {
    console.log(
      `  loop session:  active (${state.loopSession.routingMode}, stage=${state.loopSession.lastStage ?? 'unknown'})`,
    );
  }
  console.log(`  updated at:    ${state.updatedAt}`);

  if (currentTask) {
    console.log('');
    console.log('Current task details');
    console.log(`  title:         ${currentTask.title}`);
    console.log(`  status:        ${currentTask.status}`);
    console.log(`  load:          ${currentTask.estimatedLoad.toFixed(2)}`);
    console.log(`  files:         ${currentTask.contextFiles.length}`);
    if (currentTask.contextFiles.length > 0) {
      console.log(`  context:       ${currentTask.contextFiles.join(', ')}`);
    }
    if (currentTask.splitRecommended) {
      console.log('  recommendation: split this task before continuing');
    }
  }

  if (state.phase === 'blocked' && /context budget|split .*config/i.test(state.nextAction)) {
    console.log('');
    console.log('Hint');
    console.log('  The current task is blocked by the context budget.');
    console.log('  Split the task in `.ralph/prd.md` or relax `.ralph/config.yaml`, then run `ralph plan` again.');
  }

  if (splitProposal) {
    console.log('');
    console.log('Auto-split proposal');
    console.log(`  source:        ${splitProposal.source}`);
    console.log(`  reason:        ${splitProposal.reason}`);
    for (const [index, suggestion] of splitProposal.suggestions.entries()) {
      console.log(`  ${index + 1}. ${suggestion.title}`);
    }
  }
}

async function loadCurrentTask(tasksPath: string, taskId: string | null) {
  if (!taskId || !(await exists(tasksPath))) {
    return null;
  }

  const parsed = TaskGraphSchema.safeParse(await readJson<unknown>(tasksPath));
  if (!parsed.success) {
    return null;
  }

  return parsed.data.tasks.find((task) => task.id === taskId) ?? null;
}
