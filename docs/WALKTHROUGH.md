# Walkthrough: a local task and completion report

This example exercises the CLI one step at a time. The task, specifications and check results are fictional fixtures. The CLI validates the supplied report; it does not implement the task or perform the reported checks.

## Prepare a separate example directory

Start in a clone whose directory is named `agentic-build-kit`, using Node.js 22 or newer. Copy the successful fixture to a sibling directory named `task-evidence-demo`. Choose a fresh destination so you do not mix an old journal with the example.

On macOS or Linux:

```bash
cp -R examples/successful ../task-evidence-demo
cd ../task-evidence-demo
```

On Windows PowerShell:

```powershell
Copy-Item -Recurse -LiteralPath examples/successful -Destination ../task-evidence-demo
Set-Location ../task-evidence-demo
```

All commands below run **inside `task-evidence-demo`**, while the scripts remain in the sibling clone. If your clone has a different directory name, adjust the script paths. The command's working directory, not the script's directory, defines the project boundary.

## Validate and check preparation

```bash
node ../agentic-build-kit/scripts/task-index.mjs --rebuild --json
node ../agentic-build-kit/scripts/spec-readiness.mjs --json
node ../agentic-build-kit/scripts/task-query.mjs --pick-ready --json
```

Expect a valid index, `go: true` and selected task `DEMO-001`. The fixture has the required foundation documents, a module specification and no recognised unresolved markers. A warning about missing optional ADRs is acceptable. Stop on any non-zero exit status; a specification failure is a reason to repair the project before starting work.

## Record a start

```bash
node ../agentic-build-kit/scripts/task-state.mjs start DEMO-001
```

This records `pending -> in_progress`. Starting also requires structural specification readiness and completed recorded dependencies. A caller still needs to judge whether the task and specification are meaningful.

## Inspect and submit the supplied report

Read `loop/evidence/DEMO-001.json`. Its evidence text explicitly describes synthetic check results. In a real integration, a developer, agent or CI adapter would supply this report after doing the work.

```bash
node ../agentic-build-kit/scripts/verify-gate.mjs DEMO-001 --evidence loop/evidence/DEMO-001.json --json
node ../agentic-build-kit/scripts/task-state.mjs complete DEMO-001 --evidence loop/evidence/DEMO-001.json
node ../agentic-build-kit/scripts/task-index.mjs --status --json
```

Expect `pass: true`, a transition to `completed`, and the reconstructed task status `completed`. The Markdown task still says `pending`: it is the immutable definition during normal CLI use. Runtime state comes from `loop/.state.jsonl`; `loop/.tasks-index.json` is a generated view of definitions and journal events.

The CLI checks the report's fields and declared passes. It cannot establish whether a real test or review ran. Completion replay also depends on the current contents of the referenced local report, so keep that file with the journal.

## Inspect the failed-review scenario

For the automatic simulation, return to the clone and run:

```bash
npm run demo:blocked
```

This creates its own temporary copy. A failed review report is rejected by the completion gate; the runner then explicitly records `blocked` with a reason. The failed completion attempt itself does not automatically block or complete the task. No AI model or review service is called.

## Connecting an external workflow

A future adapter can call the CLI, perform work through its own tools, produce a completion report, and submit it for schema validation. For reliable production approval, that adapter must additionally bind trustworthy results to the exact work being approved and serialize state writes. Those adapters and guarantees are not shipped in this repository.
