import { exists, readJson, writeJson } from '../utils/fs.js';
import {
  createEmptySplitProposalFile,
  SplitProposalFileSchema,
  type SplitProposal,
  type SplitProposalSource,
} from '../schemas/split-proposal.js';
import type { Task } from '../schemas/tasks.js';

export async function loadSplitProposalFile(path: string) {
  if (!(await exists(path))) {
    return createEmptySplitProposalFile();
  }
  return SplitProposalFileSchema.parse(await readJson<unknown>(path));
}

export async function upsertSplitProposal(
  path: string,
  proposal: SplitProposal,
) {
  const current = await loadSplitProposalFile(path);
  const proposals = [
    ...current.proposals.filter((item) => item.taskId !== proposal.taskId),
    proposal,
  ];
  const next = SplitProposalFileSchema.parse({
    version: 1,
    proposals,
  });
  await writeJson(path, next);
  return next;
}

export async function findSplitProposal(path: string, taskId: string | null) {
  if (!taskId) {
    return null;
  }
  const file = await loadSplitProposalFile(path);
  return file.proposals.find((proposal) => proposal.taskId === taskId) ?? null;
}

export function buildSplitProposal(
  task: Pick<
    Task,
    | 'id'
    | 'title'
    | 'description'
    | 'acceptanceCriteria'
    | 'verificationHints'
    | 'contextFiles'
    | 'crossLayer'
  >,
  source: SplitProposalSource,
  reason: string,
): SplitProposal {
  const groups = groupContextFiles(task.contextFiles);
  const suggestions = [
    ...suggestionsFromAcceptanceCriteria(task),
    ...suggestionsFromGroups(task, groups),
    ...suggestVerificationFollowup(task),
  ];

  const deduped = dedupeSuggestions(suggestions).slice(0, 4);
  const fallback = deduped.length > 0 ? deduped : defaultSuggestions(task);

  return {
    taskId: task.id,
    source,
    reason,
    generatedAt: new Date().toISOString(),
    suggestions: fallback,
  };
}

function suggestionsFromAcceptanceCriteria(
  task: Pick<Task, 'title' | 'acceptanceCriteria'>,
) {
  if (task.acceptanceCriteria.length <= 1) {
    return [];
  }

  return task.acceptanceCriteria.slice(0, 3).map((criterion, index) => ({
    title: `${task.title} - slice ${index + 1}`,
    description: normalize(criterion),
    contextFiles: [],
  }));
}

function suggestionsFromGroups(
  task: Pick<Task, 'title' | 'contextFiles' | 'crossLayer'>,
  groups: Array<{ key: string; files: string[] }>,
) {
  if (groups.length <= 1) {
    return groups.flatMap((group) =>
      group.files.slice(0, 3).map((file) => ({
        title: `Update ${file} for ${task.title}`,
        description: `Limit the change to ${file} before widening scope.`,
        contextFiles: [file],
      })),
    );
  }

  return groups.map((group) => ({
    title: `Handle ${group.key} scope for ${task.title}`,
    description:
      group.files.length > 1
        ? `Focus first on ${group.files.join(', ')}.`
        : `Focus first on ${group.files[0]}.`,
    contextFiles: group.files,
  }));
}

function suggestVerificationFollowup(
  task: Pick<Task, 'title' | 'contextFiles' | 'verificationHints'>,
) {
  const hasVerificationFiles = task.contextFiles.some((file) =>
    /(^|\/)(test|tests|spec|__tests__)\b/i.test(file),
  );
  if (!hasVerificationFiles && task.verificationHints.commands.length === 0) {
    return [];
  }

  return [
    {
      title: `Verify ${task.title} separately`,
      description:
        task.verificationHints.commands.length > 0
          ? `Run: ${task.verificationHints.commands.join('; ')}`
          : 'Keep verification as its own follow-up step after the code change.',
      contextFiles: task.contextFiles.filter((file) =>
        /(^|\/)(test|tests|spec|__tests__)\b/i.test(file),
      ),
    },
  ];
}

function defaultSuggestions(
  task: Pick<Task, 'title' | 'contextFiles'>,
) {
  const primary = task.contextFiles.slice(0, 2);
  return [
    {
      title: `Implement core change for ${task.title}`,
      description: 'Handle the smallest code slice first.',
      contextFiles: primary.slice(0, 1),
    },
    {
      title: `Verify and finish ${task.title}`,
      description: 'Use the remaining files or verification follow-up as a separate step.',
      contextFiles: primary.slice(1),
    },
  ];
}

function groupContextFiles(files: string[]) {
  const byKey = new Map<string, string[]>();
  for (const file of files) {
    const key = layerKey(file);
    const group = byKey.get(key) ?? [];
    group.push(file);
    byKey.set(key, group);
  }
  return [...byKey.entries()].map(([key, groupedFiles]) => ({
    key,
    files: groupedFiles,
  }));
}

function layerKey(file: string): string {
  const normalized = file.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/');
  if (parts.length <= 1) {
    return normalized;
  }
  if (parts[0] === 'src' || parts[0] === 'tests') {
    return parts.slice(0, Math.min(2, parts.length)).join('/');
  }
  return parts[0];
}

function dedupeSuggestions(
  suggestions: Array<{ title: string; description: string; contextFiles: string[] }>,
) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${normalize(suggestion.title)}|${suggestion.contextFiles.join(',')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
