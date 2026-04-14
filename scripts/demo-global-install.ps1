param(
  [string]$Prompt = "Plan this feature from a PRD and start the Ralph workflow for this project."
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ralph -ErrorAction SilentlyContinue)) {
  throw "Missing `ralph` in PATH. Install first: npm install -g @openai/codex openai-ralph-codex"
}

$homePlugin = Join-Path $HOME "plugins\openai-ralph-codex\scripts\ralph-hook.mjs"
if (-not (Test-Path $homePlugin)) {
  throw "Missing installed plugin hook at $homePlugin. Try: ralph plugin install"
}

$demoRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ralph-demo-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $demoRoot | Out-Null

Write-Host "Demo project: $demoRoot"
Write-Host ""
Write-Host "== Plugin status =="
ralph plugin status
Write-Host ""
Write-Host "== First relevant prompt =="
$env:RALPH_PROJECT_ROOT = $demoRoot
@"
{"user_prompt":"$Prompt"}
"@ | node $homePlugin user-prompt
Write-Host ""
Write-Host "== Generated Ralph state =="
Get-ChildItem -Recurse $demoRoot\.ralph | Select-Object FullName,Length
Write-Host ""
Write-Host "== state.json =="
Get-Content $demoRoot\.ralph\state.json
Write-Host ""
Write-Host "== tasks.json =="
Get-Content $demoRoot\.ralph\tasks.json
