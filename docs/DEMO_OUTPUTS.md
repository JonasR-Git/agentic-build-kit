# Captured workflow simulations

Captured on 2026-10-12 with Node.js v22.13.1. Both commands operate on temporary copies of fictional example projects and consume prewritten synthetic completion reports. These outputs verify the CLI's selection, report-validation and state-transition behaviour. They do not show AI-generated implementation or independently executed project checks.

## Successful gate

Command:

```bash
npm run demo:success
```

Result:

```json
{
  "scenario": "successful",
  "readiness": "GO",
  "selected_task": "DEMO-001",
  "completion_gate": "pass",
  "final_status": "completed",
  "state_events": 2
}
```

## Blocked gate

Command:

```bash
npm run demo:blocked
```

Result:

```json
{
  "scenario": "blocked",
  "readiness": "GO",
  "selected_task": "BLOCK-001",
  "completion_gate": "fail",
  "final_status": "blocked",
  "state_events": 2
}
```
