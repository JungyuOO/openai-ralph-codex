# OPENAI-Ralph-codex

<p align="center">
  <img src="ralph.png" alt="Ralph" width="300" />
</p>

OPENAI-Ralph-codex is a Codex-native autonomous delivery loop for PRD-driven work.

It takes the original Ralph idea - persistent state, repeated bounded work,
fresh execution, and completion pressure - and improves the structure
around it so it works better as a Codex plugin product:

- structured project-local state
- explicit task graph planning
- context-budgeted task selection
- verification as a real completion gate
- persisted evidence on disk
- retry / blocked / resume behavior
- plugin + hook integration so Ralph can surface itself inside normal Codex usage

## What this is

Ralph is not meant to replace Codex.

Codex remains the execution engine.
Ralph adds a workflow layer for the kinds of tasks that usually break a
one-shot agent interaction:

- PRD-driven features
- long-running implementation work
- tasks that need repeated verification
- work that may block, retry, or need to resume later

In other words:

- use plain Codex for lightweight one-shot work
- let Ralph step in when the task needs a persistent, structured loop

## What this improves over a simpler Ralph loop

The original Ralph pattern is strong because it keeps going until the work
is actually complete.

This version improves that pattern by making the loop more explicit and
recoverable:

### Structured state
Instead of relying on a loose progress file alone, Ralph persists:

- `.ralph/state.json` — current phase, current task, next action
- `.ralph/tasks.json` — task graph with retry state and context metadata
- `.ralph/progress.md` — append-only progress history

### Task graph planning
Ralph does not just keep a list of vague next steps.
It turns a PRD into a concrete task graph that can be re-read, re-planned,
and resumed.

### Context-budgeted execution
Each task carries context metadata, and execution is intentionally bounded.
If a task becomes too broad, Ralph can block it and push the workflow back
toward replanning instead of silently letting the task balloon.

### Verification with evidence
Completion is tied to real verification commands.
Verification output is written under `.ralph/evidence/` so success and
failure are backed by artifacts, not just model claims.

### Explicit recovery paths
Retry, blocked, and resume are part of the design.
Ralph keeps enough state on disk that the loop can recover instead of
starting from scratch.

### Codex-native integration
This version is packaged as a plugin + CLI so it can surface naturally
inside Codex instead of living as a separate manual-only script.

## Install

```bash
npm install -g @openai/codex openai-ralph-codex
```

Global install is intended to prepare Ralph for normal Codex usage by:

- installing the `ralph` CLI
- copying the plugin into `~/plugins/openai-ralph-codex`
- updating `~/.agents/plugins/marketplace.json`
- merging Ralph-managed entries into `~/.codex/hooks.json`

If your environment blocks postinstall:

```bash
ralph plugin install
ralph plugin status
```

## How it works in a real project

Go to your own project and run:

```bash
codex
```

Then work normally.

When the prompt looks like Ralph-style work, the installed hooks can route
into the Ralph workflow instead of leaving the entire task as a plain
one-shot Codex interaction.

Typical triggers:

- "Create a PRD and plan this feature"
- "Continue the blocked work"
- "Verify the current task"
- "Use Ralph for this long-running change"

## First prompt bootstrap

If the project does not already have `.ralph/`, Ralph can bootstrap it on
the first relevant prompt.

That bootstrap flow is:

1. `ralph init`
2. seed `.ralph/prd.md`
   - from `PRD.md`, `prd.md`, `docs/PRD.md`, or `docs/prd.md` if present
   - otherwise from the user's first prompt
3. `ralph plan`
4. move into the normal loop

This lets Ralph work in both cases:

- a brand-new project starting from scratch
- an existing project that adopts Ralph in the middle of active work

## Main loop

Once `.ralph/` exists, the Ralph loop is straightforward:

1. **Plan**
   - convert `.ralph/prd.md` into a task graph
   - attach context metadata to tasks
   - identify tasks that likely need splitting

2. **Select**
   - choose the next runnable task
   - enforce the context budget before execution

3. **Run**
   - execute one bounded task through Codex
   - avoid turning the whole project into one huge prompt

4. **Verify**
   - run configured project checks
   - stop on failure
   - persist artifacts under `.ralph/evidence/`

5. **Resolve**
   - mark complete
   - retry if budget remains
   - block and persist the reason if it does not

6. **Resume**
   - re-queue interrupted or blocked work once the cause has been handled

## Prompt routing policy

Ralph does not try to hijack every prompt.
It routes based on intent and current state.

Current high-level routing looks like this:

- PRD / planning prompts -> `ralph plan`
- execution prompts -> `ralph run`
- verification prompts -> `ralph verify`
- blocked / continue prompts -> `ralph status`, then `ralph resume` or `ralph plan`

So the guiding idea is:

> Codex first for simple work, Ralph when the work needs a loop.

## Commands

| Command | Purpose |
|---|---|
| `ralph init` | Create `.ralph/` from tracked example templates |
| `ralph plan` | Generate or regenerate the task graph from `.ralph/prd.md` |
| `ralph run` | Execute the next runnable task |
| `ralph verify` | Run configured verification commands only |
| `ralph status` | Show current phase, current task, and next action |
| `ralph resume` | Re-queue blocked or interrupted work |
| `ralph plugin install` | Install the home-local Codex plugin packaging |
| `ralph plugin status` | Show whether the home-local plugin is installed |

## Runtime files

```text
.ralph/config.yaml     runner + verification + context settings
.ralph/prd.md          source-of-truth PRD
.ralph/tasks.json      persisted task graph
.ralph/state.json      phase + next action + retry info
.ralph/progress.md     append-only progress log
.ralph/evidence/       per-task verification artifacts
```

## Important parts of the package

| Path | Role |
|---|---|
| `dist/cli.js` | built Ralph CLI |
| `plugins/openai-ralph-codex/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugins/openai-ralph-codex/hooks.json` | plugin hook definitions |
| `plugins/openai-ralph-codex/scripts/ralph-hook.mjs` | hook logic for routing + bootstrap |
| `plugins/openai-ralph-codex/scripts/ralph-cli.mjs` | plugin wrapper into the Ralph CLI |
| `scripts/install-home-plugin.mjs` | home-local plugin installer |
| `scripts/postinstall-plugin.mjs` | global-install postinstall hook |

## Example prompts

- "Create a PRD and plan this feature with Ralph."
- "Use Ralph to continue the blocked work in this project."
- "Verify the current Ralph task before we continue."
- "Bootstrap Ralph for this repo and start planning the work."
- "Run the next Ralph task and tell me what verification says."

## Design principles

- **One bounded task at a time**
- **Verification before completion**
- **Evidence before claims**
- **Recovery instead of silent failure**
- **Codex-native usage instead of a separate control plane**

## Current scope

Ralph is intentionally focused.

It is designed to be:

- globally installable
- plugin-packaged
- hook-routed
- lazy-bootstrap capable
- command-driven for the actual execution lane

It is not trying to be:

- a giant general-purpose orchestration platform
- a permanent background daemon that silently drives every task forever
- a system that hides all execution behind nested automatic runs

## Release notes

- [v0.1.1 draft release notes](docs/releases/v0.1.1.md)

## License

MIT - see [LICENSE](LICENSE).
