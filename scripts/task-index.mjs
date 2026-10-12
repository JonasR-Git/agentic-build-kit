#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INDEX_PATH, buildIndex, loadProject, readIndex, writeIndex } from './lib/task-core.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');

if (args.includes('--validate')) {
  const project = loadProject();
  const result = { valid: project.errors.length === 0, task_count: project.tasks.length, errors: project.errors };
  if (json) console.log(JSON.stringify(result, null, 2));
  else if (result.valid) console.log(`task-index: valid (${result.task_count} tasks)`);
  else console.error(`task-index: invalid\n${result.errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(result.valid ? 0 : 1);
}

if (args.includes('--status')) {
  if (!existsSync(join(process.cwd(), INDEX_PATH))) {
    console.error(`${INDEX_PATH} not found; run --rebuild first`);
    process.exit(1);
  }
  const index = readIndex();
  if (json) console.log(JSON.stringify(index, null, 2));
  else console.log(`Tasks: ${index.count}\nStatuses: ${JSON.stringify(index.by_status)}\nValid: ${index.valid}`);
  process.exit(index.valid ? 0 : 1);
}

const index = writeIndex();
if (json) console.log(JSON.stringify(index, null, 2));
else console.log(`task-index: ${index.count} task(s) -> ${INDEX_PATH}`);
process.exit(index.valid ? 0 : 1);
