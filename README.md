# Ralph — PRD-driven Codex workflow

<p align="center">
  <img src="ralph.png" alt="Ralph" width="360" />
</p>

Ralph is a Codex-native workflow for shipping software from a PRD instead of vibes. It wraps a small CLI and a Codex plugin around one idea: plan, run one bounded task, verify, capture evidence, recover — then do it again.

## How it works

Ralph doesn't try to be a giant agent framework. It's a state machine on disk.

When you're inside a Codex session and ask Ralph to do something, it first looks at `.ralph/`. If the project isn't initialized yet, it bootstraps from an existing `PRD.md` (or from your first prompt) and drops you into the loop. From there, every step is explicit and resumable:

- **Plan** turns your PRD into a task graph with dependencies and a context budget per task.
- **Run** picks the next task that fits the budget and drives Codex through a single, bounded unit of work.
- **Verify** runs your project's real checks — tests, typecheck, lint — and writes the output under `.ralph/evidence/`.
- **Resume** knows how to unstick blocked work: retry, replan, or re-queue based on what actually failed.
- **Status** is the safe question you ask before doing anything else.

The plugin surfaces Ralph automatically from prompt intent, so you rarely type commands by hand. Planning prompts route to `plan`, execution prompts to `run`, verification prompts to `verify`, and "continue" / "why is this blocked" prompts to `status` → `resume`.

## Install

Ralph ships as an npm package that also registers itself as a Codex plugin on your machine.

```bash
npm install -g @openai/codex openai-ralph-codex
```

The postinstall step tries to:

- copy the plugin into `~/plugins/openai-ralph-codex`
- register it in `~/.agents/plugins/marketplace.json`
- merge Ralph-managed hooks into `~/.codex/hooks.json`

If your environment blocks postinstall, do it manually:

```bash
ralph plugin install
ralph plugin status
```

Then, in any project, just start Codex and prompt normally:

```bash
codex
```

## The loop

1. **Bootstrap.** First relevant prompt with no `.ralph/` → Ralph runs `init`, seeds `.ralph/prd.md` from `PRD.md` / `docs/PRD.md` / your message, and calls `plan`.
2. **Plan.** `.ralph/prd.md` → task graph in `.ralph/tasks.json`, scored against the context budget in `.ralph/config.yaml`.
3. **Run one task.** The scheduler picks the next task that fits the budget, builds a bounded prompt, and hands it to the Codex runner. Tasks that exceed the budget are flagged `split_recommended` instead of silently ballooning.
4. **Verify.** Configured commands run as subprocesses. Stdout, stderr, exit code, and the command itself are written to `.ralph/evidence/<task-id>/<timestamp>/`.
5. **Resolve.** Success → mark complete and advance. Failure under `max_retries_per_task` → retry hook. Still failing → `blocked` with the reason persisted in state.
6. **Resume.** `ralph resume` re-queues blocked or interrupted work once you've dealt with the root cause.

## Commands

| Command | What it does |
|---|---|
| `ralph init` | Create `.ralph/` from tracked example templates. Idempotent. |
| `ralph plan` | Parse `.ralph/prd.md` and (re)generate the task graph. |
| `ralph run` | Execute the next runnable task. `--dry-run` prints the prompt without launching the runner. |
| `ralph verify` | Run the configured verification commands only. No state changes. |
| `ralph status` | Print current phase, next action, and any blockers. |
| `ralph resume` | Re-queue blocked or interrupted work so `run` can continue. |
| `ralph plugin install` | Install the home-local Codex plugin packaging. |
| `ralph plugin status` | Show whether the home-local plugin is installed. |

## What's inside

```
dist/cli.js                                      built Ralph CLI
plugins/openai-ralph-codex/.codex-plugin/        Codex plugin manifest
plugins/openai-ralph-codex/hooks.json            prompt-routing hooks
plugins/openai-ralph-codex/skills/ralph-workflow ralph-workflow skill
plugins/openai-ralph-codex/scripts/              hook + CLI wrappers
.ralph/config.yaml                               runner + verify + context budget
.ralph/prd.md                                    source of truth
.ralph/tasks.json                                persisted task graph
.ralph/state.json                                current phase + next action
.ralph/evidence/                                 per-task verification artifacts
```

## Philosophy

- **One bounded task at a time.** No nested loops, no runaway agents. A task either fits the budget or gets split.
- **Evidence over claims.** Verification is a subprocess with a real exit code, and its output is persisted under `.ralph/evidence/` before anything is marked complete.
- **Recoverable by default.** Every phase writes its state to disk. If something crashes, `status` + `resume` gets you back in the loop.
- **Prompt routing, not prompt wrapping.** The plugin nudges Codex toward the right Ralph entrypoint from your intent; it doesn't hijack your conversation.
- **Small, readable code.** Plain TypeScript, Zod for schemas, no magic runtime. The whole harness is something you can read in an afternoon.

## What's not implemented

Ralph is honest about its scope:

- No permanent background daemon that silently drives every task forever.
- No fully automatic nested `ralph run` from inside hooks.

Execution is still command-driven. The plugin + hooks make Ralph feel automatic for most of the loop; the actual `run` step is a command you (or the agent) call.

## Demo scripts

Quick local demo helpers that exercise the published-package flow end-to-end:

- PowerShell: `scripts/demo-global-install.ps1`
- Bash: `scripts/demo-global-install.sh`

They check plugin status, simulate a first relevant prompt, and show the generated `.ralph/` state and task graph.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

- `tests/` runs on vitest and is source-repo only — it isn't shipped in the npm package.
- Commit messages follow Conventional Commits, in English.
- Don't commit `.ralph/` runtime state. The `.gitignore` already excludes it; only the `*.example.*` templates are tracked.

## License

MIT — see [LICENSE](LICENSE).
