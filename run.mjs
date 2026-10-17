/* biliLight 自托管运行器（无 wrangler / 无 npm 依赖，Node 18+）
 * 用法（Linux/macOS/安卓Termux）：
 *   BILI_COOKIE='SESSDATA=xxx; bili_jct=yyy' node run.mjs 8796
 * Windows cmd：
 *   set "BILI_COOKIE=SESSDATA=xxx; bili_jct=yyy" && node run.mjs 8796
 * 手机（同 WiFi）打开 http://<这台机器IP>:8796/
 */
import http from 'node:http';
import { Readable } from 'node:stream';
import { handle } from './_worker.js';

const PORT = Number(process.argv[2] || 8796);
const ENV = {
  BILI_COOKIE: process.env.BILI_COOKIE || '',
  SECRET: process.env.SECRET || '',
  QN_MAX: process.env.QN_MAX || '',
};

const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const headers = new Headers();
  for (const k in req.headers) if (k !== 'host' && k !== 'connection') headers.append(k, req.headers[k]);
  const r = new Request(u.toString(), { method: req.method, headers });
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
    res.end('worker error: ' + (e && e.message));
  }
});
srv.listen(PORT, '0.0.0.0', () => {
  console.log('biliLight 自托管(流式): http://0.0.0.0:' + PORT + '/  cookie=' + (ENV.BILI_COOKIE ? '已配置' : '未配置(匿名720P)'));
});
