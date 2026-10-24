// Tiny static file server for the tests (serves the repo root).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.mp4': 'video/mp4', '.json': 'application/json', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm' };
const root = new URL('..', import.meta.url).pathname;

export function serve(port, base = root) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      const body = await readFile(join(base, path)), type = types[extname(path)] || 'application/octet-stream';
      // Range requests, so videos can be seeked like on a real web server.
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : body.length - 1;
        res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
        return res.end(body.subarray(start, end + 1));
      }
      res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': body.length });
      res.end(body);
    } catch (_) {
      res.writeHead(404); res.end();
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}
