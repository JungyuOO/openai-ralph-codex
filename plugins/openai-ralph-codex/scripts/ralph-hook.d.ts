export type RalphRouteStage =
  | 'ignore'
  | 'bootstrap'
  | 'plan'
  | 'run'
  | 'verify'
  | 'resume'
  | 'status';

export interface RalphRouteContext {
  projectRoot: string;
  promptText: string;
  state: { phase?: string; currentTask?: string | null; nextAction?: string; lastStatus?: string } | null;
  task: { id: string; title?: string; status?: string; splitRecommended?: boolean } | null;
  hasState: boolean;
  hasProjectPrd: boolean;
}

export interface RalphRouteDecision {
  stage: RalphRouteStage;
  reason: string;
  source: 'classifier' | 'heuristic' | 'guard';
}

export function runHook(mode?: string): Promise<string>;
export function determineStage(
  context: RalphRouteContext,
  options?: {
    mode?: 'auto' | 'classifier' | 'heuristic';
    allowBootstrap?: boolean;
  },
): Promise<RalphRouteDecision>;
export function classifyWithCodex(
  context: RalphRouteContext,
): Promise<RalphRouteDecision | null>;
export function buildClassifierPrompt(context: RalphRouteContext): string;
export function classifyHeuristically(context: RalphRouteContext): RalphRouteStage;
export function readPayload(): Promise<unknown>;
export function resolveProjectRoot(env?: Record<string, string | undefined>): string;
export function shouldBootstrapProject(text: string): boolean;
export function maybeBootstrapProject(projectRoot: string, promptText: string): Promise<boolean>;
export function writeProjectPrd(projectRoot: string, promptText: string): Promise<string>;
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
  decision: RalphRouteDecision,
  state: { phase: string; nextAction?: string },
  task: { id: string; status?: string; splitRecommended?: boolean } | null,
): string;
export function extractText(payload: unknown): string;
export function matchesRalphIntent(text: string): boolean;
export function recommendCommands(
  stage: string,
  state: { phase: string; nextAction?: string },
  task: { id: string; status?: string; splitRecommended?: boolean } | null,
): string[];
