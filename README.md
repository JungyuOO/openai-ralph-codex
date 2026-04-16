# OPENAI-Ralph-codex

<p align="center">
  <img src="ralph.png" alt="Ralph" width="300" />
  <br />
  <em>Use Codex normally, then let Ralph take over when the work needs a real loop.</em>
</p>

OPENAI-Ralph-codex is a Codex-native improved Ralph loop for PRD-driven software delivery.

It keeps the original Ralph idea - persistent state, bounded work, fresh
execution, and completion pressure - but improves the structure around it
so it behaves like a real Codex product:

- structured project-local state under `.ralph/`
- PRD -> task graph planning
- classifier-led routing with loop-session latching
- compact task-local prompt packs
- compiled acceptance criteria + task-aware verification profiles
- context-budgeted execution
- verification as a hard gate
- persisted evidence plus distilled project memory
- explicit retry / blocked / resume behavior
- failure fingerprints instead of raw-log replay
- value/cost task selection
- auto-split recovery proposals for broad blocked work
- plugin + hook integration so Ralph can surface itself from normal Codex usage

## A simple mental model

Think of the product like this:

- **Codex** does the actual task execution
- **Ralph** decides how to turn larger work into a repeatable delivery loop
- **`.ralph/`** is the project-local memory for that loop

So the goal is not to replace Codex with a second agent.
The goal is to give Codex a better structure when the work is large enough
to need planning, verification, and recovery.

## Use Ralph when

Ralph is a good fit when the work is:

- feature-sized or PRD-driven
- likely to span multiple iterations
- important enough that verification must be explicit
- risky enough that blocked / retry / resume should be first-class states
- better handled as several bounded tasks instead of one giant prompt

## Do not use Ralph when

Plain Codex is usually enough when the work is:

- a quick one-shot answer
- a tiny local edit with obvious scope
- pure brainstorming with no need for persistent state
- a short question that does not need planning or verification

## What Ralph is for

Codex is great at one-shot work.

Ralph is for the work that usually needs more than one burst of context:

- PRD-driven features
- larger changes that should be broken into smaller tasks
- work that must pass real project checks before being called complete
- tasks that may block, retry, and continue later

So the intended mental model is:

- **plain Codex** for small one-shot work
- **Ralph** when the work needs a persistent delivery loop

## What this improves over a simpler Ralph loop

The original Ralph pattern is strong because it keeps going until the work
is actually complete.

This version improves the shape of that loop:

### Structured state
Ralph persists explicit state instead of relying on loose progress notes alone:

- `.ralph/state.json` - phase, current task, next action, loop session, and failure summary
- `.ralph/tasks.json` - task graph with retry state, context metadata, task contracts, and last failure
- `.ralph/progress.md` - append-only execution history
- `.ralph/memory.json` - distilled reusable lessons from prior loop turns
- `.ralph/split-proposals.json` - local split suggestions for broad blocked work

### PRD-driven task graph
Ralph does not keep a vague list of "next things to do".
It turns `.ralph/prd.md` into a runnable task graph that can be re-read,
replanned, resumed, and verified.

### Classifier-led routing
Ralph no longer depends on keyword lists to decide whether the loop should
start.

Instead, Codex classifies prompt intent, and active loops use a session
latch so continuation routing stays compact and state-aware.

### Task contracts
Each planned task now carries a compact task contract:

- acceptance criteria
- verification hints
- scoped context files
- recent failure context

This lets the run prompt stay task-local without forcing the model to
rediscover the same success criteria every turn.

### Adaptive prompt modes
Ralph does not treat every task the same.

It now applies internal prompt modes for:

- **small** tasks that can stay especially compact
- **balanced** tasks that need normal task-contract detail
- **recovery** tasks that need extra failure/scope context

These modes are internal product heuristics, not user-facing knobs.

### Context budget
Each task carries context metadata.
If a task becomes too broad, Ralph can block it and push the workflow back
toward replanning instead of silently letting the task balloon.

