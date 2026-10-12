# Security

## Supported use

Run the kit only inside a project directory you trust. Task Markdown, specification files, and evidence JSON are treated as local project data.

## Deliberate boundaries

- No task field or evidence value is executed as a command.
- Evidence paths are resolved against the current project and may not escape it.
- Task IDs use a restricted character set before they are written to the ledger.
- The examples use synthetic data and temporary directories.
- The kit contains no credentials, network clients, model-provider integrations, or deployment hooks.

The journal uses append operations during normal CLI transitions and is designed for a single local writer. Concurrent processes can still race; use an external lock or transactional store before adopting it in a multi-runner environment.

Reports are self-reported JSON assertions. They are not authenticated CI artifacts, signed reviews or results bound to a specific commit. Anyone with access to the project directory can edit definitions, reports and state. Completion replay reads the currently referenced report, so editing or deleting it can invalidate earlier completion records. The journal is not tamper-proof storage.

Specification readiness checks file structure and recognised markers; it does not assess whether a specification is correct or sufficient for the task. The caller remains responsible for authorising actual work.

## Reporting

Use this repository's [private vulnerability reporting channel](https://github.com/JonasR-Git/agentic-build-kit/security/advisories/new). Report a reproducible issue and the affected version or commit. Keep live credentials, customer data and exploit details out of public issues. For ordinary usage questions, use the [issue tracker](https://github.com/JonasR-Git/agentic-build-kit/issues).
