# State files

`openai-ralph-codex` keeps runtime state under `.ralph/`.

## Tracked templates

These files are committed so `ralph init` can copy them into working files:

- `.ralph/config.example.yaml`
- `.ralph/prd.example.md`
- `.ralph/context-map.example.md`

## Generated working files

These files are created or updated during normal CLI usage and should stay local:

- `.ralph/config.yaml` — active project config
- `.ralph/prd.md` — active PRD
- `.ralph/context-map.md` — local repo knowledge map
- `.ralph/state.json` — current phase, task pointer, retry count, next action
- `.ralph/tasks.json` — persisted task graph with retry state and context estimates
- `.ralph/progress.md` — append-only progress log

## Evidence artifacts

Verification output is written under `.ralph/evidence/`:

- `.ralph/evidence/<task-id>/<timestamp>/...` — verification artifacts created by `ralph run`
- `.ralph/evidence/manual-verify/<timestamp>/...` — artifacts created by standalone `ralph verify`

Each verification command gets its own subdirectory containing:

- `command.txt` — exact shell command
- `stdout.txt` — captured stdout
- `stderr.txt` — captured stderr
- `result.json` — exit code and duration

## Git hygiene

Only the example templates should be tracked by default.
Generated state and evidence stay ignored through `.gitignore`.
