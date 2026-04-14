import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = path.resolve(process.cwd());

export async function runHook(mode = 'user-prompt') {
  const projectRoot = resolveProjectRoot();
  const payload = await readPayload();
  const promptText = extractText(payload);

  if (mode === 'user-prompt' && shouldBootstrapProject(promptText)) {
    const didBootstrap = await maybeBootstrapProject(projectRoot, promptText);
    if (didBootstrap) {
      const state = await readJsonPath(projectRoot, 'state.json');
      const task = state?.currentTask
        ? await readCurrentTask(projectRoot, state.currentTask)
        : null;
      return (
        `Ralph auto-bootstrap completed for this project. ` +
        `Recommended command path: ${recommendCommands('run', state ?? { phase: 'planned' }, task).join(' -> ')}`
      );
    }
  }

  const state = await readJsonPath(projectRoot, 'state.json');
  const task = state?.currentTask
    ? await readCurrentTask(projectRoot, state.currentTask)
    : null;

  if (!state) {
    return '';
  }

  return mode === 'session-start'
    ? buildSessionStartMessage(state, task)
    : mode === 'post-write'
      ? buildPostWriteMessage(state, task)
      : buildPromptMessage(payload, state, task);
}

export async function readPayload() {
  if (process.stdin.isTTY) {
    return null;
  }

  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function resolveProjectRoot(env = process.env) {
  return env.RALPH_PROJECT_ROOT || process.cwd();
}

export function shouldBootstrapProject(text) {
  return classifyPromptIntent(text) !== 'ignore';
}

export async function maybeBootstrapProject(projectRoot, promptText) {
  const stateExists = existsSync(path.join(projectRoot, '.ralph', 'state.json'));
  if (stateExists) {
    return false;
  }

  await runRalphCommand(projectRoot, ['init']);
  await writeProjectPrd(projectRoot, promptText);
  await runRalphCommand(projectRoot, ['plan']);
  return true;
}

export async function writeProjectPrd(projectRoot, promptText) {
  const existingPrd = findProjectPrdPath(projectRoot);
  const target = path.join(projectRoot, '.ralph', 'prd.md');

  if (existingPrd) {
    await copyFile(existingPrd, target);
    return target;
  }

  await writeFile(target, buildBootstrapPrd(promptText), 'utf8');
  return target;
}

export function findProjectPrdPath(projectRoot) {
  for (const relative of ['PRD.md', 'prd.md', path.join('docs', 'PRD.md'), path.join('docs', 'prd.md')]) {
    const candidate = path.join(projectRoot, relative);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function buildBootstrapPrd(promptText) {
  const normalized = normalizePrompt(promptText);
  return [
    '# Product Requirements Document',
    '',
    '## Goal',
    normalized,
    '',
    '## Scope',
    '### In scope',
    `- ${normalized}`,
    '',
    '## Acceptance Criteria',
    `- Complete the requested work: ${normalized}`,
    '- Keep changes minimal and verifiable',
    '- Leave the project in a state where verification can run cleanly',
    '',
  ].join('\n');
}

export function buildSessionStartMessage(state, task) {
  const recommendation = recommendCommands('status', state, task);
  if (!task) {
    return `Ralph auto-routing ready: phase=${state.phase}. Recommended next command: ${recommendation.join(' -> ')}`;
  }

  return (
    `Ralph auto-routing ready: ${task.id} ${task.title} (${task.status}, phase=${state.phase}). ` +
    `Recommended next command: ${recommendation.join(' -> ')}`
  );
}

export function buildPostWriteMessage(state, task) {
  const recommendation = recommendCommands('post-write', state, task);
  if (!task) {
    return `Ralph post-write policy: ${recommendation.join(' -> ')}`;
  }

  return `Ralph post-write policy for ${task.id}: ${recommendation.join(' -> ')}`;
}

export function buildPromptMessage(payload, state, task) {
  const promptText = extractText(payload);
  const intent = classifyPromptIntent(promptText);
  if (intent === 'ignore') {
    return '';
  }

  const recommendation = recommendCommands(intent, state, task);
  const reason = reasonForIntent(intent, state, task);
  return (
    `Ralph auto-routing policy (${intent}): ${reason}. ` +
    `Recommended command path: ${recommendation.join(' -> ')}`
  );
}

export function extractText(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload.user_prompt === 'string') {
    return payload.user_prompt;
  }

  if (typeof payload.prompt === 'string') {
    return payload.prompt;
  }

  if (typeof payload.text === 'string') {
    return payload.text;
  }

  return JSON.stringify(payload);
}

export function matchesRalphIntent(text) {
  return classifyPromptIntent(text) !== 'ignore';
}

export function classifyPromptIntent(text) {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) {
    return 'ignore';
  }

  const hasRalphSignals = [
    'ralph',
    'prd',
    'acceptance criteria',
    'task graph',
    'resume',
    'blocked',
    'verify',
    'workflow',
    'feature',
    'bug',
    'fix',
    'implement',
  ].some((keyword) => normalized.includes(keyword));

  if (!hasRalphSignals) {
    return 'ignore';
  }

  if (
    ['verify', 'verification', 'test', 'tests', 'lint', 'typecheck', 'check'].some(
      (keyword) => normalized.includes(keyword),
    )
  ) {
    return 'verify';
  }

  if (
    ['plan', 'prd', 'acceptance criteria', 'task graph', 'scope', 'feature'].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return 'plan';
  }

  if (
    ['resume', 'continue', 'unblock', 'blocked', 'retry'].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return 'resume';
  }

  if (
    ['implement', 'build', 'fix', 'write code', 'run the next task', 'execute', 'bug'].some(
      (keyword) => normalized.includes(keyword),
    )
  ) {
    return 'run';
  }

  return 'status';
}

export function recommendCommands(intent, state, task) {
  const initPath = ['ralph init', 'ralph plan', 'ralph status'];
  if (state.phase === 'initialized' || state.phase === 'uninitialized') {
    return initPath;
  }

  if (intent === 'plan') {
    return state.phase === 'blocked'
      ? ['ralph status', 'ralph plan']
      : ['ralph plan', 'ralph status'];
  }

  if (intent === 'verify') {
    return ['ralph verify', 'ralph status'];
  }

  if (intent === 'resume') {
    if (state.phase === 'blocked') {
      return blockedNeedsReplan(state, task)
        ? ['ralph status', 'ralph plan']
        : ['ralph status', 'ralph resume', 'ralph run'];
    }
    return ['ralph status', 'ralph run'];
  }

  if (intent === 'run') {
    if (state.phase === 'blocked') {
      return blockedNeedsReplan(state, task)
        ? ['ralph status', 'ralph plan']
        : ['ralph status', 'ralph resume', 'ralph run'];
    }
    if (state.phase === 'planned' || state.phase === 'running') {
      return ['ralph status', 'ralph run'];
    }
  }

  if (intent === 'post-write') {
    return state.phase === 'blocked'
      ? ['ralph status', blockedNeedsReplan(state, task) ? 'ralph plan' : 'ralph resume']
      : ['ralph status', 'ralph verify'];
  }

  return ['ralph status'];
}

export function reasonForIntent(intent, state, task) {
  if (intent === 'plan') {
    return 'prompt mentions PRD / planning concepts';
  }
  if (intent === 'verify') {
    return 'prompt asks for validation or checks';
  }
  if (intent === 'resume') {
    return state.phase === 'blocked'
      ? 'prompt asks to continue blocked work'
      : 'prompt asks to continue an existing Ralph loop';
  }
  if (intent === 'run') {
    return task
      ? `prompt maps to execution and current task is ${task.id}`
      : 'prompt maps to execution work';
  }
  if (intent === 'post-write') {
    return 'files changed, so Ralph should refresh status before the next step';
  }
  return 'Ralph state is available for this repository';
}

function blockedNeedsReplan(state, task) {
  return (
    /context budget|split .*config|re-run `ralph plan`/i.test(state.nextAction) ||
    task?.splitRecommended === true
  );
}

function normalizePrompt(promptText) {
  return promptText.replace(/\s+/g, ' ').trim() || 'Describe the requested work';
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function readCurrentTask(projectRoot, taskId) {
  const graph = await readJsonPath(projectRoot, 'tasks.json');
  return graph?.tasks?.find((item) => item.id === taskId) ?? null;
}

async function readJsonPath(projectRoot, name) {
  return readJson(path.join(projectRoot, '.ralph', name));
}

async function runRalphCommand(projectRoot, args) {
  const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ralph-cli.mjs');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: projectRoot,
      stdio: 'ignore',
      shell: false,
      env: {
        ...process.env,
        RALPH_PROJECT_ROOT: projectRoot,
      },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`ralph ${args.join(' ')} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const message = await runHook(process.argv[2] ?? 'user-prompt');
  if (message) {
    process.stdout.write(`${message}\n`);
  }
}
