import type { ContextConfig } from '../schemas/config.js';
import type { Task } from '../schemas/tasks.js';

const CODE_SPAN_REGEX = /`([^`]+)`/g;
const PATH_REGEX =
  /(?:^|[\s(])((?:\.{1,2}[\\/])?[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)+(?:[\\/])?)/g;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'task',
  'build',
  'make',
  'this',
  'that',
  'then',
  'after',
  'before',
  'your',
  'their',
  'thing',
  'work',
  'change',
  'update',
  'implement',
  'support',
]);

export interface TaskContextAssessment {
  contextFiles: string[];
  estimatedLoad: number;
  crossLayer: boolean;
  splitRecommended: boolean;
}

export function assessTaskContext(
  task: Pick<Task, 'title' | 'description'>,
  config: ContextConfig,
  contextMapText: string = '',
): TaskContextAssessment {
  const explicitRefs = collectPathReferences(`${task.title}\n${task.description}`);
  const contextRefs = collectContextMapReferences(contextMapText);
  const inferredRefs =
    explicitRefs.length > 0 ? explicitRefs : inferRelevantContextRefs(task, contextRefs);
  const contextFiles = dedupePaths([...explicitRefs, ...inferredRefs]);
  const layers = new Set(contextFiles.map(layerForPath));
  const crossLayer = layers.size > 1;
  const scopeUnits = contextFiles.reduce(
    (sum, file) => sum + (file.endsWith('/') ? 2 : 1),
    0,
  );
  const estimatedLoad = roundLoad(
    Math.min(
      1,
      0.12 +
        Math.min(0.48, scopeUnits * 0.08) +
        Math.min(0.16, Math.max(0, layers.size - 1) * 0.08) +
        (crossLayer ? 0.1 : 0) +
        (task.description.trim() ? 0.04 : 0),
    ),
  );

  return {
    contextFiles,
    estimatedLoad,
    crossLayer,
    splitRecommended:
      contextFiles.length > config.split_if_files_over ||
      (config.split_if_cross_layer && crossLayer) ||
      estimatedLoad > config.max_estimated_load,
  };
}

export function formatTaskContext(task: Pick<
  Task,
  'contextFiles' | 'estimatedLoad' | 'crossLayer' | 'splitRecommended'
>): string[] {
  const lines: string[] = [];
  if (task.contextFiles.length > 0) {
    lines.push(`Context files: ${task.contextFiles.join(', ')}`);
  }
  lines.push(
    `Estimated context load: ${task.estimatedLoad.toFixed(2)}${task.splitRecommended ? ' (split recommended)' : ''}`,
  );
  if (task.crossLayer) {
    lines.push('Cross-layer change likely; keep edits especially focused.');
  }
  return lines;
}

export function collectPathReferences(text: string): string[] {
  const refs: string[] = [];

  for (const match of text.matchAll(CODE_SPAN_REGEX)) {
    const candidate = normalizePath(match[1]);
    if (isPathLike(candidate)) {
      refs.push(candidate);
    }
  }

  for (const match of text.matchAll(PATH_REGEX)) {
    const candidate = normalizePath(match[1]);
    if (isPathLike(candidate)) {
      refs.push(candidate);
    }
  }

  return dedupePaths(refs);
}

export function collectContextMapReferences(contextMapText: string): string[] {
  return collectPathReferences(contextMapText);
}

function inferRelevantContextRefs(
  task: Pick<Task, 'title' | 'description'>,
  contextRefs: string[],
): string[] {
  if (contextRefs.length === 0) {
    return [];
  }

  const keywords = tokenize(`${task.title} ${task.description}`);
  if (keywords.length === 0) {
    return [];
  }

  return contextRefs
    .map((ref) => ({ ref, score: scoreReference(ref, keywords) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref))
    .slice(0, 3)
    .map((entry) => entry.ref);
}

function scoreReference(ref: string, keywords: string[]): number {
  const refTokens = tokenize(ref);
  return keywords.reduce((score, keyword) => {
    return score + (refTokens.some((token) => tokenMatches(token, keyword)) ? 1 : 0);
  }, 0);
}

function tokenMatches(token: string, keyword: string): boolean {
  return (
    token === keyword ||
    token === `${keyword}s` ||
    keyword === `${token}s`
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function layerForPath(file: string): string {
  const normalized = file.replace(/\/+$/, '');
  const parts = normalized.split('/');
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts[0] === 'src' || parts[0] === 'tests') {
    return parts.slice(0, Math.min(2, parts.length)).join('/');
  }
  return parts[0];
}

function isPathLike(value: string): boolean {
  return value.includes('/') || /\.[a-z0-9]+$/i.test(value);
}

function normalizePath(value: string): string {
  return value.trim().replace(/[),.;:!?]+$/g, '').replace(/\\/g, '/');
}

function dedupePaths(paths: string[]): string[] {
  return [...new Set(paths.filter((path) => path.length > 0))];
}

function roundLoad(value: number): number {
  return Math.round(value * 100) / 100;
}
