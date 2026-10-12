import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  checkEvidence,
  checkReadiness,
  loadProject,
  pickReady,
  transitionTask,
  validateTask,
  writeIndex,
} from '../scripts/lib/task-core.mjs';
import { cleanup, copyExample } from './helpers.mjs';

test('indexes a valid example and selects its ready task', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const index = writeIndex(project);
    assert.equal(index.valid, true);
    assert.equal(index.count, 1);
    assert.equal(pickReady(index.tasks).id, 'DEMO-001');
  } finally {
    cleanup(temporary);
  }
});

test('task definitions cannot claim a completed initial state', () => {
  const errors = validateTask({
    id: 'DEMO-001', title: 'Demo', status: 'completed', milestone: 'M1',
    phase: 'build', priority: 'HIGH', serves: 'test', created_at: '2026-10-12T00:00:00Z',
    depends: [], specs: [],
  });
  assert.ok(errors.some((error) => error.includes('must start with status "pending"')));
});

test('task definitions reject unreachable statuses and invalid spec entries', () => {
  const base = {
    id: 'DEMO-001', title: 'Demo', milestone: 'M1', phase: 'build',
    priority: 'HIGH', serves: 'test', created_at: '2026-10-12T00:00:00Z', depends: [],
  };
  const skipped = validateTask({ ...base, status: 'skipped', specs: [] });
  const invalidSpecs = validateTask({ ...base, status: 'pending', specs: ['', 42] });

  assert.ok(skipped.some((error) => error.includes('invalid status "skipped"')));
  assert.ok(invalidSpecs.some((error) => error.includes('specs[0] must be a non-empty path string')));
  assert.ok(invalidSpecs.some((error) => error.includes('specs[1] must be a non-empty path string')));
});

test('readiness fails closed on an unresolved specification marker', () => {
  const { temporary, project } = copyExample('successful');
  try {
    appendFileSync(join(project, 'docs/specs/modules/notes/03-behavior.md'), '\n[?] Decide the identifier format.\n');
    const readiness = checkReadiness(project);
    assert.equal(readiness.go, false);
    assert.equal(readiness.checks.find((check) => check.name === 'unresolved markers').status, 'fail');
  } finally {
    cleanup(temporary);
  }
});

test('a planned missing task specification keeps the index valid but blocks readiness', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const taskPath = join(project, 'loop/tasks/DEMO-001.md');
    const task = readFileSync(taskPath, 'utf8').replace(
      'docs/specs/modules/notes/03-behavior.md',
      'docs/specs/modules/notes/04-missing.md',
    );
    writeFileSync(taskPath, task);

    const index = writeIndex(project);
    const readiness = checkReadiness(project);
    const declared = readiness.checks.find((check) => check.name === 'declared task specifications');

    assert.equal(index.valid, true);
    assert.equal(readiness.go, false);
    assert.equal(declared.status, 'fail');
    assert.match(declared.detail, /DEMO-001: .*04-missing\.md was not found/);
  } finally {
    cleanup(temporary);
  }
});

test('readiness rejects a declared specification that resolves outside the project', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const outside = join(temporary, 'outside-specs');
    mkdirSync(outside);
    writeFileSync(join(outside, 'external.md'), '# External\n');
    const linked = join(project, 'docs/specs/linked');
    symlinkSync(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
    const taskPath = join(project, 'loop/tasks/DEMO-001.md');
    const task = readFileSync(taskPath, 'utf8').replace(
      'docs/specs/modules/notes/03-behavior.md',
      'docs/specs/linked/external.md',
    );
    writeFileSync(taskPath, task);

    const readiness = checkReadiness(project);
    const declared = readiness.checks.find((check) => check.name === 'declared task specifications');

    assert.equal(readiness.go, false);
    assert.equal(declared.status, 'fail');
    assert.match(declared.detail, /resolves outside the project root/);
  } finally {
    cleanup(temporary);
  }
});

test('start refuses a task while specification readiness is NO-GO', () => {
  const { temporary, project } = copyExample('successful');
  try {
    appendFileSync(join(project, 'docs/specs/modules/notes/03-behavior.md'), '\n[?] Decide the identifier format.\n');

    assert.throws(
      () => transitionTask('start', 'DEMO-001', {}, project),
      /spec readiness NO-GO: unresolved markers:/,
    );
    assert.equal(loadProject(project).tasks[0].status, 'pending');
  } finally {
    cleanup(temporary);
  }
});

