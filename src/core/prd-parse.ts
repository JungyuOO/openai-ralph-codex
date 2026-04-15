import type { Task } from '../schemas/tasks.js';

export function extractTasksFromPrd(prd: string): Task[] {
  const acceptance = bulletsUnder(prd, /^##\s+Acceptance Criteria\s*$/im);
  const scope =
    acceptance.length > 0 ? [] : bulletsUnder(prd, /^###\s+In scope\s*$/im);
  const source = acceptance.length > 0 ? acceptance : scope;

  return source.map((line, i) => ({
    id: `T${String(i + 1).padStart(3, '0')}`,
    title: line,
    description: '',
    dependsOn: [],
    status: 'pending' as const,
    retryCount: 0,
    contextFiles: [],
    estimatedLoad: 0,
    crossLayer: false,
    splitRecommended: false,
    lastFailure: null,
  }));
}

export function bulletsUnder(text: string, headingRegex: RegExp): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (headingRegex.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^#{1,6}\s+/.test(line)) break;
    if (!inside) continue;
    const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}
