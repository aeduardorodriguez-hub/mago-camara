'use strict';
const assert = require('assert');
const WebSocket = require('ws');
const MC = require('../public/shared.js');
const { start } = require('../server.js');
const tabla = require('../data/tabla.json');
const M = [6, 2, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

// 1) código de año vs tu tabla, y fórmula completa vs Date (1600-2500)
for (let y = 1900; y <= 2109; y++) { const c = Math.floor((y - 1900) / 10); if (c < 21) assert.strictEqual(tabla.filas[y % 10][c], MC.code(y), 'tabla ' + y); }
let n = 0;
for (let y = 1600; y <= 2500; y++) for (let m = 0; m < 12; m++) for (let d = 1; d <= 28; d++) {
  const wd = new Date(Date.UTC(y, m, d)).getUTCDay();
  assert.strictEqual((d + M[m] + MC.code(y) - (MC.isLeap(y) && m < 2 ? 1 : 0)) % 7, wd, `${y}-${m + 1}-${d}`); n++;
}
console.log('✔ fórmula correcta en', n, 'fechas (1600-2500)');

// 2) reconocimiento de año
const cases = { 'calendario de 1890': 1890, 'Calendario del año 1890': 1890, 'calendario 1890': 1890, '1890 calendario': 1890,
  'calendario de 1.759': 1759, 'calendario del 2150': 2150, 'mil setecientos cincuenta y nueve': 1759, 'dos mil veinticinco': 2025,
  'año mil novecientos ochenta y cuatro': 1984, 'mil': null, 'tiempo en madrid': null, 'calendario 1500': null, 'calendario 12345': null };
for (const [q, y] of Object.entries(cases)) assert.strictEqual(MC.parseYear(q), y, q);
console.log('✔ parseYear', Object.keys(cases).length, 'casos');

// 3) servidor extremo a extremo
(async () => {
  const { server, pin, port } = await start(0, { pin: '4242' });
  const open = (hello) => new Promise((res) => { const ws = new WebSocket(`ws://localhost:${port}/ws`); const q = []; let w = null;
    ws.on('open', () => ws.send(JSON.stringify(hello)));
    ws.on('message', (d) => { const m = JSON.parse(d); if (w) { const f = w; w = null; f(m); } else q.push(m); });
    res({ ws, next: () => new Promise((r) => (q.length ? r(q.shift()) : (w = r))) }); });
  const rx = await open({ t: 'hello', role: 'rx', room: 'main', pin });
  assert.strictEqual((await rx.next()).t, 'ready'); await rx.next(); await rx.next();
  const bad = await open({ t: 'hello', role: 'rx', room: 'main', pin: 'x' });
  assert.strictEqual((await bad.next()).why, 'pin');
  const tx = await open({ t: 'hello', role: 'tx', room: 'main', sid: 'sesion-abcdef-1', label: 'iPhone' });
  assert.strictEqual((await tx.next()).seat, 1);
  assert.strictEqual((await rx.next()).t, 'pres');
  tx.ws.send(JSON.stringify({ t: 'year', year: 1904 }));
  const ev = await rx.next();
  assert.deepStrictEqual([ev.t, ev.seat, ev.year, ev.code, ev.leap, ev.label], ['ev', 1, 1904, 6, true, 'iPhone']);
  await new Promise((r) => setTimeout(r, 350));
  tx.ws.send(JSON.stringify({ t: 'year', year: 1759 }));
  const e2 = await rx.next(); assert.deepStrictEqual([e2.year, e2.code, e2.leap], [1759, 1, false]);
  console.log('✔ servidor: PIN, asiento, evento 1904→6 bisiesto, 1759→1');
  for (const c of [rx, tx, bad]) c.ws.close(); server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
