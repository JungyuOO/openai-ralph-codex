import { z } from 'zod';
import { FailureFingerprintSchema } from './failure.js';

export const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'blocked',
  'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const VerificationHintsSchema = z.object({
  commands: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});
export type VerificationHints = z.infer<typeof VerificationHintsSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  acceptanceCriteria: z.array(z.string()).default([]),
  verificationHints: VerificationHintsSchema.default({}),
  dependsOn: z.array(z.string()).default([]),
  status: TaskStatusSchema.default('pending'),
  retryCount: z.number().int().nonnegative().default(0),
  contextFiles: z.array(z.string()).default([]),
  estimatedLoad: z.number().min(0).max(1).default(0),
  crossLayer: z.boolean().default(false),
  splitRecommended: z.boolean().default(false),
  lastFailure: FailureFingerprintSchema.nullable().default(null),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskGraphSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  source: z.string(),
  tasks: z.array(TaskSchema),
});

export type TaskGraph = z.infer<typeof TaskGraphSchema>;

export function createEmptyTaskGraph(source: string): TaskGraph {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    tasks: [],
  };
}
