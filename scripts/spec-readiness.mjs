#!/usr/bin/env node
import { checkReadiness } from './lib/task-core.mjs';

const json = process.argv.includes('--json');
const result = checkReadiness();

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Spec readiness');
  for (const check of result.checks) {
    const icon = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
    console.log(`${icon}\t${check.name}\t${check.detail}`);
  }
  console.log(result.go ? 'GO' : 'NO-GO');
}

process.exit(result.go ? 0 : 1);
