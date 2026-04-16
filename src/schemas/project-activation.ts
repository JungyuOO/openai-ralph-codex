import { z } from 'zod';

export const ProjectActivationSchema = z.object({
  version: z.number().int().positive().default(1),
  enabled: z.boolean().default(true),
  source: z.enum(['manual']).default('manual'),
  enabledAt: z.string(),
});

export type ProjectActivation = z.infer<typeof ProjectActivationSchema>;

export function createProjectActivation(): ProjectActivation {
  return {
    version: 1,
    enabled: true,
    source: 'manual',
    enabledAt: new Date().toISOString(),
  };
}
