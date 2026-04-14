# OPENAI-Ralph-codex

<p align="center">
  <img src="ralph.png" alt="Ralph" width="300" />
</p>

OPENAI-Ralph-codex is an improved Ralph loop for Codex.

It keeps the original Ralph idea - persistent progress, bounded work,
fresh execution, and repeatable completion - but improves the structure
around it so it works better as a Codex-native product:

- project-local state in `.ralph/`
- persisted task graph instead of a loose progress file
- context-budgeted task selection
- verification as a first-class gate
- evidence capture on disk
- explicit blocked / retry / resume flow
- plugin + hook integration so Ralph can surface itself inside Codex when needed

## What it improves over a simpler Ralph loop

The core idea is still Ralph: keep going until the work is really done.

What this version improves is the shape of the loop:

- **Structured state**: `state.json`, `tasks.json`, `progress.md`
- **Task graph planning**: PRD -> runnable tasks with metadata
- **Context control**: tasks can be split or blocked when they exceed budget
- **Real verification**: checks run as subprocesses with real exit codes
- **Evidence capture**: verification output is written under `.ralph/evidence/`
- **Recovery built in**: retries, blocked state, and resume are explicit
- **Codex-native entry**: plugin hooks can route into Ralph from normal Codex usage

## Install

```bash
npm install -g @openai/codex openai-ralph-codex
```

Ralph installs as:

- a CLI: `ralph`
- a home-local Codex plugin
- Codex hooks that help surface the Ralph loop from prompt intent

If postinstall is blocked in your environment:

```bash
ralph plugin install
ralph plugin status
```

## How it works

Use Codex normally:

```bash
codex
```

When the prompt looks like PRD-driven or long-running work, Ralph can step
in and route toward the right entrypoint.

If the project does not already have `.ralph/`, Ralph can bootstrap it on
the first relevant prompt:

1. `ralph init`
2. seed `.ralph/prd.md`
   - from `PRD.md`, `prd.md`, `docs/PRD.md`, or `docs/prd.md` if present
   - otherwise from the user's first prompt
3. `ralph plan`
4. continue with the normal loop

## Main loop

1. **Initialize or bootstrap**
2. **Plan** `.ralph/prd.md` into `.ralph/tasks.json`
3. **Select** the next task that still fits the context budget
4. **Run** one bounded Codex task
5. **Verify** with real commands
6. **Persist evidence**
7. **Complete, retry, block, or resume**

## Commands

| Command | Purpose |
|---|---|
| `ralph init` | Create `.ralph/` from tracked example templates |
| `ralph plan` | Generate or regenerate the task graph from `.ralph/prd.md` |
| `ralph run` | Execute the next runnable task |
| `ralph verify` | Run configured verification commands only |
| `ralph status` | Show current phase, task, and next action |
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

## Key design points

- **One bounded task at a time**
- **Verification before completion**
- **Evidence before claims**
- **Recovery over silent failure**
- **Codex-first usage, Ralph when needed**

## Release notes

- [v0.1.1 draft release notes](docs/releases/v0.1.1.md)

## License

MIT - see [LICENSE](LICENSE).
