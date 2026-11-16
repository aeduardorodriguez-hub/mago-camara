'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const MC = require('./public/shared.js');

const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
// Solo se sirven estos archivos (sin recorrido de directorios).
const ROUTES = { '/': 'index.html', '/r': 'r.html', '/w': 'w.html', '/emitter.js': 'emitter.js', '/style.css': 'style.css',
  '/receiver.js': 'receiver.js', '/watch.js': 'watch.js', '/shared.js': 'shared.js', '/sw.js': 'sw.js',
  '/manifest.webmanifest': 'manifest.webmanifest' };
const PRIVATE = new Set(['/r', '/w', '/receiver.js', '/watch.js']);

function start(port, opts = {}) {
  const PIN = String(opts.pin ?? process.env.PIN ?? crypto.randomInt(1000, 9999));
  const NTFY = opts.ntfyTopic ?? process.env.NTFY_TOPIC ?? '';
  const NTFY_SERVER = process.env.NTFY_SERVER || 'https://ntfy.sh';
  const pinHash = crypto.createHash('sha256').update(PIN).digest();
  const okPin = (p) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(p ?? '')).digest(), pinHash);

  const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    const f = ROUTES[p];
    if (!f) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
    fs.readFile(path.join(PUB, f), (err, data) => {
      if (err) { res.writeHead(500); return res.end('error'); }
      const h = { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' };
      if (PRIVATE.has(p)) h['x-robots-tag'] = 'noindex, nofollow';
      res.writeHead(200, h); res.end(data);
    });
  });

  const rooms = new Map();
  const room = (id) => { let r = rooms.get(id); if (!r) { r = { seats: new Map(), tx: new Map(), rx: new Set(), hist: [] }; rooms.set(id, r); } return r; };
  const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  const toReceivers = (r, o, onlyWatch) => { for (const c of r.rx) if (!onlyWatch || c.role === 'watch') send(c.ws, o); };
  const presence = (r) => toReceivers(r, { t: 'pres', n: r.tx.size });

  function notify(ev) {
    if (!NTFY) return;
    const body = `${ev.code}${ev.leap ? ' B' : ''}`;
    fetch(`${NTFY_SERVER}/${encodeURIComponent(NTFY)}`, { method: 'POST', body, headers: { Title: `#${ev.seat || '-'}`, Priority: 'high' } }).catch(() => {});
  }

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
  wss.on('connection', (ws) => {
    ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
    let ctx = null, lastYear = 0;
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (!ctx) {
        if (m.t !== 'hello') return;
        let id = String(m.room || 'main').toLowerCase(); if (!/^[a-z0-9_-]{1,32}$/.test(id)) id = 'main';
        const r = room(id);
        if (m.role === 'tx') {
          const sid = String(m.sid || '').slice(0, 64); if (sid.length < 8) return ws.close();
          let seat = r.seats.get(sid);
          if (!seat) { if (r.seats.size >= 300) return ws.close(); seat = r.seats.size + 1; r.seats.set(sid, seat); }
          const old = r.tx.get(sid); if (old && old !== ws) try { old.close(); } catch {}
          r.tx.set(sid, ws);
          ctx = { role: 'tx', r, sid, seat, label: String(m.label || '').replace(/[^\w .-]/g, '').slice(0, 16) };
          send(ws, { t: 'ready', seat }); presence(r);
        } else if (m.role === 'rx' || m.role === 'watch') {
          if (!okPin(m.pin)) { setTimeout(() => { send(ws, { t: 'err', why: 'pin' }); ws.close(); }, 800); return; }
          const c = { ws, role: m.role }; r.rx.add(c); ctx = { role: m.role, r, c };
          send(ws, { t: 'ready' }); send(ws, { t: 'hist', events: r.hist }); send(ws, { t: 'pres', n: r.tx.size });
        }
        return;
      }
      const { r } = ctx;
      if (m.t === 'ping') return send(ws, { t: 'pong' });
      if (ctx.role === 'tx' && m.t === 'year') {
        const now = Date.now(); if (now - lastYear < 300) return; lastYear = now;
        const i = MC.info(m.year); if (!i) return;
        const ev = { t: 'ev', seat: ctx.seat, label: ctx.label, ...i, ts: now, src: 'web' };
        r.hist.push(ev); if (r.hist.length > 100) r.hist.shift();
        toReceivers(r, ev); notify(ev);
      } else if (ctx.role === 'rx' && m.t === 'mirror') { // el receptor ya lo mostró; se reenvía al reloj / notificación
        const i = MC.info(m.year); if (!i) return;
        const ev = { t: 'ev', seat: 0, label: String(m.src || 'manual').slice(0, 10), ...i, ts: Date.now(), src: 'local' };
        toReceivers(r, ev, true); notify(ev);
      } else if (ctx.role === 'rx' && m.t === 'clear') { r.hist = []; toReceivers(r, { t: 'clear' }); }
    });
    ws.on('close', () => {
      if (!ctx) return;
      if (ctx.role === 'tx') { if (ctx.r.tx.get(ctx.sid) === ws) { ctx.r.tx.delete(ctx.sid); presence(ctx.r); } }
      else ctx.r.rx.delete(ctx.c);
    });
  });
  const hb = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch {} } }, 30000);
  server.on('close', () => clearInterval(hb));

  return new Promise((resolve) => server.listen(port, () => resolve({ server, pin: PIN, port: server.address().port })));
}

module.exports = { start };
if (require.main === module) {
  start(Number(process.env.PORT) || 3000).then(({ pin, port }) => {
    console.log(`Calendario mental en http://localhost:${port}`);
    console.log(`  Emisor   (espectador): /            (sala opcional: /?k=nombre)`);
    console.log(`  Receptor (mentalista): /r   PIN: ${pin}`);
    console.log(`  Reloj:                 /w`);
  });
}
