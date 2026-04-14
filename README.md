# Ralph

![Ralph](ralph.png)

Ralph is a Codex-native autonomous workflow for PRD-driven software delivery.

It is packaged as an installable CLI + Codex plugin so users can install it
globally and then use it inside their own projects without cloning this
repository first.

After installation, Ralph is designed to:

- bootstrap project-local Ralph state when needed
- plan tasks from a PRD
- keep work within a context budget
- run one bounded Codex task at a time
- verify automatically
- capture evidence
- recover through retry / blocked / resume flows

## Prerequisites

- [Codex CLI](https://www.npmjs.com/package/@openai/codex) installed and authenticated
- Node.js 18+

## Install

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

## How to use it

Go to **your own project** and run:

```bash
codex
```

Then start prompting normally.

If the prompt looks like Ralph-style work — PRD planning, feature work,
blocked-work recovery, verification, or long-horizon execution — the
installed plugin hooks auto-surface Ralph and route toward the right
workflow entrypoint.

## First prompt bootstrap

If the current project does not have `.ralph/` yet, Ralph can now lazily
bootstrap on the first relevant prompt:

1. `ralph init`
2. seed `.ralph/prd.md`
   - from `PRD.md`, `prd.md`, `docs/PRD.md`, or `docs/prd.md` if present
   - otherwise from the user's first prompt
3. `ralph plan`
4. continue through normal Ralph routing

This supports both:

- starting fresh in a new project
- adopting Ralph midway through an existing project

## Prompt routing policy

Once `.ralph/` exists, the plugin routes by prompt intent and current state:

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

1. initialize or bootstrap `.ralph/`
2. generate a task graph from `.ralph/prd.md`
3. schedule the next task that fits the context budget
4. run Codex on one task
5. run verification
6. write evidence to `.ralph/evidence/`
7. either complete, retry, block, or resume

## Key files

| File | Purpose |
|------|---------|
| `dist/cli.js` | built Ralph CLI |
| `plugins/openai-ralph-codex/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugins/openai-ralph-codex/hooks.json` | plugin hook definitions |
| `plugins/openai-ralph-codex/scripts/ralph-hook.mjs` | hook logic for routing + bootstrap |
| `plugins/openai-ralph-codex/scripts/ralph-cli.mjs` | plugin wrapper into the Ralph CLI |
| `.ralph/state.json` | current Ralph phase + next action |
| `.ralph/tasks.json` | persisted task graph |
| `.ralph/evidence/` | verification evidence |

## What “automatic” means right now

Ralph is now more automatic than a plain manual CLI:

- global install can register plugin + hooks
- Codex can auto-surface Ralph from prompt intent
- first relevant prompt can bootstrap `.ralph/`
- the workflow can then handle planning, verification, evidence capture,
  retry transitions, and resume guidance

What is **not** implemented yet:

- a permanent background daemon that silently manages every task forever
- fully automatic nested `ralph run` execution directly from hooks

So the current state is:

- globally installable
- plugin-packaged
- hook-routed
- lazy-bootstrap capable
- still command-driven for actual execution

## Verification

Main checks:

```bash
npm run typecheck
npm run build
npm test
```

Real Codex runner smoke:

```bash
npm run test:codex-smoke
```

## Fresh install smoke

A fresh isolated no-clone smoke run was verified for:

- global install
- home plugin installation
- Codex hook registration
- first relevant prompt bootstrap in a brand-new project directory
- initial task graph generation
