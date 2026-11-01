import http from 'node:http';
import { Readable } from 'node:stream';
import { handle } from './netlify/functions/bililight.mjs';

const PORT = Number(process.env.PORT || process.argv[2] || 8796);
const ENV = {
  BILI_COOKIE: process.env.BILI_COOKIE || '',
  SECRET: process.env.SECRET || '',
  QN_MAX: process.env.QN_MAX || '',
  PB_OFF: process.env.PB_OFF || '',
};

const srv = http.createServer(async (req, res) => {
  res.on('finish', () => {
    console.log(new Date().toISOString(), req.method, req.url, '->', res.statusCode,
      'cklen=' + String(req.headers['x-bl-ck'] || '').length);
  });
  const u = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const headers = new Headers();
  for (const k in req.headers) if (k !== 'host' && k !== 'connection') headers.append(k, req.headers[k]);
  const r0 = req;
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of r0) chunks.push(c);
    body = Buffer.concat(chunks);
  }
  const r = new Request(u.toString(), { method: req.method, headers, body });
  try {
    const out = await handle(r, ENV, { waitUntil: p => Promise.resolve(p).catch(() => { }) });
    const h = {};
    out.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(out.status, h);
    if (req.method === 'HEAD') return res.end();
    const ct = h['content-type'] || '';
    if (/video\/|audio\/|image\//.test(ct) || Number(h['content-length'] || 0) > 4 << 20) {
      const nodeStream = Readable.fromWeb(out.body);
      nodeStream.on('error', () => res.destroy());
      res.on('close', () => nodeStream.destroy());
      nodeStream.pipe(res);
    } else {
      res.end(Buffer.from(await out.arrayBuffer()));
    }
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('error: ' + (e && e.message));
  }
});
srv.listen(PORT, '0.0.0.0', () => {
  console.log('biliLight listening on ' + PORT);
});
