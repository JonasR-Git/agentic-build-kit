import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

export const TASKS_DIR = 'loop/tasks';
export const INDEX_PATH = 'loop/.tasks-index.json';
export const STATE_PATH = 'loop/.state.jsonl';
export const SPECS_ROOT = 'docs/specs';

export const REQUIRED_FIELDS = [
  'id', 'title', 'status', 'milestone', 'phase', 'priority', 'serves', 'created_at',
];
export const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked', 'skipped'];
export const VALID_PHASES = ['discovery', 'foundation', 'build', 'harden', 'decision'];
export const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

const TRANSITIONS = {
  pending: new Set(['in_progress', 'blocked']),
  in_progress: new Set(['completed', 'blocked']),
  blocked: new Set(['in_progress']),
  completed: new Set(),
  skipped: new Set(),
};

const ACTION_FOR_TRANSITION = {
  'pending:in_progress': 'start',
  'blocked:in_progress': 'start',
  'in_progress:completed': 'complete',
  'pending:blocked': 'block',
  'in_progress:blocked': 'block',
};

export function validateTask(task, source = '<task>') {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (task[field] === undefined || task[field] === null || task[field] === '') {
      errors.push(`${source}: missing ${field}`);
    }
  }
  if (task.id && !TASK_ID_PATTERN.test(String(task.id))) {
    errors.push(`${source}: invalid id "${task.id}"`);
  }
  if (task.status && !VALID_STATUSES.includes(task.status)) {
    errors.push(`${source}: invalid status "${task.status}"`);
  }
  if (task.status && task.status !== 'pending') {
    errors.push(`${source}: task definitions must start with status "pending"; lifecycle state belongs in ${STATE_PATH}`);
  }
  if (task.phase && !VALID_PHASES.includes(task.phase)) {
    errors.push(`${source}: invalid phase "${task.phase}"`);
  }
  if (task.priority && !VALID_PRIORITIES.includes(task.priority)) {
    errors.push(`${source}: invalid priority "${task.priority}"`);
  }
  if (task.created_at && Number.isNaN(Date.parse(task.created_at))) {
    errors.push(`${source}: created_at must be an ISO-compatible timestamp`);
  }
  for (const field of ['depends', 'specs']) {
    if (task[field] !== undefined && !Array.isArray(task[field])) {
      errors.push(`${source}: ${field} must be an array`);
    }
  }
  return errors;
}

export function loadTaskDefinitions(root = process.cwd()) {
  const directory = join(root, TASKS_DIR);
  if (!existsSync(directory)) {
    return { tasks: [], errors: [`${TASKS_DIR}: directory not found`] };
  }

  const tasks = [];
  const errors = [];
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .sort();

  for (const file of files) {
    const path = join(directory, file);
    const parsed = parseFrontmatter(readFileSync(path, 'utf8'));
    if (!parsed) {
      errors.push(`${TASKS_DIR}/${file}: missing frontmatter`);
      continue;
    }
    const task = { ...parsed.frontmatter, depends: parsed.frontmatter.depends || [], specs: parsed.frontmatter.specs || [], file };
    errors.push(...validateTask(task, `${TASKS_DIR}/${file}`));
    tasks.push(task);
  }

  const ids = new Set();
  for (const task of tasks) {
    if (ids.has(task.id)) errors.push(`${TASKS_DIR}: duplicate task id "${task.id}"`);
    ids.add(task.id);
  }
  for (const task of tasks) {
    for (const dependency of task.depends) {
      if (!ids.has(dependency)) errors.push(`${TASKS_DIR}/${task.file}: unknown dependency "${dependency}"`);
    }
  }
  errors.push(...findDependencyCycles(tasks));
  return { tasks, errors };
}

