import { z } from 'zod';

export const RunnerConfigSchema = z
  .object({
    type: z.enum(['codex-cli']).default('codex-cli'),
    command: z.string().default('codex'),
    args: z.array(z.string()).default([]),
  })
  .default({});

export const ProjectConfigSchema = z
  .object({
    language: z.string().default('en'),
    prd_path: z.string().default('.ralph/prd.md'),
    tasks_path: z.string().default('.ralph/tasks.json'),
    state_path: z.string().default('.ralph/state.json'),
    progress_path: z.string().default('.ralph/progress.md'),
  })
  .default({});

export const ContextConfigSchema = z
  .object({
    max_estimated_load: z.number().min(0).max(1).default(0.65),
    split_if_files_over: z.number().int().nonnegative().default(8),
    split_if_cross_layer: z.boolean().default(true),
  })
  .default({});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;

export const VerificationConfigSchema = z
  .object({
    commands: z.array(z.string()).default([]),
    strict: z.boolean().default(false),
  })
  .default({});

export const RecoveryConfigSchema = z
  .object({
    max_retries_per_task: z.number().int().default(2),
    retry_with_fresh_context: z.boolean().default(true),
    split_on_repeated_failure: z.boolean().default(true),
    replan_on_blocked: z.boolean().default(true),
  })
  .default({});

export const ConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  runner: RunnerConfigSchema,
  project: ProjectConfigSchema,
  context: ContextConfigSchema,
  verification: VerificationConfigSchema,
  recovery: RecoveryConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;
