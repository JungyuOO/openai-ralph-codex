import { z } from 'zod';

export const PhaseSchema = z.enum([
  'uninitialized',
  'initialized',
  'planned',
  'running',
  'completed',
  'blocked',
]);
export type Phase = z.infer<typeof PhaseSchema>;

export const StateSchema = z.object({
  version: z.literal(1),
  phase: PhaseSchema,
  currentTask: z.string().nullable(),
  lastStatus: z.string(),
  retryCount: z.number().int().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string(),
});

export type State = z.infer<typeof StateSchema>;

export function createInitialState(): State {
  return {
    version: 1,
    phase: 'initialized',
    currentTask: null,
    lastStatus: 'initialized',
    retryCount: 0,
    nextAction: 'run `ralph plan` to generate the initial task graph',
    updatedAt: new Date().toISOString(),
  };
}
