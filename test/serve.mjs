// Tiny static file server for the tests (serves the repo root).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm' };
const root = new URL('..', import.meta.url).pathname;

export function serve(port, base = root) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      const body = await readFile(join(base, path));
      res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch (_) {
      res.writeHead(404); res.end();
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}