### Verification with evidence
Completion is not a guess.
Verification commands run as real subprocesses, and their outputs are
stored under `.ralph/evidence/`.

Task-level verification hints can also act as a fallback verification
profile when the project has not explicitly configured global checks yet.

### Explicit recovery
Retry, blocked, and resume are not accidental edge cases.
They are part of the normal loop design.

Ralph also keeps compact failure fingerprints and can generate local
split proposals when a task is too broad or repeatedly fails.

### Throughput-aware selection
Runnable work is no longer chosen by simple source order alone.

Ralph scores runnable tasks by likely value and cost, favoring narrower
work that unlocks downstream tasks sooner.

### Codex-native integration
This version is packaged as a plugin + CLI, so Ralph can surface itself
inside Codex without the user having to manually switch mental models.

## Install

```bash
npm install -g @openai/codex openai-ralph-codex
```

Global install is designed to prepare Ralph for normal Codex usage by:

- installing the `ralph` CLI
- installing the `orc` CLI alias
- copying the plugin into `~/plugins/openai-ralph-codex`
- updating `~/.agents/plugins/marketplace.json`
- merging Ralph-managed entries into `~/.codex/hooks.json`

After global install, opt each project in explicitly:

```bash
cd your-project
orc enable
```

If your environment blocks postinstall:

```bash
ralph plugin install
ralph plugin status
```

## Recommended usage

Go to your own project and run:

```bash
codex
```

Then just work normally.

When the prompt looks like work that benefits from a Ralph loop, the
installed hooks can route you toward the right entrypoint.

### What the hooks are looking for

The hooks are not waiting for the exact word `ralph`.

They are trying to detect prompts that look like:

- plan this feature
- turn this into a PRD or task graph
- continue blocked work
- verify before continuing
- run the next bounded task

So the product is meant to feel like:

- use Codex normally
- Ralph steps in when the task needs a loop

## First prompt bootstrap

If the current project does not have `.ralph/`, Ralph can bootstrap it on
the first relevant prompt:

1. `ralph init`
2. seed `.ralph/prd.md`
   - from `PRD.md`, `prd.md`, `docs/PRD.md`, or `docs/prd.md` if present
   - otherwise from the user's first prompt
3. `ralph plan`
4. continue with the normal loop

This means Ralph can be adopted in both situations:

- a new project starting from scratch
- an existing project where you want to introduce a stronger delivery loop midway through work

## How the loop works

### 1. Plan
Ralph turns `.ralph/prd.md` into `.ralph/tasks.json`.

Tasks are not just titles:

- retry count
- dependency information
- context files
- estimated load
- split recommendations
- acceptance criteria
- verification hints
- last failure fingerprint

all live in the task graph.

### 2. Select
The scheduler scores runnable tasks and prefers the next item that still
fits the current context budget.

If the task is too broad, Ralph does not pretend everything is fine - it
can block the task and push the flow back toward planning.

### 3. Run
Ralph executes one bounded task through Codex.

The point is to keep execution small enough to fit a useful context
window, instead of asking Codex to solve the entire project in a single
shot.

The runner prompt is built as a compact task pack:

- task contract
- scoped files
- verification hints
- distilled memory
- recent failure fingerprint when relevant

Small clean tasks now use a lighter prompt mode, while retry / blocked /
broad-risk tasks keep a richer recovery-oriented prompt.

### 4. Verify
Configured project checks run after execution.

If project-level verification commands are not set yet, Ralph can fall
back to task-local verification hints compiled from the task contract.

Ralph records:

- the command
- stdout
- stderr
- exit code
- duration

under `.ralph/evidence/`.

### 5. Resolve
From there, the loop branches:

- **success** -> mark complete and move to the next task
- **retry** -> re-queue if retry budget remains
- **blocked** -> persist the blocker and wait for resume / replan

