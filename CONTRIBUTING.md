# Contributing

Thanks for contributing to `openai-ralph-codex`.

## Development setup

```bash
npm install
npm run typecheck
npm test
```

Build the CLI before manual local smoke checks:

```bash
npm run build
```

## Expected workflow

1. Keep command handlers thin.
2. Put orchestration logic in `src/core/`.
3. Validate persisted formats with Zod schemas in `src/schemas/`.
4. Add or update regression tests for every behavior change.

## Verification checklist

Run the standard checks before finishing a logical unit of work:

```bash
npm run typecheck
npm run build
npm test
```

Optional real-runner smoke:

```bash
npm run test:codex-smoke
```

This smoke test uses the locally installed `codex` CLI and is intended
for environments where Codex auth is already configured.

## Commit format

Use an English Conventional Commit prefix with the repository's Lore
trailers, for example:

```text
feat: add resume command for blocked tasks

Short rationale...

Constraint: ...
Rejected: ...
Confidence: high
Scope-risk: narrow
Tested: npm test
Not-tested: ...
```

Commit and push per verified logical unit, not per file.
