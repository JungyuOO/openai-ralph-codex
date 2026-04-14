# Product Requirements Document

## Goal
Build a Codex-native CLI harness that turns PRDs into resumable, validation-gated development loops.

## Problem
Codex is strong at code correctness, but long-running work still needs better orchestration:
- smaller task sizing
- durable project state
- context control
- structured verification
- recovery policies
- better CLI visibility

## Scope
### In scope
- CLI commands: init, plan, run, verify, resume, status
- `.ralph/` runtime state
- PRD decomposition into task graph
- Codex CLI integration
- basic recovery logic

### Out of scope
- full TUI dashboard for v1
- remote sync
- multi-user collaboration
- GUI app

## Acceptance Criteria
- `ralph init` creates a working project scaffold
- `ralph plan` generates a valid task graph from a PRD
- `ralph run` executes a task via Codex CLI
- `ralph verify` runs configured validation commands
- `ralph status` shows current phase and next action
- runtime state persists across interrupted sessions