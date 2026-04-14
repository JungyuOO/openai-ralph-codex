export function runHook(mode?: string): Promise<string>;
export function readPayload(): Promise<unknown>;
export function resolveProjectRoot(env?: Record<string, string | undefined>): string;
export function shouldBootstrapProject(text: string): boolean;
export function maybeBootstrapProject(
  projectRoot: string,
  promptText: string,
): Promise<boolean>;
export function writeBootstrapPrd(
  projectRoot: string,
  promptText: string,
): Promise<string>;
export function findProjectPrdPath(projectRoot: string): string | null;
export function buildBootstrapPrd(promptText: string): string;
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
