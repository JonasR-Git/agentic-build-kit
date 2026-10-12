#!/usr/bin/env node
import { checkEvidence } from './lib/task-core.mjs';

const args = process.argv.slice(2);
const taskId = args.find((arg) => !arg.startsWith('--'));
const evidenceIndex = args.indexOf('--evidence');
const evidence = evidenceIndex >= 0 ? args[evidenceIndex + 1] : null;
const json = args.includes('--json');

if (!taskId || !evidence) {
  console.error('Usage: node scripts/verify-gate.mjs TASK-ID --evidence path/to/evidence.json [--json]');
  process.exit(2);
}

const result = checkEvidence(taskId, evidence);
if (json) console.log(JSON.stringify({ task_id: taskId, ...result, evidence: undefined }, null, 2));
else if (result.pass) console.log(`PASS\t${taskId}\t${result.path}`);
else console.error(`FAIL\t${taskId}\t${result.errors.join('; ')}`);
process.exit(result.pass ? 0 : 1);
