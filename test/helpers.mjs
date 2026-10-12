import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const REPOSITORY = dirname(dirname(fileURLToPath(import.meta.url)));

export function copyExample(name) {
  const temporary = mkdtempSync(join(tmpdir(), 'agentic-build-kit-test-'));
  const project = join(temporary, 'project');
  cpSync(join(REPOSITORY, 'examples', name), project, { recursive: true });
  return { temporary, project };
}

export function cleanup(temporary) {
  rmSync(temporary, { recursive: true, force: true });
}

export function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [join(REPOSITORY, 'scripts', script), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}
