// TELUK HARAPAN — serve.ts
// Server statis kecil untuk memainkan game/ secara lokal tanpa build step:
//   node serve.ts [--port 8080]
//   -> http://localhost:8080
// Hanya melayani file di bawah game/, menolak path traversal, mengirim MIME
// yang benar untuk game browser. Alat dev saja, bukan server internet.
// Ditulis fresh untuk round 4 (struktur sendiri, dengan log request).

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.glb', 'model/gltf-binary'],
  ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function parsePort(argv) {
  const at = argv.indexOf('--port');
  if (at === -1) return 8080;
  const value = Number(argv[at + 1]);
  if (!Number.isInteger(value) || value <= 0 || value >= 65536) return 8080;
  return value;
}

function safeJoin(root, pathname) {
  const cleaned = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const full = resolve(join(root, cleaned));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const port = parsePort(process.argv.slice(2));

const server = createServer((req, res) => {
  const started = Date.now();
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = safeJoin(gameRoot, pathname);
  if (!file) {
    res.writeHead(403).end('forbidden');
    console.log(`${req.method} ${pathname} -> 403 (${Date.now() - started}ms)`);
    return;
  }
  let size = 0;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    res.writeHead(404).end('not found');
    console.log(`${req.method} ${pathname} -> 404 (${Date.now() - started}ms)`);
    return;
  }
  const type = MIME_TYPES.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'content-length': size,
    'cache-control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
  } else {
    createReadStream(file).pipe(res);
  }
  res.on('finish', () => {
    console.log(`${req.method} ${pathname} -> 200 ${size}B (${Date.now() - started}ms)`);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`TELUK HARAPAN: game/ dilayani di http://localhost:${port}`);
  console.log('Buka di Chrome desktop, main dengan keyboard + mouse.');
});
