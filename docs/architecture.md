# Architecture

## Overview
`openai-ralph-codex` is a project-completion harness built on top of Codex CLI.

Codex is used as the execution engine for high-correctness code changes.
Ralph provides the operational layer that long-running work needs:
- PRD-to-task-graph conversion
- context control
- resumable state
- validation-gated completion
- failure recovery

## Core design idea
Built-in autonomous loops are good at continuing work.
This project focuses on helping users finish work predictably.

## Main components

### 1. Planner
Reads a PRD and converts it into:
- epics
- stories
- tasks
- dependencies
- validation rules

### 2. Scheduler
Chooses the next runnable task based on:
- dependency state
- blocked status
- retry history
- context budget

### 3. Context Budget Manager
Keeps each execution unit small enough to fit safely inside a useful context window.

It decides:
- whether a task is too large
- which files should be included
- whether the task should be split

### 4. Runner
Executes work through:
- Codex CLI
- optional Codex SDK adapter later

### 5. Verifier
Checks whether a task is truly complete through:
- test commands
- lint/typecheck/build
- optional spec and docs checks

### 6. Recovery Manager
Handles:
- retries
- fresh-context reruns
- task splitting
- replanning
- blocked escalation

### 7. State Manager
Persists runtime state in `.ralph/`.

## Runtime directory
The `.ralph/` directory stores working state such as:
- config
- current PRD
- task graph
- current state
- progress summary
- evidence and reports

Only templates/examples should be committed by default.
Generated runtime artifacts should stay local.

## Design principle
Codex writes code.
Ralph manages completion.