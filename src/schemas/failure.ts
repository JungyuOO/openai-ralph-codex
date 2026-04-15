import { z } from 'zod';

export const FailureKindSchema = z.enum([
  'code_bug',
  'spec_ambiguity',
  'context_overflow',
  'tooling_or_env',
  'verification_failure',
  'flaky_or_unknown',
]);

export type FailureKind = z.infer<typeof FailureKindSchema>;

export const FailureSourceSchema = z.enum([
  'runner',
  'verification',
  'context-budget',
]);

export type FailureSource = z.infer<typeof FailureSourceSchema>;

export const FailureFingerprintSchema = z.object({
  kind: FailureKindSchema,
  source: FailureSourceSchema,
  summary: z.string(),
  failedCommand: z.string().nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  firstErrorLine: z.string().nullable().default(null),
  evidencePath: z.string().nullable().default(null),
});

export type FailureFingerprint = z.infer<typeof FailureFingerprintSchema>;
