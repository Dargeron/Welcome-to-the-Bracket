#!/usr/bin/env node
// Tiny static server for previewing _site/ locally.
//   npm run build && npm run serve      → http://localhost:4000/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './lib/config.mjs';

const dir = path.resolve(process.argv[2] || PATHS.out);
const port = Number(process.env.PORT || 4000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dir, p);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': types['.html'] });
      const nf = path.join(dir, '404.html');
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${path.relative(process.cwd(), dir) || dir} at http://localhost:${port}/`));
