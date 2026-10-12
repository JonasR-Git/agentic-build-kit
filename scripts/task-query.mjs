#!/usr/bin/env node
import { filterTasks, pickReady, readIndex } from './lib/task-core.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const ids = args.includes('--ids');
let tasks;

try {
  const index = readIndex();
  if (!index.valid) throw new Error('task index is invalid; inspect its errors before querying');
  const allTasks = index.tasks;
  tasks = allTasks;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--filter') {
      if (!args[index + 1]) throw new Error('--filter requires field=value');
      tasks = filterTasks(tasks, args[index + 1]);
      index += 1;
    }
    if (args[index] === '--search') {
      if (!args[index + 1]) throw new Error('--search requires text');
      const query = args[index + 1].toLowerCase();
      tasks = tasks.filter((task) =>
        [task.id, task.title, task.serves, ...(task.specs || [])]
          .some((value) => String(value || '').toLowerCase().includes(query)));
      index += 1;
    }
  }

  const candidates = new Set(tasks.map((task) => task.id));
  const result = args.includes('--pick-ready') ? [pickReady(allTasks, candidates)].filter(Boolean) : tasks;
  if (json) console.log(JSON.stringify(result, null, 2));
  else if (ids) console.log(result.map((task) => task.id).join('\n'));
  else if (result.length === 0) console.log('No matching tasks.');
  else console.log(result.map((task) => `${task.id}\t${task.status}\t${task.priority}\t${task.title}`).join('\n'));
} catch (error) {
  console.error(`task-query: ${error.message}`);
  process.exit(1);
}
