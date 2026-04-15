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
    return (
      `Ralph auto-bootstrap completed for this project. ` +
      `Stage classifier selected ${followupDecision.stage}. ` +
      `Recommended command path: ${recommendCommands(followupDecision.stage, nextState ?? { phase: 'planned' }, nextTask).join(' -> ')}`
    );
  }

  if (!state) {
    return '';
  }

  return buildPromptMessage(initialDecision, state, task);
}

export async function determineStage(context, options = {}) {
  const mode = options.mode ?? process.env.RALPH_ROUTER_MODE ?? 'auto';

  if (mode !== 'heuristic') {
    const classified = await classifyWithCodex(context);
    if (classified) {
      if (classified.stage === 'bootstrap' && options.allowBootstrap === false) {
        return {
          stage: classifyHeuristically({ ...context, hasState: true }),
          reason: 'bootstrap already completed for this hook turn',
          source: 'guard',
        };
      }
      return classified;
    }

    if (mode === 'classifier') {
      return {
        stage: 'ignore',
        reason: 'classifier mode enabled but no classifier decision was available',
        source: 'classifier',
      };
    }
  }

  return {
    stage: classifyHeuristically(context),
    reason: 'heuristic fallback',
    source: 'heuristic',
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
    const prompt = buildClassifierPrompt(context);
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

export function classifyHeuristically(context) {
  const normalized = context.promptText.toLowerCase().trim();
  if (!normalized) {
    return 'ignore';
  }

  const scores = {
    verify: scoreSignals(normalized, VERIFY_SIGNALS),
    plan:
      scoreSignals(normalized, PLAN_SIGNALS) +
      (looksLikeLargeScopedWork(normalized) ? 1 : 0),
    resume: scoreSignals(normalized, RESUME_SIGNALS),
    run:
      scoreSignals(normalized, EXECUTION_SIGNALS) +
      (hasConcreteAnchor(normalized) ? 1 : 0),
    status: scoreSignals(normalized, STATUS_SIGNALS),
  };

  if (!context.hasState && Math.max(scores.plan, scores.run, scores.verify, scores.resume) > 0) {
    return 'bootstrap';
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return 'ignore';
  }

  for (const stage of ['verify', 'plan', 'resume', 'run', 'status']) {
    if (scores[stage] === maxScore) {
      return stage;
    }
  }

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
  return env.RALPH_PROJECT_ROOT || process.cwd();
}

export function shouldBootstrapProject(text) {
  return classifyHeuristically({
    projectRoot: process.cwd(),
    promptText: text,
    state: null,
    task: null,
    hasState: false,
    hasProjectPrd: false,
  }) === 'bootstrap';
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
  return shouldBootstrapProject(text) || classifyHeuristically({
    projectRoot: process.cwd(),
    promptText: text,
    state: { phase: 'planned', nextAction: '', currentTask: null, lastStatus: '' },
    task: null,
    hasState: true,
    hasProjectPrd: false,
  }) !== 'ignore';
}

export function recommendCommands(stage, state, task) {
  const initPath = ['ralph init', 'ralph plan', 'ralph status'];
  if (stage === 'bootstrap' || state.phase === 'initialized' || state.phase === 'uninitialized') {
    return initPath;
  }

  if (stage === 'plan') {
    return state.phase === 'blocked'
      ? ['ralph status', 'ralph plan']
      : ['ralph plan', 'ralph status'];
  }

  if (stage === 'verify') {
    return ['ralph verify', 'ralph status'];
  }

  if (stage === 'resume') {
    if (state.phase === 'blocked') {
      return blockedNeedsReplan(state, task)
        ? ['ralph status', 'ralph plan']
        : ['ralph status', 'ralph resume', 'ralph run'];
    }
    return ['ralph status', 'ralph run'];
  }

  if (stage === 'run') {
    if (state.phase === 'blocked') {
      return blockedNeedsReplan(state, task)
        ? ['ralph status', 'ralph plan']
        : ['ralph status', 'ralph resume', 'ralph run'];
    }
    if (state.phase === 'planned' || state.phase === 'running') {
      return ['ralph status', 'ralph run'];
    }
  }

  if (stage === 'post-write') {
    return state.phase === 'blocked'
      ? ['ralph status', blockedNeedsReplan(state, task) ? 'ralph plan' : 'ralph resume']
      : ['ralph status', 'ralph verify'];
  }

  return ['ralph status'];
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

function scoreSignals(text, keywords) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}

function hasConcreteAnchor(text) {
  return (
    /(^|\s)(src\/|app\/|lib\/|tests\/|docs\/|packages\/|server\/)/.test(text) ||
    /\b[a-z0-9._/-]+\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|cs|cpp|c|swift|md|json|ya?ml)\b/.test(text) ||
    /#[0-9]+\b/.test(text) ||
    /:[0-9]+\b/.test(text)
  );
}

function looksLikeLargeScopedWork(text) {
  return (
    scoreSignals(text, LARGE_SCOPE_SIGNALS) > 0 ||
    /(build|create|implement|add)\s+(an?\s+)?(app|feature|workflow|dashboard|system|integration)/.test(text)
  );
}

const PLAN_SIGNALS = [
  'ralph',
  'prd',
  'acceptance criteria',
  'task graph',
  'plan this',
  'plan the',
  'break this down',
  'break it down',
  'scope this',
  'scope the',
  'roadmap',
  'user story',
  'user stories',
  'requirements',
  'spec this',
  'spec out',
  '요구사항',
  '명세',
  '스펙',
  '계획',
  '기획',
  '정리하자',
  '정리해줘',
  '정리부터',
  '나눠줘',
  '분해해줘',
  '쪼개줘',
  '작업으로 나눠',
  '要件',
  '仕様',
  '計画',
  '整理して',
  '分解して',
  '需求',
  '規格',
  '规格',
  '计划',
  '計劃',
  '拆分',
  '分解',
  '验收标准',
  '驗收標準',
  'criterios de aceptación',
  'requisitos',
  'planifica',
  'planifier',
  'exigences',
];

const VERIFY_SIGNALS = [
  'verify',
  'verification',
  'validate',
  'validation',
  'regression',
  'test',
  'tests',
  'lint',
  'typecheck',
  'check this',
  'check the current',
  'pass checks',
  '검증',
  '확인해줘',
  '체크해줘',
  '검사해줘',
  '先に検証',
  '検証',
  '確認して',
  '验证',
  '驗證',
  '校验',
  '校驗',
  'verifica',
];

const RESUME_SIGNALS = [
  'resume',
  'continue',
  'pick up',
  'blocked',
  'stuck',
  'retry',
  'unblock',
  "what's next",
  'what is next',
  'where did we leave off',
  '이어서',
  '이어서 하자',
  '이어서 해줘',
  '막힌',
  '막혀',
  '멈춘 작업',
  '계속하자',
  '계속해줘',
  '다음 뭐해',
  '続けよう',
  '続けて',
  '止まっていた',
  '再開',
  '继续',
  '繼續',
  '接着',
  '接著',
  '卡住了',
  'bloqueado',
];

const EXECUTION_SIGNALS = [
  'implement',
  'build',
  'fix',
  'write code',
  'run the next task',
  'execute',
  'add ',
  'create ',
  'update ',
  'refactor ',
  'ship ',
  'work on ',
  'tackle ',
  '구현',
  '만들어',
  '만들자',
  '구현해줘',
  '추가해줘',
  '업데이트해줘',
  '고쳐줘',
  '수정해줘',
  '진행해',
  '실행해',
  '作って',
  '実装',
  '修正して',
  '進めて',
  '做这个',
  '实现',
  '修复',
  '修正',
  '继续做',
  'implementar',
  'corrige',
  'corrigir',
];

const STATUS_SIGNALS = [
  'status',
  'state',
  'what is happening',
  'what should happen next',
  'current task',
  '현재 상태',
  '상태부터',
  '상태를 봐',
  '지금 상태',
  '状態',
  '今の状態',
  '当前状态',
  '現在狀態',
];

const LARGE_SCOPE_SIGNALS = [
  'feature',
  'authentication',
  'login',
  'password reset',
  'dashboard',
  'migration',
  'workflow',
  'integration',
  'service',
  'api',
  'system',
  '기능',
  '인증',
  '대시보드',
  '마이그레이션',
  '서비스',
  '시스템',
  '機能',
  '認証',
  'ダッシュボード',
  '迁移',
  '遷移',
  '认证',
  '認證',
  'servicio',
];

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
