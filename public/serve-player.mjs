import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let file;
  try {
    file = statSync(filePath);
    if (!file.isFile()) throw new Error('Not a file');
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  };
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { 'Content-Range': `bytes */${file.size}` }).end();
      return;
    }
    const suffixLength = Number(match[2]);
    const start = match[1] ? Number(match[1]) : Math.max(file.size - suffixLength, 0);
    const end = match[1] && match[2] ? Math.min(Number(match[2]), file.size - 1) : file.size - 1;
    if (start >= file.size || end < start) {
      response.writeHead(416, { 'Content-Range': `bytes */${file.size}` }).end();
      return;
    }
    response.writeHead(206, {
      ...headers,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${file.size}`,
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, { ...headers, 'Content-Length': file.size });
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
});

server.listen(4178, '127.0.0.1', () => {
  console.log('NOVA is ready at http://localhost:4178/');
  console.log('Keep this window open while you use the player. Press Ctrl+C to stop it.');
});

