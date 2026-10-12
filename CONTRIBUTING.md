# Contributing

1. Use Node.js 22 or newer.
2. Run `npm ci`.
3. Keep workflow decisions deterministic and provider-neutral.
4. Add or update focused `node:test` coverage for behavioral changes.
5. Run `npm run check` before opening a pull request.

Avoid adding network calls, credential handling, or execution of commands supplied by task files. Integrations should produce structured evidence outside this core and pass it across the documented boundary.
