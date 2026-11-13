import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('durable installation retains the release version required for Chrome updates', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'ownference-tabs-distribution-'));
  try {
    const directory = join(temporary, 'extension');
    execFileSync(process.execPath, [join(root, 'scripts/cli.js'), 'install', '--directory', directory]);
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    const release = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    assert.equal(manifest.version, release.version, 'Chrome must receive the version advertised by the release package');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
