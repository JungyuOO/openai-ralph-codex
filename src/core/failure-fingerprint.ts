import type { VerifyCommandResult } from './verify-runner.js';
import {
  FailureFingerprintSchema,
  type FailureFingerprint,
  type FailureKind,
} from '../schemas/failure.js';

interface BaseFingerprintInput {
  summary: string;
  failedCommand?: string | null;
  exitCode?: number | null;
  firstErrorLine?: string | null;
  evidencePath?: string | null;
}

export function fingerprintContextBudgetFailure(
  summary: string,
): FailureFingerprint {
  return FailureFingerprintSchema.parse({
    kind: 'context_overflow',
    source: 'context-budget',
    summary,
    failedCommand: null,
    exitCode: null,
    firstErrorLine: summary,
    evidencePath: null,
  });
}

export function fingerprintRunnerFailure(input: {
  reason: string;
  stderr?: string;
}): FailureFingerprint {
  const firstErrorLine = firstMeaningfulLine(input.stderr, input.reason);
  return buildFingerprint({
    kind: classifyFailureKind(`${input.reason}\n${input.stderr ?? ''}`),
    source: 'runner',
    summary: summarize(input.reason, firstErrorLine),
    failedCommand: null,
    exitCode: extractExitCode(input.reason),
    firstErrorLine,
    evidencePath: null,
  });
}

export function fingerprintVerificationFailure(input: {
  result: VerifyCommandResult;
  evidencePath?: string;
}): FailureFingerprint {
  const firstErrorLine = firstMeaningfulLine(
    input.result.stderr,
    input.result.stdout,
    input.result.command,
  );
  return buildFingerprint({
    kind: classifyVerificationKind(input.result.command, firstErrorLine),
    source: 'verification',
    summary: summarize(
      `verification failed: ${input.result.command}`,
      firstErrorLine,
    ),
    failedCommand: input.result.command,
    exitCode: input.result.exitCode,
    firstErrorLine,
    evidencePath: input.evidencePath ?? null,
  });
}

function buildFingerprint(
  input: BaseFingerprintInput & {
    kind: FailureKind;
    source: FailureFingerprint['source'];
  },
): FailureFingerprint {
  return FailureFingerprintSchema.parse({
    kind: input.kind,
    source: input.source,
    summary: input.summary,
    failedCommand: input.failedCommand ?? null,
    exitCode: input.exitCode ?? null,
    firstErrorLine: input.firstErrorLine ?? null,
    evidencePath: input.evidencePath ?? null,
  });
}

function classifyVerificationKind(
  command: string,
  firstErrorLine: string | null,
): FailureKind {
  const text = `${command}\n${firstErrorLine ?? ''}`;
  if (/not recognized|command not found|enoent|eacces|permission/i.test(text)) {
    return 'tooling_or_env';
  }
  return 'verification_failure';
}

function classifyFailureKind(text: string): FailureKind {
  if (/context budget|too broad|too large|split|estimated load|cross-layer/i.test(text)) {
    return 'context_overflow';
  }
  if (/not recognized|command not found|enoent|eacces|permission|spawn|launch/i.test(text)) {
    return 'tooling_or_env';
  }
  if (/ambiguous|unclear|requirement|spec/i.test(text)) {
    return 'spec_ambiguity';
  }
  if (/flaky|timeout|timed out/i.test(text)) {
    return 'flaky_or_unknown';
  }
  return 'code_bug';
}

function summarize(reason: string, firstErrorLine: string | null): string {
  if (!firstErrorLine || normalize(firstErrorLine) === normalize(reason)) {
    return reason;
  }
  return `${reason}; first error: ${firstErrorLine}`;
}

function firstMeaningfulLine(...parts: Array<string | undefined | null>): string | null {
  for (const part of parts) {
    if (!part) {
      continue;
    }
    for (const line of part.split(/\r?\n/)) {
      const normalized = normalize(line);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return null;
}

function extractExitCode(reason: string): number | null {
  const match = reason.match(/exit (\d+)/i);
  return match ? Number(match[1]) : null;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