Blocked work can also produce a local split proposal so the next planning
pass starts from a concrete breakdown instead of a blank page.

### 6. Resume
If the loop was interrupted or a task was blocked, `ralph resume` can
re-queue work once the root cause has been addressed.

## Prompt routing policy

Ralph does not try to hijack every prompt.
It routes based on intent and current state.

Current routing looks like:

- initial loop entry -> Codex stage classifier
- active loop continuation -> shorter latched continuation routing
- PRD / planning prompts -> `ralph plan`
- execution prompts -> `ralph run`
- verification prompts -> `ralph verify`
- blocked / continue prompts -> `ralph status` then `ralph resume` or `ralph plan`

In short:

> Codex first for simple work, Ralph when the work needs a loop.

## End-to-end examples

### Example 1: brand-new project

User prompt:

```text
Create a PRD and plan this feature: add authentication with email login and password reset.
```

Typical Ralph path:

1. no `.ralph/` detected
2. bootstrap project-local Ralph state
3. write or derive `.ralph/prd.md`
4. generate `.ralph/tasks.json`
5. route toward `ralph run`

### Example 2: existing project in the middle of work

User prompt:

```text
Continue the blocked work in this project and tell me what should happen next.
```

Typical Ralph path:

1. existing `.ralph/state.json` is loaded
2. current blocked reason is read
3. Ralph routes toward `ralph status`
4. then either `ralph resume` or `ralph plan`, depending on why the task blocked

### Example 3: verification-heavy change

User prompt:

```text
Verify the current task before we continue.
```

Typical Ralph path:

1. current Ralph state is loaded
2. intent is classified as verification
3. route toward `ralph verify`
4. evidence is written under `.ralph/evidence/`

## Example prompts

These are the kinds of prompts that should naturally route into Ralph:

### Planning
- "Create a PRD and plan this feature."
- "Break this feature into smaller tasks."
- "Turn this requirement into an executable task graph."

### Execution
- "Run the next Ralph task."
- "Implement the next planned task in this repo."
- "Continue the current delivery loop."

### Verification
- "Verify the current Ralph task before we continue."
- "Run the checks for the current task."
- "Show me whether the current task really passes."

### Recovery
- "Continue the blocked work in this project."
- "Resume the interrupted Ralph task."
- "Why is this task blocked, and what should happen next?"

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
.ralph/memory.json     distilled reusable loop memory
.ralph/split-proposals.json local split suggestions for blocked work
.ralph/evidence/       per-task verification artifacts
```

## Important package pieces

| Path | Role |
|---|---|
| `dist/cli.js` | built Ralph CLI |
| `plugins/openai-ralph-codex/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugins/openai-ralph-codex/hooks.json` | plugin hook definitions |
| `plugins/openai-ralph-codex/scripts/ralph-hook.mjs` | hook logic for routing + bootstrap |
| `plugins/openai-ralph-codex/scripts/ralph-cli.mjs` | plugin wrapper into the Ralph CLI |
| `scripts/install-home-plugin.mjs` | home-local plugin installer |
| `scripts/postinstall-plugin.mjs` | global-install postinstall hook |

## Why the on-disk files matter

Ralph works because the loop can stop and restart without losing its place.

- `prd.md` preserves what the work is supposed to achieve
- `tasks.json` preserves how that work was broken down
- `state.json` preserves what Ralph thinks should happen next
- `progress.md` preserves the loop history
- `memory.json` preserves compact reusable lessons
- `split-proposals.json` preserves suggested recovery breakdowns
- `evidence/` preserves what verification actually proved

That is what makes the loop resumable instead of fragile.

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

- [v0.1.3 draft release notes](docs/releases/v0.1.3.md)
- [v0.1.2 draft release notes](docs/releases/v0.1.2.md)
- [v0.1.1 draft release notes](docs/releases/v0.1.1.md)

## License

MIT - see [LICENSE](LICENSE).