function findDependencyCycles(tasks) {
  const graph = new Map(tasks.map((task) => [task.id, task.depends || []]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = new Set();

  function visit(id, trail) {
    if (visiting.has(id)) {
      const start = trail.indexOf(id);
      cycles.add([...trail.slice(start), id].join(' -> '));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) || []) visit(dependency, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of graph.keys()) visit(id, []);
  return [...cycles].map((cycle) => `${TASKS_DIR}: dependency cycle ${cycle}`);
}

export function loadStateEvents(root = process.cwd()) {
  const path = join(root, STATE_PATH);
  if (!existsSync(path)) return { events: [], errors: [] };
  const events = [];
  const errors = [];
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      if (!TASK_ID_PATTERN.test(String(event.task_id || ''))) throw new Error('invalid task_id');
      if (!VALID_STATUSES.includes(event.from) || !VALID_STATUSES.includes(event.to)) throw new Error('invalid state');
      if (!TRANSITIONS[event.from]?.has(event.to)) throw new Error(`invalid transition ${event.from} -> ${event.to}`);
      const expectedAction = ACTION_FOR_TRANSITION[`${event.from}:${event.to}`];
      if (event.action !== expectedAction) throw new Error(`transition requires action "${expectedAction}"`);
      if (event.action === 'complete' && typeof event.evidence !== 'string') throw new Error('completion event requires evidence');
      if (event.action === 'block' && typeof event.reason !== 'string') throw new Error('block event requires a reason');
      if (Number.isNaN(Date.parse(event.at))) throw new Error('invalid timestamp');
      events.push(event);
    } catch (error) {
      errors.push(`${STATE_PATH}:${index + 1}: ${error.message}`);
    }
  });
  return { events, errors };
}

export function foldState(definitions, events, root = process.cwd()) {
  const current = new Map(definitions.map((task) => [task.id, { ...task, state_events: 0 }]));
  const errors = [];
  for (const event of events) {
    const task = current.get(event.task_id);
    if (!task) {
      errors.push(`${STATE_PATH}: event references unknown task "${event.task_id}"`);
      continue;
    }
    if (task.status !== event.from) {
      errors.push(`${STATE_PATH}: ${event.task_id} expected from "${task.status}", got "${event.from}"`);
      continue;
    }
    if (event.action === 'complete') {
      const gate = checkEvidence(event.task_id, event.evidence, root);
      if (!gate.pass) {
        errors.push(`${STATE_PATH}: invalid completion evidence for ${event.task_id}: ${gate.errors.join('; ')}`);
        continue;
      }
    }
    task.status = event.to;
    task.state_events += 1;
    task.updated_at = event.at;
    if (event.to === 'in_progress') task.started_at = event.at;
    if (event.to === 'completed') {
      task.completed_at = event.at;
      task.evidence = event.evidence;
    }
    if (event.to === 'blocked') task.blocked_reason = event.reason;
  }
  return { tasks: [...current.values()], errors };
}

export function loadProject(root = process.cwd()) {
  const definitions = loadTaskDefinitions(root);
  const state = loadStateEvents(root);
  const folded = foldState(definitions.tasks, state.events, root);
  return {
    tasks: folded.tasks,
    definitions: definitions.tasks,
    events: state.events,
    errors: [...definitions.errors, ...state.errors, ...folded.errors],
  };
}

export function buildIndex(tasks, errors = []) {
  const countBy = (field) => tasks.reduce((counts, task) => {
    const key = task[field] ?? 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  return {
    generated_at: new Date().toISOString(),
    valid: errors.length === 0,
    errors,
    count: tasks.length,
    by_status: countBy('status'),
    by_milestone: countBy('milestone'),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      milestone: task.milestone,
      phase: task.phase,
      priority: task.priority,
      serves: task.serves,
      depends: task.depends,
      specs: task.specs,
      created_at: task.created_at,
      started_at: task.started_at || null,
      completed_at: task.completed_at || null,
      blocked_reason: task.blocked_reason || null,
      evidence: task.evidence || null,
      state_events: task.state_events || 0,
      file: task.file,
    })),
  };
}

