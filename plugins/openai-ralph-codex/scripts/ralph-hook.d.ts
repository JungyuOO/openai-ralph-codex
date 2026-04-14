export function runHook(mode?: string): Promise<string>;
export function readPayload(): Promise<unknown>;
export function buildSessionStartMessage(
  state: { phase: string },
  task: { id: string; title: string; status: string } | null,
): string;
export function buildPostWriteMessage(
  state: unknown,
  task: { id: string } | null,
): string;
export function buildPromptMessage(
  payload: unknown,
  state: { phase: string },
  task: { id: string; status: string } | null,
): string;
export function extractText(payload: unknown): string;
export function matchesRalphIntent(text: string): boolean;
