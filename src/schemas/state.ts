import { z } from 'zod';
import { FailureKindSchema } from './failure.js';

export const PhaseSchema = z.enum([
  'uninitialized',
  'initialized',
  'planned',
  'running',
  'completed',
  'blocked',
]);
export type Phase = z.infer<typeof PhaseSchema>;

export const RouteStageSchema = z.enum([
  'ignore',
  'bootstrap',
  'plan',
  'run',
  'verify',
  'resume',
  'status',
]);
export type RouteStage = z.infer<typeof RouteStageSchema>;

export const LoopSessionSchema = z
  .object({
    active: z.boolean().default(false),
    enteredAt: z.string().nullable().default(null),
    lastRoutedAt: z.string().nullable().default(null),
    lastPromptHash: z.string().nullable().default(null),
    lastStage: RouteStageSchema.nullable().default(null),
    lastDecisionReason: z.string().nullable().default(null),
    lastTaskId: z.string().nullable().default(null),
    routingMode: z.enum(['full', 'latched']).default('full'),
  })
  .default({});
export type LoopSession = z.infer<typeof LoopSessionSchema>;

export const StateSchema = z.object({
  version: z.literal(1),
  phase: PhaseSchema,
  currentTask: z.string().nullable(),
  lastStatus: z.string(),
  retryCount: z.number().int().nonnegative(),
  nextAction: z.string(),
  loopSession: LoopSessionSchema.default({}),
  lastFailureKind: FailureKindSchema.nullable().default(null),
  lastFailureSummary: z.string().nullable().default(null),
  updatedAt: z.string(),
});

export type State = z.infer<typeof StateSchema>;

export function createInitialState(): State {
  const updatedAt = new Date().toISOString();
  return {
    version: 1,
    phase: 'initialized',
    currentTask: null,
    lastStatus: 'initialized',
    retryCount: 0,
    nextAction: 'run `ralph plan` to generate the initial task graph',
    loopSession: deriveLoopSession(undefined, 'initialized', null, updatedAt),
    lastFailureKind: null,
    lastFailureSummary: null,
    updatedAt,
  };
}

export function deriveLoopSession(
  base: Partial<LoopSession> | undefined,
  phase: Phase,
  currentTask: string | null,
  updatedAt: string,
): LoopSession {
  const active = phase === 'planned' || phase === 'running' || phase === 'blocked';

  return LoopSessionSchema.parse({
    ...base,
    active,
    enteredAt: active ? base?.enteredAt ?? updatedAt : null,
    lastRoutedAt: active ? base?.lastRoutedAt ?? null : null,
    lastPromptHash: active ? base?.lastPromptHash ?? null : null,
    lastStage: active ? base?.lastStage ?? null : null,
    lastDecisionReason: active ? base?.lastDecisionReason ?? null : null,
    lastTaskId: currentTask,
    routingMode: active ? base?.routingMode ?? 'full' : 'full',
  });
}
