import http from 'node:http';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('./index.html', import.meta.url));
http.createServer((req, res) => { if (req.url !== '/') { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(html); }).listen(4175, '127.0.0.1', () => console.log('Fixture: http://127.0.0.1:4175/'));
