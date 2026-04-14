# OpenAI Ralph Codex

![Ralph](./ralph.png)

OpenAI Ralph Codex packages a Ralph-style delivery loop for Codex:

- plan work from a PRD
- keep tasks small enough for the current context budget
- run Codex on one bounded task at a time
- verify results automatically
- capture evidence
- recover through retry / blocked / resume flows

This repository ships both:

1. a **CLI** (`ralph`)
2. a **repo-local Codex plugin package** (`plugins/openai-ralph-codex`)

## What this is

This is not a separate shell loop like `ralph.sh`.

Instead, this repo gives Codex a plugin-friendly Ralph surface backed by a
real Node CLI:

- `ralph init`
- `ralph plan`
- `ralph run`
- `ralph verify`
- `ralph resume`
- `ralph status`

The plugin wraps that CLI so Codex can use the Ralph workflow from inside
the repository.

## Prerequisites

- Node.js 18+
- Codex CLI installed and authenticated for real runner usage

## Setup

```bash
npm install
npm run build
```

That builds the CLI to `dist/cli.js`, which is what the plugin wrapper
uses.

## Global install path

If you want the package available as a Codex-facing CLI + home-local
plugin install path, use:

```bash
npm install -g openai-ralph-codex
```

The package now runs a postinstall step on global installs that tries to:

- copy the plugin into `~/plugins/openai-ralph-codex`
- update `~/.agents/plugins/marketplace.json`
- mark the plugin as `INSTALLED_BY_DEFAULT`

Manual fallback commands:

```bash
ralph plugin install
ralph plugin status
```

## Plugin package

This repository already includes a repo-local plugin package:

- plugin manifest: `plugins/openai-ralph-codex/.codex-plugin/plugin.json`
- marketplace entry: `.agents/plugins/marketplace.json`
- workflow skill: `plugins/openai-ralph-codex/skills/ralph-workflow/SKILL.md`
- wrapper script: `plugins/openai-ralph-codex/scripts/ralph-cli.mjs`

The wrapper runs the built CLI from the repository root:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs status
```

## How to use it in this repo

### Direct CLI usage

```bash
ralph init
ralph plan
ralph status
ralph run
```

Or with the built local wrapper:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs init
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs plan
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs status
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs run
```

### Typical flow

1. `ralph init` creates `.ralph/` working files from tracked examples
2. `ralph plan` generates `.ralph/tasks.json` from `.ralph/prd.md`
3. `ralph status` shows the current task, phase, and blocked hints
4. `ralph run` executes the next task that still fits the context budget
5. `ralph verify` runs verification only
6. `ralph resume` re-queues blocked or interrupted work

## What "automatic" means right now

The plugin gives Codex a dedicated Ralph workflow surface, but it is **not
yet an always-on background daemon** that silently takes over every task.

Today, the automatic part is:

- the plugin package is already present in the repo
- the Ralph workflow skill is packaged for Codex use
- once invoked, Ralph automatically handles:
  - task selection
  - context-budget enforcement
  - verification
  - evidence capture
  - retry / blocked transitions

What is **not** implemented yet:

- a permanent background agent that watches every repo event
- universal auto-routing hooks that force Codex to use Ralph on every task

So the current state is:

- **plugin-ready**
- **Codex-friendly**
- **workflow automation inside Ralph**
- **not yet fully daemonized / always-on**

## Current capabilities

- PRD → task graph generation
- task-level context estimation
- scheduler enforcement for oversize tasks
- standalone verification
- evidence capture under `.ralph/evidence/`
- retry budget and blocked-state handling
- resume path for interrupted or manually unblocked work
- repo-local Codex plugin packaging
- Windows live Codex runner smoke coverage

## Runtime files

Ralph keeps working state under `.ralph/`:

- `.ralph/config.yaml`
- `.ralph/prd.md`
- `.ralph/context-map.md`
- `.ralph/state.json`
- `.ralph/tasks.json`
- `.ralph/progress.md`
- `.ralph/evidence/`

Only the example templates should be committed by default.

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

## Workflow visualization

The repository also includes a GitHub Pages flow view under `workflow/`
that explains how Ralph moves through planning, execution, verification,
and recovery.
