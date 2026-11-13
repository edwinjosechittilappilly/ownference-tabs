#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { extensionFiles, root } from './extension-files.js';

const usage = 'Usage: ownmode-browser path | ownmode-browser install --directory <path>';

async function copyAssets(destination, files) {
  for (const file of files) {
    const target = join(destination, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, file), target);
  }
}

async function durablePath() {
  const files = await extensionFiles();
  const hash = createHash('sha256');
  for (const file of files) {
    const contents = await readFile(join(root, file));
    hash.update(`${file}\0${contents.length}\0`);
    hash.update(contents);
  }
  const base = join(homedir(), '.local', 'share', 'ownmode', 'browser');
  const destination = join(base, hash.digest('hex'));
  await mkdir(base, { recursive: true });
  const temporary = await mkdtemp(join(base, '.install-'));
  try {
    await copyAssets(temporary, files);
    try {
      await rename(temporary, destination);
    } catch (error) {
      if (error.code !== 'EEXIST' && error.code !== 'ENOTEMPTY') throw error;
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  for (const file of files) {
    const [source, installed] = await Promise.all([
      readFile(join(root, file)),
      readFile(join(destination, file))
    ]);
    if (!source.equals(installed)) {
      throw new Error(`Installed extension asset differs: ${join(destination, file)}`);
    }
  }
  return destination;
}

async function main(args) {
  if (args.length === 1 && args[0] === 'path') {
    console.log(await durablePath());
    return;
  }
  if (args.length !== 3 || args[0] !== 'install' || args[1] !== '--directory' || !args[2]) {
    throw new Error(usage);
  }
  const destination = resolve(args[2]);
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length !== 0) {
    throw new Error(`Installation directory must be empty: ${destination}`);
  }
  await copyAssets(destination, await extensionFiles());
  console.log(`Extension installed at ${destination}`);
  console.log('Load this directory as an unpacked extension in Chrome developer mode.');
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
