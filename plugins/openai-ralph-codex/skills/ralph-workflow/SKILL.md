---
name: ralph-workflow
description: Use the repository-local Ralph CLI to initialize PRD state, plan a task graph, run the next bounded task, verify output, inspect status, and resume blocked work.
---

# Ralph Workflow

Use this skill when the user wants PRD-driven delivery through the local
Ralph loop instead of ad-hoc manual orchestration.

## Command surface

This plugin ships a wrapper script:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs <command>
```

The wrapper runs the repository's built CLI from `dist/cli.js`.

## Typical sequence

1. Initialize local state if `.ralph/config.yaml` or `.ralph/state.json` is missing:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs init
```

2. Generate or refresh the task graph from the PRD:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs plan
```

3. Inspect the current Ralph state before execution:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs status
```

4. Execute the next task:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs run
```

5. Run verification only:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs verify
```

6. Re-queue blocked or interrupted work after manual intervention:

```bash
node plugins/openai-ralph-codex/scripts/ralph-cli.mjs resume
```

## Guidance

- Prefer `status` before `run` when you need to understand why work is blocked.
- Use `run --dry-run` to inspect the next prompt without launching Codex.
- If `run` blocks due to context budget, split the task in `.ralph/prd.md` or relax `.ralph/config.yaml`, then re-run `plan`.
- Verification evidence is written under `.ralph/evidence/`.
- This plugin includes lightweight hooks that surface Ralph hints on session start, prompt submission, and after file edits.
- The hooks help auto-surface the Ralph workflow, but they do not replace user-visible command invocation or a true background daemon.
