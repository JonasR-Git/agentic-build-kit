import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFrontmatter, parseScalar, parseYamlBlock } from '../scripts/lib/frontmatter.mjs';

test('parses the supported scalar types', () => {
  assert.equal(parseScalar('null'), null);
  assert.equal(parseScalar('true'), true);
  assert.equal(parseScalar('42'), 42);
  assert.equal(parseScalar('"quoted"'), 'quoted');
  assert.deepEqual(parseScalar('[a, "b, c", 3]'), ['a', 'b, c', 3]);
});

test('parses arrays and one-level objects', () => {
  const parsed = parseYamlBlock('depends:\n  - BASE-001\nlinks:\n  source: SPEC-001\npriority: HIGH');
  assert.deepEqual(parsed.depends, ['BASE-001']);
  assert.deepEqual(parsed.links, { source: 'SPEC-001' });
  assert.equal(parsed.priority, 'HIGH');
});

test('parses CRLF task frontmatter and body', () => {
  const parsed = parseFrontmatter('---\r\nid: DEMO-001\r\nstatus: pending\r\n---\r\n# Body\r\n');
  assert.equal(parsed.frontmatter.id, 'DEMO-001');
  assert.match(parsed.body, /# Body/);
});

test('returns null when frontmatter is absent', () => {
  assert.equal(parseFrontmatter('# Body only'), null);
});
