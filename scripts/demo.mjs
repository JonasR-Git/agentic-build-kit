#!/usr/bin/env node
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scenario = process.argv[2];
if (!['successful', 'blocked'].includes(scenario)) {
  console.error('Usage: node scripts/demo.mjs <successful|blocked>');
  process.exit(2);
}

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), 'agentic-build-kit-'));
const project = join(temporary, 'project');
cpSync(join(repository, 'examples', scenario), project, { recursive: true });

function run(script, args = []) {
  return spawnSync(process.execPath, [join(repository, 'scripts', script), ...args], {
    cwd: project,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

try {
  const taskId = scenario === 'successful' ? 'DEMO-001' : 'BLOCK-001';
  const evidence = `loop/evidence/${taskId}.json`;
  const index = run('task-index.mjs', ['--rebuild']);
  if (index.status !== 0) throw new Error(index.stderr || 'index failed');
  const readiness = run('spec-readiness.mjs', ['--json']);
  if (readiness.status !== 0) throw new Error(readiness.stderr || 'readiness failed');
  const selected = run('task-query.mjs', ['--pick-ready', '--json']);
  const selectedTask = JSON.parse(selected.stdout)[0];
  if (selectedTask?.id !== taskId) throw new Error(`unexpected selected task: ${selectedTask?.id || 'none'}`);
  const start = run('task-state.mjs', ['start', taskId]);
  if (start.status !== 0) throw new Error(start.stderr || 'start failed');

  const completion = run('task-state.mjs', ['complete', taskId, '--evidence', evidence]);
  if (scenario === 'successful' && completion.status !== 0) throw new Error(completion.stderr || 'completion failed');
  if (scenario === 'blocked') {
    if (completion.status === 0) throw new Error('blocked evidence unexpectedly passed');
    const block = run('task-state.mjs', [
      'block', taskId,
      '--reason', 'Independent review reported a blocking finding',
      '--evidence', evidence,
    ]);
    if (block.status !== 0) throw new Error(block.stderr || 'block transition failed');
  }

  const refreshed = run('task-index.mjs', ['--rebuild', '--json']);
  const finalTask = JSON.parse(refreshed.stdout).tasks.find((task) => task.id === taskId);
  const events = readFileSync(join(project, 'loop/.state.jsonl'), 'utf8').trim().split('\n').filter(Boolean).length;
  console.log(JSON.stringify({
    scenario,
    readiness: 'GO',
    selected_task: taskId,
    completion_gate: completion.status === 0 ? 'pass' : 'fail',
    final_status: finalTask.status,
    state_events: events,
  }, null, 2));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
