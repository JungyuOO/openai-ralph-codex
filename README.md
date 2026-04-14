# openai-ralph-codex

`openai-ralph-codex` is a Codex-native CLI harness for PRD-driven software delivery.

It helps a repo move through a repeatable loop:

1. initialize local Ralph state
2. turn a PRD into a task graph
3. choose the next task that fits the context budget
4. run Codex on that task
5. verify the result
6. capture evidence and recover from failures

## Current CLI commands

- `ralph init` — create working files from tracked `.ralph/*.example` templates
- `ralph plan` — parse `.ralph/prd.md` into `.ralph/tasks.json`
- `ralph run` — execute the next runnable task through the configured runner
- `ralph run --dry-run` — print the runner prompt without launching Codex
- `ralph verify` — run configured verification commands without mutating state
- `ralph resume` — re-queue blocked or interrupted work
- `ralph status` — print the current Ralph phase, task, and next action

## What is implemented today

- PRD bullet extraction into a persisted task graph
- context-budget estimation per task
- scheduler enforcement that blocks work that is too broad
- automatic verification after `ralph run`
- verification evidence capture under `.ralph/evidence/`
- retry / blocked recovery flow
- standalone verification command
- real Codex CLI smoke coverage for the runner path

## Platform note

The CLI is a Node-based command-line tool and is intended to run on:

- Windows
- macOS
- Linux

Current validation status:

- Windows live Codex runner smoke: verified
- Standard unit/integration test suite: platform-neutral Node/Vitest coverage
- macOS/Linux live Codex smoke: supported by the same runner path, but not directly validated in this repository yet

## Requirements

- Node.js 18+
- a working `codex` CLI installation for real runner usage
- Codex auth configured locally if you want to run the live smoke test

## Development setup

```bash
npm install
npm run typecheck
npm run build
npm test
```

## Quick start

```bash
npm run build
node dist/cli.js init
node dist/cli.js plan
node dist/cli.js status
node dist/cli.js run --dry-run
```

If you install the package as a CLI, the same flow is:

```bash
ralph init
ralph plan
ralph status
ralph run
```

## Real Codex runner smoke

The default test suite keeps the live Codex smoke test skipped so normal CI/dev runs stay offline-safe.

Run it explicitly when you change runner launch logic:

```bash
npm run test:codex-smoke
```

This executes a real `codex exec` session and verifies that the repo can drive the local Codex CLI non-interactively.

## Runtime files

Ralph keeps local working state under `.ralph/`:

- `.ralph/config.yaml`
- `.ralph/prd.md`
- `.ralph/context-map.md`
- `.ralph/state.json`
- `.ralph/tasks.json`
- `.ralph/progress.md`
- `.ralph/evidence/`

Only the example templates should be committed by default.

## Verification expectations

Before finishing a logical unit of work in this repo, run:

```bash
npm run typecheck
npm run build
npm test
```

And when runner launch logic changes:

```bash
npm run test:codex-smoke
```
