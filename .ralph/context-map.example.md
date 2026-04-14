# Context Map

## Purpose
This file externalizes important repository knowledge so the agent does not need to keep everything in chat context.

## Key directories
- `src/commands/`: CLI entrypoints
- `src/core/`: domain logic
- `src/runners/`: Codex adapters
- `src/schemas/`: persisted state schemas
- `src/templates/`: generated content templates

## Important files
- `package.json`: scripts and package metadata
- `src/cli.ts`: main command registration
- `AGENTS.md`: repository instructions for agents

## Risky areas
- state schema changes
- task graph persistence format
- command UX that breaks backward compatibility

## Verification commands
- `npm run lint`
- `npm run typecheck`
- `npm test`