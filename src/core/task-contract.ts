import type { Task, VerificationHints } from '../schemas/tasks.js';

export interface CompiledTaskContract {
  acceptanceCriteria: string[];
  verificationHints: VerificationHints;
}

export function compileTaskContract(
  task: Pick<Task, 'title' | 'description' | 'acceptanceCriteria'>,
): CompiledTaskContract {
  const acceptanceCriteria =
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map(normalize).filter(Boolean)
      : [normalize(task.title)].filter(Boolean);

  const text = `${task.title}\n${task.description}\n${acceptanceCriteria.join('\n')}`;
  const verificationHints: VerificationHints = {
    commands: collectCommandHints(text),
    notes: collectVerificationNotes(text),
  };

  return {
    acceptanceCriteria,
    verificationHints,
  };
}

function collectCommandHints(text: string): string[] {
  const lower = text.toLowerCase();
  const commands: string[] = [];

  if (/\btypecheck\b|typescript|tsc/.test(lower)) {
    commands.push('npm run typecheck');
  }
  if (/\blint\b|eslint/.test(lower)) {
    commands.push('npm run lint');
  }
  if (/\btest\b|\btests\b|vitest|jest/.test(lower)) {
    commands.push('npm test');
  }
  if (/\bbuild\b|compile|bundle/.test(lower)) {
    commands.push('npm run build');
  }

  return dedupe(commands);
}

function collectVerificationNotes(text: string): string[] {
  const lower = text.toLowerCase();
  const notes: string[] = [];

  if (/verify|validation|confirm|manual/.test(lower)) {
    notes.push('Confirm the task outcome before marking it complete.');
  }
  if (/browser|ui|visual|screenshot/.test(lower)) {
    notes.push('Include a browser or visual check if the change affects UI behavior.');
  }
  if (/api|endpoint|response|request/.test(lower)) {
    notes.push('Check the affected request/response behavior when verification runs.');
  }

  return dedupe(notes);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
