import { z } from 'zod';

export const DistilledMemoryCategorySchema = z.enum([
  'plan',
  'success',
  'failure',
  'context',
]);
export type DistilledMemoryCategory = z.infer<typeof DistilledMemoryCategorySchema>;

export const DistilledMemoryEntrySchema = z.object({
  category: DistilledMemoryCategorySchema,
  summary: z.string(),
  updatedAt: z.string(),
});
export type DistilledMemoryEntry = z.infer<typeof DistilledMemoryEntrySchema>;

export const DistilledMemorySchema = z.object({
  version: z.literal(1),
  entries: z.array(DistilledMemoryEntrySchema).default([]),
});
export type DistilledMemory = z.infer<typeof DistilledMemorySchema>;

export function createInitialDistilledMemory(): DistilledMemory {
  return {
    version: 1,
    entries: [],
  };
}
