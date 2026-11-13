import http from 'node:http';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('./index.html', import.meta.url));
const sdk = new URL('../../ownference-web/src/index.js', import.meta.url);
function serve(port) {
  return http.createServer(async (req, res) => {
    if (req.url === '/sdk.js') {
      try {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        res.end(await readFile(sdk));
      } catch { res.destroy(); }
      return;
    }
    if (req.url !== '/') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  }).listen(port, '127.0.0.1', () => console.log(`Fixture: http://127.0.0.1:${port}/`));
}
serve(4175);
serve(4176);
