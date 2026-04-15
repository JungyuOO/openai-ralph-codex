# AGENTS.md

## Project purpose
This repository builds `openai-ralph-codex`, a Codex-native CLI harness for PRD-driven software delivery.

The goal is not to replace Codex.
The goal is to help Codex complete long-horizon projects more reliably through:
- task decomposition
- context budgeting
- durable state
- validation gates
- recovery policies
- better CLI observability

## Rules
- Keep commands and public CLI UX in English.
- Keep git commit messages in English, start them with a Conventional Commit prefix (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:` etc.), and follow the Lore commit protocol.
- Prefer small, composable modules over large files.
- Command handlers in `src/commands/` should stay thin.
- Core logic belongs in `src/core/`.
- Codex execution adapters belong in `src/runners/`.
- Validate all persisted state with Zod schemas in `src/schemas/`.
- Never hardcode user-specific paths.
- Treat `.ralph/` as runtime state, not as source-of-truth code.
- Before `git add -A`, update `.gitignore` for any new local/runtime/generated artifacts.
- Prefer minimal, correct changes over broad rewrites.
- If a task is too large, split it before implementation.
- For repo-local releases, add `docs/releases/vX.Y.Z.md` using a product-style structure: version header, short summary paragraph, Highlights, What's Changed, and Verification. Keep this rule repo-local only; do not ship it inside distributed plugin/runtime prompts or end-user assets.

## Implementation priorities
1. `init`
2. `plan`
3. `status`
4. `run`
5. `verify`
6. `resume`
7. recovery policies
8. richer reporting

## Quality bar
A task is not done when code is written.
A task is done only when:
- implementation is complete
- verification passes
- state is updated
- evidence is recorded
- the finished logical unit is committed; push the current tracked branch too unless the user says not to or push fails for auth/network reasons

## Repository map
- `src/commands/`: CLI entrypoints
- `src/core/`: planning, scheduling, verification, recovery
- `src/runners/`: Codex CLI / SDK integration
- `src/schemas/`: state and config validation
- `src/templates/`: generated markdown/json/yaml templates
- `src/prompts/`: Codex-facing prompt building blocks
- `.ralph/`: runtime working directory