export function writeIndex(root = process.cwd()) {
  const project = loadProject(root);
  const index = buildIndex(project.tasks, project.errors);
  const path = join(root, INDEX_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

export function readIndex(root = process.cwd()) {
  const path = join(root, INDEX_PATH);
  if (!existsSync(path)) throw new Error(`${INDEX_PATH} not found; run task-index.mjs --rebuild`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function filterTasks(tasks, filter) {
  const match = filter.match(/^(\w+)=(.+)$/);
  if (!match) throw new Error(`invalid filter "${filter}"; expected field=value`);
  const [, field, rawValues] = match;
  const values = rawValues.split(',').map((value) => value.trim());
  return tasks.filter((task) => values.includes(String(task[field])));
}

export function pickReady(tasks, candidateIds = null) {
  const milestones = [...new Set(tasks.map((task) => task.milestone))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const openMilestone = milestones.find((milestone) =>
    tasks.some((task) => task.milestone === milestone && !['completed', 'skipped'].includes(task.status)));
  if (!openMilestone) return null;

  const completed = new Set(tasks.filter((task) => task.status === 'completed').map((task) => task.id));
  const ready = tasks.filter((task) =>
    task.milestone === openMilestone &&
    task.status === 'pending' &&
    (!candidateIds || candidateIds.has(task.id)) &&
    task.depends.every((dependency) => completed.has(dependency)));
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const downstream = transitiveDownstream(tasks);
  ready.sort((a, b) =>
    (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
    downstream(b.id) - downstream(a.id) ||
    a.id.localeCompare(b.id));
  return ready[0] || null;
}

function transitiveDownstream(tasks) {
  const dependents = new Map();
  for (const task of tasks) {
    for (const dependency of task.depends) {
      if (!dependents.has(dependency)) dependents.set(dependency, []);
      dependents.get(dependency).push(task.id);
    }
  }
  return (id) => {
    const seen = new Set();
    const visit = (current) => {
      for (const dependent of dependents.get(current) || []) {
        if (seen.has(dependent)) continue;
        seen.add(dependent);
        visit(dependent);
      }
    };
    visit(id);
    return seen.size;
  };
}

export function checkReadiness(root = process.cwd()) {
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail });
  const specs = join(root, SPECS_ROOT);
  const foundation = [
    existsSync(join(specs, '00-vision.md')) || existsSync(join(specs, '00-product-brief.md')),
    existsSync(join(specs, '01-glossary.md')),
    existsSync(join(specs, '02-personas.md')),
  ];
  add('foundation specifications', foundation.every(Boolean) ? 'pass' : 'fail',
    foundation.every(Boolean) ? 'vision or brief, glossary, and personas are present' : 'one or more foundation files are missing');

  const modules = join(specs, 'modules');
  const moduleDirectories = existsSync(modules)
    ? readdirSync(modules, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    : [];
  add('specified module', moduleDirectories.length > 0 ? 'pass' : 'fail',
    moduleDirectories.length > 0 ? `${moduleDirectories.length} module(s)` : 'no module directory found');

  const specFiles = walkMarkdown(specs);
  const unresolved = specFiles.flatMap((path) => {
    const count = readFileSync(path, 'utf8').match(/\[\?\][^\n]*/g)?.length || 0;
    return count ? [{ path: relative(root, path), count }] : [];
  });
  add('unresolved markers', unresolved.length === 0 ? 'pass' : 'fail',
    unresolved.length === 0 ? 'none' : `${unresolved.reduce((sum, item) => sum + item.count, 0)} marker(s)`);

  const adrDirectories = ['docs/ADRs', 'docs/adrs', join(SPECS_ROOT, 'architecture')]
    .map((path) => join(root, path));
  const adrDirectory = adrDirectories.find(existsSync);
  if (!adrDirectory) {
    add('accepted ADRs', 'warn', 'no ADR directory; acceptable when no ADR is required');
  } else {
    const unaccepted = walkMarkdown(adrDirectory).filter((path) =>
      /status:\s*(needs-decision|draft|proposed)/i.test(readFileSync(path, 'utf8')));
    add('accepted ADRs', unaccepted.length === 0 ? 'pass' : 'fail',
      unaccepted.length === 0 ? 'all discovered ADRs are accepted' : `${unaccepted.length} ADR(s) are not accepted`);
  }

  const decisionsPath = join(root, 'loop/_open-decisions.md');
  if (!existsSync(decisionsPath)) {
    add('open decisions', 'pass', 'none recorded');
  } else {
    const text = readFileSync(decisionsPath, 'utf8');
    const blocks = text.split(/(?=^##\s+OD-)/m).filter((block) => /^##\s+OD-/m.test(block));
    const open = blocks.filter((block) => !/status:\s*(answered|resolved|closed)/i.test(block));
    add('open decisions', open.length === 0 ? 'pass' : 'fail', open.length === 0 ? 'all resolved' : `${open.length} open`);
  }

  const project = loadProject(root);
  add('task integrity', project.errors.length === 0 && project.tasks.length > 0 ? 'pass' : 'fail',
    project.errors.length ? project.errors.join('; ') : `${project.tasks.length} valid task(s)`);
  return { go: checks.every((check) => check.status !== 'fail'), checks };
}

function walkMarkdown(directory) {
  if (!existsSync(directory)) return [];
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walkMarkdown(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) paths.push(path);
  }
  return paths;
}

export function resolveProjectPath(input, root = process.cwd()) {
  const projectRoot = resolve(root);
  const candidate = resolve(projectRoot, input);
  if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${sep}`)) {
    throw new Error('path escapes the project root');
  }
  if (existsSync(candidate)) {
    const realRoot = realpathSync(projectRoot);
    const realCandidate = realpathSync(candidate);
    if (realCandidate !== realRoot && !realCandidate.startsWith(`${realRoot}${sep}`)) {
      throw new Error('path resolves outside the project root');
    }
  }
  return candidate;
}

export function checkEvidence(taskId, evidencePath, root = process.cwd()) {
  if (!TASK_ID_PATTERN.test(String(taskId))) return { pass: false, errors: ['invalid task id'] };
  let path;
  try {
    path = resolveProjectPath(evidencePath, root);
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
  if (!existsSync(path)) return { pass: false, errors: ['evidence file not found'] };
  if (statSync(path).size > 64 * 1024) return { pass: false, errors: ['evidence file exceeds 64 KiB'] };

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { pass: false, errors: [`invalid evidence JSON: ${error.message}`] };
  }

  const errors = [];
  if (evidence.task_id !== taskId) errors.push(`evidence task_id must equal ${taskId}`);
  if (!evidence.recorded_at || Number.isNaN(Date.parse(evidence.recorded_at))) errors.push('recorded_at must be a timestamp');
  for (const name of ['tests', 'static_analysis', 'review']) {
    const check = evidence.checks?.[name];
    if (!check) errors.push(`missing check: ${name}`);
    else {
      if (check.status !== 'pass') errors.push(`${name} did not pass`);
      if (typeof check.evidence !== 'string' || check.evidence.trim().length < 3) errors.push(`${name} requires evidence text`);
    }
  }
  return { pass: errors.length === 0, errors, evidence, path: relative(root, path) };
}

export function transitionTask(action, taskId, options = {}, root = process.cwd()) {
  if (!TASK_ID_PATTERN.test(String(taskId))) throw new Error('invalid task id');
  const project = loadProject(root);
  if (project.errors.length) throw new Error(`project is invalid: ${project.errors.join('; ')}`);
  const task = project.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`unknown task "${taskId}"`);

  let to;
  const event = { at: new Date().toISOString(), task_id: taskId, action, from: task.status };
  if (action === 'start') {
    to = 'in_progress';
    const completed = new Set(project.tasks.filter((candidate) => candidate.status === 'completed').map((candidate) => candidate.id));
    const missing = task.depends.filter((dependency) => !completed.has(dependency));
    if (missing.length) throw new Error(`incomplete dependencies: ${missing.join(', ')}`);
  } else if (action === 'complete') {
    to = 'completed';
    if (!options.evidence) throw new Error('completion requires --evidence');
    const gate = checkEvidence(taskId, options.evidence, root);
    if (!gate.pass) throw new Error(`verification gate failed: ${gate.errors.join('; ')}`);
    event.evidence = gate.path;
  } else if (action === 'block') {
    to = 'blocked';
    if (!options.reason?.trim()) throw new Error('blocking requires --reason');
    event.reason = options.reason.trim();
    if (options.evidence) {
      const path = resolveProjectPath(options.evidence, root);
      event.evidence = relative(root, path);
    }
  } else {
    throw new Error(`unknown action "${action}"`);
  }

  if (!TRANSITIONS[task.status]?.has(to)) throw new Error(`invalid transition ${task.status} -> ${to}`);
  event.to = to;
  const statePath = join(root, STATE_PATH);
  mkdirSync(dirname(statePath), { recursive: true });
  appendFileSync(statePath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', flag: 'a' });
  writeIndex(root);
  return event;
}
