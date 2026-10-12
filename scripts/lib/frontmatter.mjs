/**
 * Parse the deliberately small YAML subset used by task Markdown files.
 *
 * Supported values: strings, numbers, booleans, null, inline arrays,
 * block arrays, and one-level nested objects. YAML anchors and executable
 * tags are intentionally unsupported.
 */

export function parseFrontmatter(content) {
  if (typeof content !== 'string' || content.length === 0) return null;
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return null;
  return {
    frontmatter: parseYamlBlock(match[1]),
    body: match[2] || '',
    rawFrontmatter: match[1],
  };
}

export function parseYamlBlock(block) {
  const lines = String(block).split('\n');
  const result = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      index += 1;
      continue;
    }

    const keyValue = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!keyValue) {
      index += 1;
      continue;
    }

    const [, key, rawValue] = keyValue;
    if (rawValue.trim()) {
      result[key] = parseScalar(rawValue);
      index += 1;
      continue;
    }

    const next = lines[index + 1] || '';
    if (/^\s+-\s+/.test(next)) {
      const values = [];
      index += 1;
      while (index < lines.length && /^\s+-\s+/.test(lines[index])) {
        values.push(parseScalar(lines[index].replace(/^\s+-\s+/, '')));
        index += 1;
      }
      result[key] = values;
      continue;
    }

    if (/^\s+\w[\w-]*\s*:/.test(next)) {
      const value = {};
      index += 1;
      while (index < lines.length && /^\s+\w[\w-]*\s*:/.test(lines[index])) {
        const nested = lines[index].match(/^\s+(\w[\w-]*)\s*:\s*(.*)$/);
        if (nested) value[nested[1]] = parseScalar(nested[2]);
        index += 1;
      }
      result[key] = value;
      continue;
    }

    result[key] = null;
    index += 1;
  }

  return result;
}

export function parseScalar(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === '' || ['null', 'None', '~'].includes(raw)) return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === '[]') return [];
  if (raw === '{}') return {};
  if (raw.startsWith('[') && raw.endsWith(']')) return parseInlineArray(raw);
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);
  return raw;
}

function parseInlineArray(raw) {
  const inner = raw.slice(1, -1).trim();
  if (!inner) return [];
  const values = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (quote) {
      if (character === quote && inner[index - 1] !== '\\') quote = null;
      current += character;
    } else if (character === '"' || character === "'") {
      quote = character;
      current += character;
    } else if (character === ',') {
      values.push(parseScalar(current));
      current = '';
    } else {
      current += character;
    }
  }

  if (current.trim()) values.push(parseScalar(current));
  return values;
}
