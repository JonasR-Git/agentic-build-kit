#!/usr/bin/env node
import { transitionTask } from './lib/task-core.mjs';

const args = process.argv.slice(2);
const [action, taskId] = args;
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

if (!['start', 'complete', 'block'].includes(action) || !taskId) {
  console.error('Usage: node scripts/task-state.mjs <start|complete|block> TASK-ID [--evidence path] [--reason text]');
  process.exit(2);
}

try {
  const event = transitionTask(action, taskId, {
    evidence: option('--evidence'),
    reason: option('--reason'),
  });
  console.log(JSON.stringify(event, null, 2));
} catch (error) {
  console.error(`task-state: ${error.message}`);
  process.exit(1);
}
