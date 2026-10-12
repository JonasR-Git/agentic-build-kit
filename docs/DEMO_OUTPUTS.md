# Verified demo outputs

Captured on 2026-10-12 with Node.js v24.19.0. Both commands operate on temporary copies of synthetic examples.

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
