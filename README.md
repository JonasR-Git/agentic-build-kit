# Agentic Build Kit — Task & Evidence CLI

[![CI](https://github.com/JonasR-Git/agentic-build-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/JonasR-Git/agentic-build-kit/actions/workflows/ci.yml)

**A local Node.js CLI for selecting tasks, recording progress and validating completion reports in agentic development workflows.**

The current release is a small reference implementation of task and evidence bookkeeping. It reads Markdown tasks, checks dependencies and specification files, and records task transitions. A separate developer, coding agent or CI system performs the implementation, tests and reviews, then supplies a JSON completion report.

**Model execution, code generation, execution of your project's tests, pull requests and automatic merging are outside this release.** No adapters to model providers, GitHub, Sentry or email are included. The repository's own regression suite tests the CLI implementation.

## What the CLI does

| Step | Implemented here | Supplied by an external workflow |
| --- | --- | --- |
| Define work | Validate Markdown task fields and dependency references | Write the task and its acceptance criteria |
| Check preparation | Inspect required specification files and recognised unresolved markers | Review whether the specifications are actually sufficient |
| Select a task | Consider dependencies, milestones and priorities | Decide how to implement the selected work |
| Record progress | Append start, completion and block events to a local journal | Execute the work and report problems |
| Check a completion report | Require matching task ID, timestamp and reported passes for tests, static analysis and review | Run those checks and provide trustworthy results |

Specification readiness can be inspected with a **separate CLI command** and is also enforced when starting a task. A start requires every declared specification reference to resolve to a valid project-local Markdown file, the structural readiness checks to pass, and recorded dependencies to be completed. Tasks may have an empty `specs` list. These checks establish structural preparation, not semantic specification quality.

## Try the two synthetic scenarios

Use Node.js 22 or newer. Run from a clone of this repository; there is no published npm package and no runtime dependency or API key to configure.

```bash
npm ci
npm run check
```

This runs the regression tests and both demos. To inspect a scenario separately:

```bash
npm run demo:success
npm run demo:blocked
```

- **Successful report:** the supplied sample report passes validation and the task reaches `completed`.
- **Failed review report:** completion is rejected, then the demo explicitly records the task as `blocked`.

The demos use prewritten, fictional JSON reports in temporary copies of the example projects. They demonstrate validation and state transitions; no feature is generated and no AI review is performed. Captured output is in [DEMO_OUTPUTS.md](docs/DEMO_OUTPUTS.md).

Follow the [hands-on walkthrough](docs/WALKTHROUGH.md) to inspect each command in a disposable example project.

## Where the boundary sits

```text
Local project files                       External developer / agent / CI
  Markdown tasks + specifications           implementation, tests, review
           |                                           |
           v                                           v
  Task & Evidence CLI <-------------------- JSON completion report
    validate / select / start / complete / block
           |
           v
  Local task index + state journal
```

The external side is an integration boundary, not an included adapter. See [ARCHITECTURE.md](ARCHITECTURE.md) for scheduling and state replay.

## Commands and project files

Commands operate on the **current working directory**:

| Command | Purpose |
| --- | --- |
| `task-index.mjs --rebuild` | Validate definitions and rebuild the task index |
| `task-query.mjs --pick-ready --json` | Select a dependency-ready pending task |
| `spec-readiness.mjs --json` | Report structural specification readiness; exit 1 on failure |
| `task-state.mjs start TASK-ID` | Record a valid start transition |
| `verify-gate.mjs TASK-ID --evidence path --json` | Validate a completion report without changing task state |
| `task-state.mjs complete TASK-ID --evidence path` | Validate the report and record completion |
| `task-state.mjs block TASK-ID --reason text` | Explicitly record a blocker |

These are Node scripts under `scripts/`, not installed shell commands. Prefix each with `node` and its path as shown in the walkthrough.

| Path | Contents |
| --- | --- |
| `loop/tasks/*.md` | Task definitions, initially `pending` |
| `docs/specs/` | Specification files for the structural readiness check |
| `loop/evidence/*.json` | Reports supplied by the external workflow |
| `loop/.tasks-index.json` | Generated task index |
| `loop/.state.jsonl` | Local state-transition journal |

The checked-in [task example](examples/successful/loop/tasks/DEMO-001.md) and [report example](examples/successful/loop/evidence/DEMO-001.json) show the supported formats. Task Markdown remains unchanged during transitions; current status is reconstructed from definitions and journal events.

## Trust and current limits

A valid report says that its required checks passed. **The CLI does not establish that they really ran, that the report belongs to a specific commit, or that its author is trustworthy.** A production integration would need authenticated results tied to the work being approved.

The project directory is trusted local input. The journal is designed for one local writer and is editable by anyone with filesystem access; it is neither tamper-proof nor safe for concurrent runners. Readiness checks cover file structure and recognised markers, rather than semantic specification quality. See [SECURITY.md](SECURITY.md).

This repository's synthetic examples and test suite demonstrate the reference core's behaviour. They provide no benchmark of model quality, production delivery throughput or adoption by other developers.

## License and contributions

[MIT License](LICENSE), copyright Jonas Fendel. The repository began with a fresh source-only history; its public provenance is described in [PROVENANCE.md](PROVENANCE.md).

For development, read [CONTRIBUTING.md](CONTRIBUTING.md). Keep external execution separate from this small local CLI.
