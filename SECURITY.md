# Security

## Supported use

Run the kit only inside a project directory you trust. Task Markdown, specification files, and evidence JSON are treated as local project data.

## Deliberate boundaries

- No task field or evidence value is executed as a command.
- Evidence paths are resolved against the current project and may not escape it.
- Task IDs use a restricted character set before they are written to the ledger.
- The examples use synthetic data and temporary directories.
- The kit contains no credentials, network clients, model-provider integrations, or deployment hooks.

The append-only ledger is designed for a single local writer. Concurrent processes can still race; use an external lock or transactional store before adopting it in a multi-runner environment.

## Reporting

Please open a private security advisory in the eventual GitHub repository. Do not include live credentials or private customer data in an issue.