test('restarting a blocked task clears its active blocked reason', () => {
  const { temporary, project } = copyExample('successful');
  try {
    transitionTask('start', 'DEMO-001', {}, project);
    transitionTask('block', 'DEMO-001', { reason: 'Needs another pass' }, project);
    assert.equal(loadProject(project).tasks[0].blocked_reason, 'Needs another pass');

    transitionTask('start', 'DEMO-001', {}, project);
    const resumed = loadProject(project).tasks[0];
    assert.equal(resumed.status, 'in_progress');
    assert.equal(resumed.blocked_reason, undefined);
  } finally {
    cleanup(temporary);
  }
});

test('a schema-valid completion report enables a recorded completion transition', () => {
  const { temporary, project } = copyExample('successful');
  try {
    transitionTask('start', 'DEMO-001', {}, project);
    transitionTask('complete', 'DEMO-001', { evidence: 'loop/evidence/DEMO-001.json' }, project);
    const task = loadProject(project).tasks[0];
    assert.equal(task.status, 'completed');
    assert.equal(task.state_events, 2);
    const ledger = readFileSync(join(project, 'loop/.state.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(ledger.map((event) => event.to), ['in_progress', 'completed']);
  } finally {
    cleanup(temporary);
  }
});

test('failed review evidence cannot complete a task', () => {
  const { temporary, project } = copyExample('blocked');
  try {
    transitionTask('start', 'BLOCK-001', {}, project);
    assert.throws(
      () => transitionTask('complete', 'BLOCK-001', { evidence: 'loop/evidence/BLOCK-001.json' }, project),
      /review did not pass/,
    );
    assert.equal(loadProject(project).tasks[0].status, 'in_progress');
  } finally {
    cleanup(temporary);
  }
});

test('a hand-edited completion event without evidence invalidates the project', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const state = join(project, 'loop/.state.jsonl');
    writeFileSync(state, [
      JSON.stringify({ at: '2026-10-12T08:05:00Z', task_id: 'DEMO-001', action: 'start', from: 'pending', to: 'in_progress' }),
      JSON.stringify({ at: '2026-10-12T08:06:00Z', task_id: 'DEMO-001', action: 'complete', from: 'in_progress', to: 'completed' }),
      '',
    ].join('\n'));
    const loaded = loadProject(project);
    assert.ok(loaded.errors.some((error) => error.includes('completion event requires evidence')));
  } finally {
    cleanup(temporary);
  }
});

test('a forged completion event with a missing evidence path is not replayed', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const state = join(project, 'loop/.state.jsonl');
    writeFileSync(state, [
      JSON.stringify({ at: '2026-10-12T08:05:00Z', task_id: 'DEMO-001', action: 'start', from: 'pending', to: 'in_progress' }),
      JSON.stringify({ at: '2026-10-12T08:06:00Z', task_id: 'DEMO-001', action: 'complete', from: 'in_progress', to: 'completed', evidence: 'loop/evidence/missing.json' }),
      '',
    ].join('\n'));
    const loaded = loadProject(project);
    assert.equal(loaded.tasks[0].status, 'in_progress');
    assert.ok(loaded.errors.some((error) => error.includes('invalid completion evidence')));
  } finally {
    cleanup(temporary);
  }
});

test('evidence paths may not traverse outside the project', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const result = checkEvidence('DEMO-001', '../outside.json', project);
    assert.equal(result.pass, false);
    assert.match(result.errors[0], /escapes the project root/);
  } finally {
    cleanup(temporary);
  }
});

test('evidence directory links may not resolve outside the project', () => {
  const { temporary, project } = copyExample('successful');
  try {
    const outside = join(temporary, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'evidence.json'), '{}');
    const links = join(project, 'loop/links');
    symlinkSync(outside, links, process.platform === 'win32' ? 'junction' : 'dir');
    const result = checkEvidence('DEMO-001', 'loop/links/evidence.json', project);
    assert.equal(result.pass, false);
    assert.match(result.errors[0], /resolves outside/);
  } finally {
    cleanup(temporary);
  }
});
