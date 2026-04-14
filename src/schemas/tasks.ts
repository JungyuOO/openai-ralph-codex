import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'blocked',
  'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  dependsOn: z.array(z.string()).default([]),
  status: TaskStatusSchema.default('pending'),
  retryCount: z.number().int().nonnegative().default(0),
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
