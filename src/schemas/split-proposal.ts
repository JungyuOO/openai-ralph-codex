import { z } from 'zod';

export const SplitProposalSourceSchema = z.enum([
  'context-budget',
  'repeated-failure',
]);
export type SplitProposalSource = z.infer<typeof SplitProposalSourceSchema>;

export const SplitSuggestionSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  contextFiles: z.array(z.string()).default([]),
});
export type SplitSuggestion = z.infer<typeof SplitSuggestionSchema>;

export const SplitProposalSchema = z.object({
  taskId: z.string(),
  source: SplitProposalSourceSchema,
  reason: z.string(),
  generatedAt: z.string(),
  suggestions: z.array(SplitSuggestionSchema).min(1),
});
export type SplitProposal = z.infer<typeof SplitProposalSchema>;

export const SplitProposalFileSchema = z.object({
  version: z.literal(1),
  proposals: z.array(SplitProposalSchema).default([]),
});
export type SplitProposalFile = z.infer<typeof SplitProposalFileSchema>;

export function createEmptySplitProposalFile(): SplitProposalFile {
  return {
    version: 1,
    proposals: [],
  };
}
