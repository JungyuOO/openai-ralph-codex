export function runHook(mode?: string): Promise<string>;
export function readPayload(): Promise<unknown>;
export function buildSessionStartMessage(
  state: { phase: string; nextAction?: string },
  task: { id: string; title: string; status: string; splitRecommended?: boolean } | null,
): string;
export function buildPostWriteMessage(
  state: { phase: string; nextAction?: string },
  task: { id: string; splitRecommended?: boolean } | null,
): string;
export function buildPromptMessage(
  payload: unknown,
  state: { phase: string; nextAction?: string },
  task:
    | { id: string; status: string; title?: string; splitRecommended?: boolean }
    | null,
): string;
export function extractText(payload: unknown): string;
export function matchesRalphIntent(text: string): boolean;
export function classifyPromptIntent(text: string): string;
export function recommendCommands(
  intent: string,
  state: { phase: string; nextAction?: string },
  task: { id: string; status?: string; splitRecommended?: boolean } | null,
): string[];
export function reasonForIntent(
  intent: string,
  state: { phase: string; nextAction?: string },
  task: { id: string; status?: string } | null,
): string;
