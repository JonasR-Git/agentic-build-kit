# Agentic Build Kit

A small, deterministic control plane for task-driven software delivery.

The kit turns Markdown task definitions into a validated index, selects work only when dependencies are complete, checks whether specifications are ready, records state transitions in an append-only ledger, and blocks completion unless structured verification evidence passes.

It deliberately does **not** call an AI model, execute commands from task files, merge pull requests, or claim that an evidence file is true. It provides the inspectable workflow boundary around those activities.

## Try it in under five minutes

Requirements: Node.js 22 or newer. There are no runtime dependencies.

```bash
npm ci
npm test
npm run demo:success
npm run demo:blocked
```

The successful demo moves a synthetic task from `pending` to `completed`. The blocked demo supplies a failed review check, proves that completion is rejected, and records an explicit `blocked` transition. Both demos run in temporary copies, so the checked-in examples stay unchanged.

The latest captured outputs are in [docs/DEMO_OUTPUTS.md](docs/DEMO_OUTPUTS.md).

## What is included

```text
Markdown tasks
    │
    ▼
schema validation ──► generated task index ──► dependency-aware selection
    │                                                 │
    └──────────── spec-readiness checks ◄─────────────┘
                                                      │
                                                      ▼
append-only state ledger ◄── evidence gate ◄── start / complete / block
```

- `task-index.mjs` validates task frontmatter and builds `loop/.tasks-index.json`.
- `task-query.mjs` filters the index and selects the next dependency-ready task.
- `spec-readiness.mjs` checks foundation documents, modules, unresolved markers, ADRs, decisions, and task integrity.
- `verify-gate.mjs` validates a local JSON evidence record for tests, static analysis, and review.
- `task-state.mjs` records `start`, `complete`, and `block` events in `loop/.state.jsonl`.
- `demo.mjs` runs the complete synthetic success or blocked scenario.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the boundaries and data flow.

## Task format

Create `loop/tasks/FEATURE-001.md`:

```markdown
---
id: FEATURE-001
title: Add a deterministic example
status: pending
milestone: M1
phase: build
priority: HIGH
serves: developer-experience
depends: []
specs:
  - docs/specs/modules/example/03-behavior.md
created_at: 2026-10-12T00:00:00Z
---

# Acceptance criteria

- The behavior is covered by an automated test.
```

Task files are definitions and must begin with `status: pending`. Runtime transitions go to the append-only state ledger instead of rewriting the task document, so a task cannot appear completed without a recorded gated transition.

## Evidence format

Create `loop/evidence/FEATURE-001.json`:

```json
{
  "task_id": "FEATURE-001",
  "recorded_at": "2026-10-12T00:05:00Z",
  "checks": {
    "tests": { "status": "pass", "evidence": "node --test: 12 passed" },
    "static_analysis": { "status": "pass", "evidence": "typecheck completed" },
    "review": { "status": "pass", "evidence": "independent review: no blocking findings" }
  }
}
```

The gate validates this record; it does not execute the commands named in it. A production integration should generate evidence from trusted CI artifacts and sign or otherwise authenticate it.

## CLI

Run commands from a project root containing `loop/tasks`:

```bash
node scripts/task-index.mjs --rebuild
node scripts/task-index.mjs --validate
node scripts/task-query.mjs --pick-ready --json
node scripts/task-query.mjs --filter status=pending --json
node scripts/spec-readiness.mjs --json
node scripts/task-state.mjs start FEATURE-001
node scripts/verify-gate.mjs FEATURE-001 --evidence loop/evidence/FEATURE-001.json --json
node scripts/task-state.mjs complete FEATURE-001 --evidence loop/evidence/FEATURE-001.json
node scripts/task-state.mjs block FEATURE-001 --reason "Review found a release blocker"
```

Each command uses the current working directory as the project boundary. User-supplied evidence paths must remain inside that directory.

## Scope and limits

This repository is a compact reference implementation extracted and rewritten from privately maintained delivery tooling. It demonstrates deterministic orchestration primitives, not an autonomous coding agent or a production deployment platform. The examples are synthetic, and their results are not performance benchmarks.

Released under the [MIT License](LICENSE). This repository starts with a fresh source-only history; private delivery tooling and its history remain separate.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Security boundaries are documented in [SECURITY.md](SECURITY.md), and extraction provenance is recorded in [PROVENANCE.md](PROVENANCE.md).
