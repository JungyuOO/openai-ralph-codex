#!/usr/bin/env bash
set -euo pipefail

PROMPT="${1:-Plan this feature from a PRD and start the Ralph workflow for this project.}"

if ! command -v ralph >/dev/null 2>&1; then
  echo 'Missing `ralph` in PATH. Install first: npm install -g @openai/codex openai-ralph-codex' >&2
  exit 1
fi

HOME_PLUGIN="$HOME/plugins/openai-ralph-codex/scripts/ralph-hook.mjs"
if [[ ! -f "$HOME_PLUGIN" ]]; then
  echo "Missing installed plugin hook at $HOME_PLUGIN. Try: ralph plugin install" >&2
  exit 1
fi

DEMO_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ralph-demo-XXXXXX")"
export RALPH_PROJECT_ROOT="$DEMO_ROOT"

echo "Demo project: $DEMO_ROOT"
echo
echo "== Plugin status =="
ralph plugin status
echo
echo "== Enable project routing =="
(cd "$DEMO_ROOT" && orc enable)
echo
echo "== First relevant prompt =="
printf '{"user_prompt":"%s"}\n' "$PROMPT" | node "$HOME_PLUGIN" user-prompt
echo
echo "== Generated Ralph state =="
find "$DEMO_ROOT/.ralph" -maxdepth 2 -type f | sort
echo
echo "== state.json =="
cat "$DEMO_ROOT/.ralph/state.json"
echo
echo "== tasks.json =="
cat "$DEMO_ROOT/.ralph/tasks.json"
