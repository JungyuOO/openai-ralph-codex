# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Finish Each Verified Task with Git Hygiene

**When a logical unit of work is done and verified, wrap it up with git.**

- Commit by **logical task/feature/fix**, not by individual file, unless the user explicitly asks for file-by-file commits.
- Do not commit or push half-finished or failing work unless the user explicitly asks for a checkpoint.
- Before committing:
  - Run the relevant verification for the task.
  - Check `git status --short`.
  - Update `.gitignore` if new local/runtime/generated artifacts appeared.
- Commit messages must stay in **English** and follow the project's **Lore commit protocol** from `AGENTS.md`:
  - intent line first (`why`, not `what`)
  - short body with context/approach
  - useful trailers such as `Confidence`, `Scope-risk`, `Tested`, and `Not-tested`
- Default completion sequence for a finished task:

```bash
git status --short
git add -A
git commit
git push
```

- Prefer pushing to the current tracked branch immediately after a successful commit so the remote stays current.
- If push fails because of auth/network/remote issues, keep the local commit, report the exact failure, and stop there instead of rewriting history.
- If the user explicitly says not to push, respect that and stop after the local commit.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
