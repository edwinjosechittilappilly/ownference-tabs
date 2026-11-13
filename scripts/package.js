import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, chmod, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { extensionFiles, root } from './extension-files.js';

const files = await extensionFiles();
const epoch = process.env.SOURCE_DATE_EPOCH ?? '315532800';
if (!/^\d+$/.test(epoch) || Number(epoch) < 315532800 || Number(epoch) > 4354819198) {
  throw new Error('SOURCE_DATE_EPOCH must be seconds between 1980-01-01 and 2107-12-31 UTC.');
}
const timestamp = new Date(Math.floor(Number(epoch) / 2) * 2000);
const temporary = await mkdtemp(join(tmpdir(), 'ownference-tabs-package-'));
try {
  const stage = join(temporary, 'stage');
  for (const file of files) {
    const destination = join(stage, file);
    await mkdir(dirname(destination), { recursive: true });
    if (file === 'manifest.json') {
      const manifest = JSON.parse(await readFile(join(root, file), 'utf8'));
      delete manifest.key;
      await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`);
    } else {
      await copyFile(join(root, file), destination);
    }
    await chmod(destination, 0o644);
    await utimes(destination, timestamp, timestamp);
  }
  const archives = [join(temporary, 'first.zip'), join(temporary, 'second.zip')];
  for (const archive of archives) {
    execFileSync('zip', ['-q', '-X', '-D', archive, ...files], { cwd: stage, env: { ...process.env, TZ: 'UTC' }, stdio: 'inherit' });
    const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trimEnd().split('\n');
    if (JSON.stringify(entries) !== JSON.stringify(files)) throw new Error('Archive contains unexpected or missing files.');
    const manifest = JSON.parse(execFileSync('unzip', ['-p', archive, 'manifest.json'], { encoding: 'utf8' }));
    if (Object.hasOwn(manifest, 'key')) throw new Error('Packaged manifest must not contain a key.');
    if (!manifest.permissions?.includes('nativeMessaging')) throw new Error('Packaged manifest must allow native messaging.');
  }
  const hashes = await Promise.all(archives.map(async archive => createHash('sha256').update(await readFile(archive)).digest('hex')));
  if (hashes[0] !== hashes[1]) throw new Error('Package builds are not reproducible.');
  await mkdir(join(root, 'dist'), { recursive: true });
  await copyFile(archives[0], join(root, 'dist', 'ownference-tabs.zip'));
  console.log(`Created dist/ownference-tabs.zip (sha256 ${hashes[0]})`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
