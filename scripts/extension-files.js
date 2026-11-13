import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Keep distribution limited to extension runtime assets and legal notices.
export async function extensionFiles() {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  const icons = [manifest.icons, manifest.action?.default_icon]
    .flatMap(value => typeof value === 'string' ? [value] : Object.values(value ?? {}));
  const files = [
    'LICENSE', 'NOTICE', 'manifest.json', 'options.html', 'popup.html',
    'src/client.js', 'src/options.js', 'src/popup.js', 'src/style.css',
    'src/relay-worker.js', 'src/relay-content.js', ...icons
  ];
  for (const file of files) {
    if (typeof file !== 'string' || file.startsWith('/') || file.split('/').includes('..')) {
      throw new Error(`Invalid extension asset path: ${file}`);
    }
  }
  return [...new Set(files)].sort();
}
