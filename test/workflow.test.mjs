import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPOSITORY, cleanup, copyExample, run } from './helpers.mjs';

test('successful CLI workflow reaches completed', () => {
  const { temporary, project } = copyExample('successful');
  try {
    assert.equal(run('task-index.mjs', ['--rebuild'], project).status, 0);
    assert.equal(run('spec-readiness.mjs', ['--json'], project).status, 0);
    const picked = run('task-query.mjs', ['--pick-ready', '--json'], project);
    assert.equal(JSON.parse(picked.stdout)[0].id, 'DEMO-001');
    assert.equal(run('task-state.mjs', ['start', 'DEMO-001'], project).status, 0);
    assert.equal(run('verify-gate.mjs', ['DEMO-001', '--evidence', 'loop/evidence/DEMO-001.json', '--json'], project).status, 0);
    assert.equal(run('task-state.mjs', ['complete', 'DEMO-001', '--evidence', 'loop/evidence/DEMO-001.json'], project).status, 0);
    const status = run('task-index.mjs', ['--status', '--json'], project);
    assert.equal(JSON.parse(status.stdout).tasks[0].status, 'completed');
  } finally {
    cleanup(temporary);
  }
});

test('blocked CLI workflow rejects completion and records the blocker', () => {
  const { temporary, project } = copyExample('blocked');
  try {
    assert.equal(run('task-index.mjs', ['--rebuild'], project).status, 0);
    assert.equal(run('task-state.mjs', ['start', 'BLOCK-001'], project).status, 0);
    const gate = run('verify-gate.mjs', ['BLOCK-001', '--evidence', 'loop/evidence/BLOCK-001.json'], project);
    assert.equal(gate.status, 1);
    const completion = run('task-state.mjs', ['complete', 'BLOCK-001', '--evidence', 'loop/evidence/BLOCK-001.json'], project);
    assert.equal(completion.status, 1);
    assert.match(completion.stderr, /review did not pass/);
    assert.equal(run('task-state.mjs', ['block', 'BLOCK-001', '--reason', 'Review blocker'], project).status, 0);
    const status = run('task-index.mjs', ['--status', '--json'], project);
    assert.equal(JSON.parse(status.stdout).tasks[0].status, 'blocked');
  } finally {
    cleanup(temporary);
  }
});

test('demo runner reports one completed and one blocked scenario', () => {
  const successful = run('demo.mjs', ['successful'], REPOSITORY);
  const blocked = run('demo.mjs', ['blocked'], REPOSITORY);
  assert.equal(successful.status, 0, successful.stderr);
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.equal(JSON.parse(successful.stdout).final_status, 'completed');
  assert.equal(JSON.parse(blocked.stdout).final_status, 'blocked');
});
