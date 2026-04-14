import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const statePath = path.join(repoRoot, '.ralph', 'state.json');
const taskGraphPath = path.join(repoRoot, '.ralph', 'tasks.json');

export async function runHook(mode = 'user-prompt') {
  const payload = await readPayload();
  const state = await readJson(statePath);
  const task = state?.currentTask ? await readCurrentTask(state.currentTask) : null;

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

export function buildSessionStartMessage(state, task) {
  if (!task) {
    return `Ralph available: phase=${state.phase}. Suggested entrypoint: ralph status`;
  }

  return `Ralph available: ${task.id} ${task.title} (${task.status}). Suggested entrypoint: ralph status`;
}

export function buildPostWriteMessage(_state, task) {
  if (!task) {
    return 'Ralph reminder: review state with `ralph status` before the next run.';
  }

  return `Ralph reminder: after edits, review ${task.id} with \`ralph status\` or run \`ralph verify\`.`;
}

export function buildPromptMessage(payload, state, task) {
  const promptText = extractText(payload).toLowerCase();
  if (!matchesRalphIntent(promptText)) {
    return '';
  }

  if (!task) {
    return `Ralph workflow detected: current phase=${state.phase}. Suggested entrypoints: ralph init, ralph plan, ralph status`;
  }

  return (
    `Ralph workflow detected: current task ${task.id} (${task.status}). ` +
    'Suggested entrypoints: ralph status, ralph plan, ralph run'
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
  return [
    'ralph',
    'prd',
    'plan',
    'acceptance criteria',
    'task graph',
    'blocked',
    'resume',
    'verify',
  ].some((keyword) => text.includes(keyword));
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function readCurrentTask(taskId) {
  const graph = await readJson(taskGraphPath);
  return graph?.tasks?.find((item) => item.id === taskId) ?? null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const message = await runHook(process.argv[2] ?? 'user-prompt');
  if (message) {
    process.stdout.write(`${message}\n`);
  }
}
