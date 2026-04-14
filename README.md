# Ralph

![Ralph](ralph.png)

Ralph is a Codex-native autonomous workflow that turns a user's prompt
into a repeatable PRD-driven loop:

- initialize project-local Ralph state when needed
- plan tasks from a PRD
- keep work small enough for the current context budget
- run Codex on one bounded task at a time
- verify automatically
- capture evidence
- recover through retry / blocked / resume flows

This implementation is packaged as both:

- a CLI: `ralph`
- a Codex plugin: `openai-ralph-codex`

## What this repository provides

This is **not** a bash loop like `ralph.sh`.

Instead, this repo provides:

- a Node CLI for Ralph commands
- a repo/home-local Codex plugin package
- Codex hook registration for auto-surfacing Ralph
- first-prompt lazy bootstrap for projects that do not yet have `.ralph/`

## Prerequisites

- [Codex CLI](https://www.npmjs.com/package/@openai/codex) installed and authenticated
- Node.js 18+

## Install

Recommended:

```bash
npm install -g @openai/codex openai-ralph-codex
```

During global install, `openai-ralph-codex` now tries to:

- copy the plugin into `~/plugins/openai-ralph-codex`
- update `~/.agents/plugins/marketplace.json`
- merge Ralph-managed entries into `~/.codex/hooks.json`

Manual fallback:

```bash
ralph plugin install
ralph plugin status
```

## How it works in a normal project

After global install, go to **your own project** and run:

```bash
codex
```

Then start working normally.

If your prompt looks like Ralph-style work — for example PRD planning,
feature work, blocked-work recovery, or verification — the plugin hooks
auto-surface Ralph and try to route into the right command path.

### If `.ralph/` does not exist yet

Ralph now lazily bootstraps the project on the first relevant prompt:

1. `ralph init`
2. seed `.ralph/prd.md`
   - from an existing `PRD.md` / `prd.md` / `docs/PRD.md` / `docs/prd.md`
   - or from the user's first prompt
3. `ralph plan`
4. continue with normal Ralph routing

### If `.ralph/` already exists

Ralph routes based on prompt intent and current state:

- PRD / planning prompts → `ralph plan`
- execution prompts → `ralph run`
- verification prompts → `ralph verify`
- blocked / continue prompts → `ralph status` then `ralph resume` or `ralph plan`

## Core commands

```bash
ralph init
ralph plan
ralph run
ralph verify
ralph resume
ralph status
ralph plugin install
ralph plugin status
```

## Typical loop

1. Ralph initializes or reuses `.ralph/`
2. Ralph plans a task graph from `.ralph/prd.md`
3. The scheduler chooses the next task that still fits the budget
4. Codex executes one bounded task
5. Verification runs
6. Evidence is written under `.ralph/evidence/`
7. Ralph either:
   - completes the task
   - queues a retry
   - blocks and waits for resume / replan

## Key files

| File | Purpose |
|------|---------|
| `src/commands/` | Ralph CLI entrypoints |
| `src/core/` | planning, scheduling, verify, resume logic |
| `plugins/openai-ralph-codex/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugins/openai-ralph-codex/hooks.json` | plugin hook definitions |
| `plugins/openai-ralph-codex/scripts/ralph-hook.mjs` | prompt/session/write hook logic |
| `plugins/openai-ralph-codex/scripts/ralph-cli.mjs` | plugin wrapper into the Ralph CLI |
| `.ralph/state.json` | project-local Ralph phase + next action |
| `.ralph/tasks.json` | task graph |
| `.ralph/evidence/` | verification evidence |

## What “automatic” means here

Ralph is now significantly more automatic than a plain manual CLI:

- install can register plugin + hooks
- Codex can auto-surface Ralph based on prompt intent
- first relevant prompt can bootstrap `.ralph/` for a project
- the workflow then automatically handles planning, verification, retries, and resume guidance

What is **still not** implemented:

- a permanent background daemon that silently manages every task forever
- fully automatic nested execution of `ralph run` directly from hooks

So the current state is:

- plugin-ready
- globally installable
- hook-routed
- lazy-bootstrap capable
- still command-driven for the actual execution lane

## Verification

Main repo checks:

```bash
npm run typecheck
npm run build
npm test
```

Real Codex runner smoke:

```bash
npm run test:codex-smoke
```

## Fresh install smoke result

A fresh isolated smoke run was verified for:

- `npm install -g openai-ralph-codex`
- home plugin installation
- hook registration
- first-prompt bootstrap of `.ralph/`
- initial task graph generation in a brand-new project directory

## Flowchart

The repository also includes a GitHub Pages flow view and source under
`workflow/` that visualizes the Ralph pipeline architecture.
