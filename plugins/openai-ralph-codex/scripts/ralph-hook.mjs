import { mkdtemp, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROUTE_STAGES = ['ignore', 'bootstrap', 'plan', 'run', 'verify', 'resume', 'status'];

export async function runHook(mode = 'user-prompt') {
  if (process.env.RALPH_DISABLE_HOOKS === '1') {
    return '';
  }

  const projectRoot = resolveProjectRoot();
  const activation = await readProjectActivation(projectRoot);
  if (!activation?.enabled) {
    return '';
  }
  const payload = await readPayload();
  const promptText = extractText(payload);

  if (mode === 'post-write') {
    const state = await readJsonPath(projectRoot, 'state.json');
    const task = state?.currentTask
      ? await readCurrentTask(projectRoot, state.currentTask)
      : null;
    return state ? buildPostWriteMessage(state, task) : '';
  }

  if (mode === 'session-start') {
    const state = await readJsonPath(projectRoot, 'state.json');
    const task = state?.currentTask
      ? await readCurrentTask(projectRoot, state.currentTask)
      : null;
    return state ? buildSessionStartMessage(state, task) : '';
  }

  const state = await readJsonPath(projectRoot, 'state.json');
  const task = state?.currentTask
    ? await readCurrentTask(projectRoot, state.currentTask)
    : null;
  const projectPrdPath = findProjectPrdPath(projectRoot);
  const context = {
    projectRoot,
    promptText,
    state,
    task,
    hasState: Boolean(state),
    hasProjectPrd: Boolean(projectPrdPath),
  };

  const initialDecision = await determineStage(context);
  if (initialDecision.stage === 'ignore') {
    return '';
  }

  if (initialDecision.stage === 'bootstrap') {
    const didBootstrap = await maybeBootstrapProject(projectRoot, promptText);
    if (!didBootstrap) {
      return '';
    }
    const nextState = await readJsonPath(projectRoot, 'state.json');
    const nextTask = nextState?.currentTask
      ? await readCurrentTask(projectRoot, nextState.currentTask)
      : null;
    const followupDecision = await determineStage(
      {
        ...context,
        state: nextState,
        task: nextTask,
        hasState: true,
      },
      { allowBootstrap: false },
    );
    if (nextState && followupDecision.stage !== 'ignore') {
      await persistLoopSession(projectRoot, nextState, followupDecision, promptText);
    }
    return (
      `Ralph auto-bootstrap completed for this project. ` +
      `Stage classifier selected ${followupDecision.stage}. ` +
      `Recommended command path: ${recommendCommands(followupDecision.stage, nextState ?? { phase: 'planned' }, nextTask).join(' -> ')}`
    );
  }

  if (!state) {
    return '';
  }

  await persistLoopSession(projectRoot, state, initialDecision, promptText);
  return buildPromptMessage(initialDecision, state, task);
}

export async function determineStage(context, options = {}) {
  const mode = options.mode ?? process.env.RALPH_ROUTER_MODE ?? 'auto';

  if (mode === 'heuristic') {
    return {
      stage: 'ignore',
      reason: 'heuristic routing has been removed; Codex stage classifier is required',
      source: 'classifier',
    };
  }

  const classified = await classifyWithCodex(context);
  if (classified) {
    if (classified.stage === 'bootstrap' && options.allowBootstrap === false) {
      return {
        stage: 'ignore',
        reason: 'bootstrap already completed for this hook turn',
        source: 'guard',
      };
    }
    return classified;
  }

  return {
    stage: 'ignore',
    reason: 'no classifier decision available',
    source: 'classifier',
  };
}

export async function classifyWithCodex(context) {
  if (process.env.RALPH_DISABLE_CLASSIFIER === '1') {
    return null;
  }

  const promptText = context.promptText.trim();
  if (!promptText) {
    return { stage: 'ignore', reason: 'empty prompt', source: 'classifier' };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ralph-stage-'));
  const outputFile = path.join(tempDir, 'decision.json');
  try {
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '--color',
      'never',
      '-C',
      context.projectRoot,
      '-o',
      outputFile,
    ];
    const prompt = resolveClassifierPrompt(context);
    const result = await runExternalCommand(resolveCodexCommand(), args, {
      cwd: context.projectRoot,
      stdin: prompt,
      env: {
        ...process.env,
        RALPH_DISABLE_HOOKS: '1',
      },
      timeoutMs: Number(process.env.RALPH_STAGE_CLASSIFIER_TIMEOUT_MS || 20000),
    });

    if (result.exitCode !== 0 || !existsSync(outputFile)) {
      return null;
    }

    const parsed = JSON.parse(await readFile(outputFile, 'utf8'));
    if (!ROUTE_STAGES.includes(parsed.stage)) {
      return null;
    }

    return {
      stage: parsed.stage,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'classifier decision',
      source: 'classifier',
    };
  } catch {
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function buildClassifierPrompt(context) {
  const stateSummary = context.state
    ? {
        phase: context.state.phase,
        currentTask: context.state.currentTask,
        nextAction: context.state.nextAction,
        lastStatus: context.state.lastStatus,
      }
    : { phase: 'none', currentTask: null, nextAction: null, lastStatus: null };

  const taskSummary = context.task
    ? {
        id: context.task.id,
        title: context.task.title,
        status: context.task.status,
        splitRecommended: context.task.splitRecommended,
      }
    : null;

  return [
    'You are a stage classifier for OPENAI-Ralph-codex.',
    'Classify the user request into exactly one stage:',
    '- ignore: unrelated to the Ralph loop',
    '- bootstrap: no .ralph state exists yet, but the prompt should start Ralph in this project',
    '- plan: the prompt asks for PRD shaping, decomposition, requirements, or planning before execution',
    '- run: the prompt asks to implement or execute the next bounded task',
    '- verify: the prompt asks for validation, tests, lint, or confirmation before continuing',
    '- resume: the prompt asks to continue blocked/interrupted work or figure out how to proceed from a blocked state',
    '- status: the prompt asks to inspect current Ralph state before deciding what to do',
    'Important rules:',
    '- Support multilingual prompts. The user may write in English, Korean, Japanese, Chinese, or mixed language.',
    '- Prefer bootstrap when .ralph state is missing and the prompt clearly describes project work that should enter the Ralph loop.',
    '- Prefer plan over run for broad feature-sized work or decomposition requests.',
    '- Prefer ignore for casual chat or requests unrelated to software delivery.',
    'Return JSON only with this exact shape:',
    '{"stage":"ignore|bootstrap|plan|run|verify|resume|status","reason":"short explanation"}',
    '',
    `Project has .ralph state: ${context.hasState ? 'yes' : 'no'}`,
    `Project has PRD-like file: ${context.hasProjectPrd ? 'yes' : 'no'}`,
    `State summary: ${JSON.stringify(stateSummary)}`,
    `Task summary: ${JSON.stringify(taskSummary)}`,
    `User prompt: ${JSON.stringify(context.promptText)}`,
    '',
    'Do not use tools.',
  ].join('\n');
}

export function buildContinuationClassifierPrompt(context) {
  const stateSummary = context.state
    ? {
        phase: context.state.phase,
        currentTask: context.state.currentTask,
        nextAction: context.state.nextAction,
        lastFailureSummary: context.state.lastFailureSummary ?? null,
      }
    : { phase: 'none', currentTask: null, nextAction: null, lastFailureSummary: null };

  return [
    'You are a continuation stage classifier for an already-active OPENAI-Ralph-codex loop.',
    'Choose exactly one stage for the user message:',
    '- ignore',
    '- plan',
    '- run',
    '- verify',
    '- resume',
    '- status',
    'Important rules:',
    '- Assume the user is still working inside the current Ralph loop unless the new message is clearly unrelated.',
    '- Prefer status when the safest next step is to inspect the current loop state before acting.',
    '- Support multilingual prompts.',
    'Return JSON only with this exact shape:',
    '{"stage":"ignore|plan|run|verify|resume|status","reason":"short explanation"}',
    '',
    `Current loop state: ${JSON.stringify(stateSummary)}`,
    `User prompt: ${JSON.stringify(context.promptText)}`,
    '',
    'Do not use tools.',
  ].join('\n');
}

export function isLoopSessionLatched(state) {
  if (!state) {
    return false;
  }
  if (typeof state.loopSession?.active === 'boolean') {
    return state.loopSession.active;
  }
  return ['planned', 'running', 'blocked'].includes(state.phase);
}

export function resolveClassifierPrompt(context) {
  return isLoopSessionLatched(context.state)
    ? buildContinuationClassifierPrompt(context)
    : buildClassifierPrompt(context);
}

export function classifyHeuristically(context) {
  void context;
  return 'ignore';
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
  if (env.RALPH_PROJECT_ROOT) {
    return env.RALPH_PROJECT_ROOT;
  }
  return findEnabledProjectRoot(process.cwd()) ?? process.cwd();
}

export function shouldBootstrapProject(text) {
  void text;
  return false;
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
  for (const relative of [
    'PRD.md',
    'prd.md',
    path.join('docs', 'PRD.md'),
    path.join('docs', 'prd.md'),
  ]) {
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

export function buildPromptMessage(decision, state, task) {
  if (decision.stage === 'ignore') {
    return '';
  }

  const recommendation = recommendCommands(decision.stage, state, task);
  return (
    `Ralph stage classifier (${decision.stage}): ${decision.reason}. ` +
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
  void text;
  return false;
}

export function recommendCommands(stage, state, task) {
  if (stage === 'bootstrap' || state.phase === 'initialized' || state.phase === 'uninitialized') {
    return ['orc init', 'orc plan', 'orc status'];
  }

  if (stage === 'plan') {
    return state.phase === 'blocked'
      ? ['orc status', 'orc plan']
      : ['orc plan', 'orc status'];
  }

  if (stage === 'verify') {
    return ['orc verify', 'orc status'];
  }

  if (stage === 'resume') {
    if (state.phase === 'blocked') {
      return blockedNeedsReplan(state, task)
        ? ['orc status', 'orc plan']
        : ['orc status', 'orc resume', 'orc run'];
    }
    return ['orc status', 'orc run'];
  }

  if (stage === 'run') {
    if (state.phase === 'blocked') {
      return blockedNeedsReplan(state, task)
        ? ['orc status', 'orc plan']
        : ['orc status', 'orc resume', 'orc run'];
    }
    if (state.phase === 'planned' || state.phase === 'running') {
      return ['orc status', 'orc run'];
    }
  }

  if (stage === 'post-write') {
    return state.phase === 'blocked'
      ? ['orc status', blockedNeedsReplan(state, task) ? 'orc plan' : 'orc resume']
      : ['orc status', 'orc verify'];
  }

  return ['orc status'];
}

function blockedNeedsReplan(state, task) {
  return /context budget|split .*config|re-run `(?:ralph|orc) plan`/i.test(state.nextAction) || task?.splitRecommended === true;
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

export function findEnabledProjectRoot(startDir) {
  let current = path.resolve(startDir);

  while (true) {
    const activationPath = path.join(current, '.ralph', 'project.json');
    if (existsSync(activationPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function readProjectActivation(projectRoot) {
  const activation = await readJson(path.join(projectRoot, '.ralph', 'project.json'));
  return activation && activation.enabled === true ? activation : null;
}

async function readCurrentTask(projectRoot, taskId) {
  const graph = await readJsonPath(projectRoot, 'tasks.json');
  return graph?.tasks?.find((item) => item.id === taskId) ?? null;
}

async function readJsonPath(projectRoot, name) {
  return readJson(path.join(projectRoot, '.ralph', name));
}

async function writeJsonPath(projectRoot, name, data) {
  await writeFile(
    path.join(projectRoot, '.ralph', name),
    JSON.stringify(data, null, 2) + '\n',
    'utf8',
  );
}

async function persistLoopSession(projectRoot, state, decision, promptText) {
  const updatedAt = new Date().toISOString();
  const routingMode = isLoopSessionLatched(state) ? 'latched' : 'full';
  const next = {
    ...state,
    loopSession: {
      ...(state.loopSession ?? {}),
      active: ['planned', 'running', 'blocked'].includes(state.phase),
      enteredAt:
        state.loopSession?.enteredAt ??
        (['planned', 'running', 'blocked'].includes(state.phase) ? updatedAt : null),
      lastRoutedAt: updatedAt,
      lastPromptHash: hashPrompt(promptText),
      lastStage: decision.stage,
      lastDecisionReason: decision.reason,
      lastTaskId: state.currentTask ?? null,
      routingMode,
    },
  };
  await writeJsonPath(projectRoot, 'state.json', next);
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
        reject(new Error(`orc ${args.join(' ')} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function runExternalCommand(command, args, options) {
  const useShell = process.platform === 'win32' && (command.endsWith('.cmd') || command.endsWith('.bat') || !command.includes('.'));
  return new Promise((resolve, reject) => {
    const child = spawn(
      useShell ? buildShellCommand(command, args) : command,
      useShell ? [] : args,
      {
        cwd: options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: useShell,
        env: options.env,
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('stage classifier timed out'));
    }, options.timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });

    child.stdin.end(options.stdin);
  });
}

function resolveCodexCommand() {
  if (process.env.RALPH_ROUTER_CLI) {
    return process.env.RALPH_ROUTER_CLI;
  }
  return process.platform === 'win32' ? 'codex.cmd' : 'codex';
}

function buildShellCommand(command, args) {
  return [command, ...args].map(quoteForShell).join(' ');
}

function hashPrompt(promptText) {
  const normalized = promptText.replace(/\s+/g, ' ').trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function quoteForShell(value) {
  if (/^[A-Za-z0-9_./:\\=-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const message = await runHook(process.argv[2] ?? 'user-prompt');
  if (message) {
    process.stdout.write(`${message}\n`);
  }
}
