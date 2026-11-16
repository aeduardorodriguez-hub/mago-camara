/* RECEPTOR del mentalista: web (WebSocket) + voz + mando/teclado + gestos. Salida: pantalla, voz, vibración. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const DEF = { web: 1, voice: 0, pad: 1, gest: 0, speak: 1, seat: 1, vib: 1, dim: 0, keys: 1 };
  const S = {}; for (const k in DEF) S[k] = store.get('rx_' + k, String(DEF[k])) === '1';
  const room = new URL(location.href).searchParams.get('k') || store.get('rx_room', 'main'); store.set('rx_room', room);
  let pin = store.get('rx_pin', '');
  const reqPin = () => { pin = (prompt('PIN del receptor') || '').trim(); store.set('rx_pin', pin); };
  if (!pin) reqPin();

  // ---------- salida ----------
  const board = new Map(); let cur = null;
  const W = MC.CODE_WORDS;
  function render(ev, fresh) {
    $('#who').textContent = ev.seat ? `Persona ${ev.seat}${ev.label ? ' · ' + ev.label : ''}` : ev.label;
    $('#code').textContent = ev.code;
    $('#sub').innerHTML = `${ev.year}${ev.leap ? '<b>bisiesto</b>' : ''}`;
    board.set(ev.seat ? 's' + ev.seat : 'x' + ev.label, ev);
    const rows = [...board.entries()].sort((a, b) => b[1].ts - a[1].ts);
    $('#board').innerHTML = rows.map(([k, e]) => `<div class="row${fresh && e === ev ? ' new' : ''}" data-k="${k}"><span class="s">${e.seat ? 'Persona ' + e.seat : e.label}</span><span class="y">${e.year}</span><span class="b">${e.leap ? 'B' : ''}</span><span class="c">${e.code}</span></div>`).join('');
  }
  function speak(ev) {
    if (!S.speak || !('speechSynthesis' in window)) return;
    const txt = `${S.seat && ev.seat ? 'Persona ' + ev.seat + '. ' : ''}${W[ev.code]}${ev.leap ? '. Bisiesto' : ''}`;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = 1.15; speechSynthesis.speak(u);
  }
  function vibrate(ev) {
    if (!S.vib || !navigator.vibrate) return;
    const p = []; if (ev.code === 0) p.push(700); else for (let i = 0; i < ev.code; i++) p.push(120, 160);
    if (ev.leap) p.push(450, 400);
    navigator.vibrate(p);
  }
  function deliver(ev, o = {}) { cur = ev; render(ev, true); if (!o.silent) { speak(ev); vibrate(ev); } }
  function local(year, src) { // entrada local (voz/mando/gestos/teclado): se muestra y se reenvía al reloj
    const i = MC.info(year); if (!i) return false;
    deliver({ seat: 0, label: src, ...i, ts: Date.now(), src });
    if (ws && ws.readyState === 1 && ready) ws.send(JSON.stringify({ t: 'mirror', year: i.year, src }));
    return true;
  }

  // ---------- red ----------
  let ws, ready = false, backoff = 400;
  function connect() {
    try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); } catch { return setTimeout(connect, 2000); }
    ws.onopen = () => { backoff = 400; ws.send(JSON.stringify({ t: 'hello', role: 'rx', room, pin })); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'ready') { ready = true; $('#dot').classList.add('on'); }
      else if (m.t === 'err') { reqPin(); }
      else if (m.t === 'pres') $('#pres').textContent = m.n + ' conectados';
      else if (m.t === 'hist') { for (const ev of m.events) { board.set('s' + ev.seat, ev); } if (m.events.length) render(m.events[m.events.length - 1], false); }
      else if (m.t === 'clear') { board.clear(); $('#board').innerHTML = ''; }
      else if (m.t === 'ev' && m.src === 'web' && S.web) deliver(m);
    };
    ws.onclose = () => { ready = false; $('#dot').classList.remove('on'); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 8000); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  setInterval(() => { if (ready) ws.send('{"t":"ping"}'); }, 25000);

  // ---------- editor de 4 dígitos (teclado en pantalla, teclado físico, mando, gestos) ----------
  const INIT = ['1', '9', '0', '0']; let d = INIT.slice(), ix = 0;
  const drawDigits = () => { $('#digits').innerHTML = d.map((x, n) => `<i class="${n === ix ? 'cur' : ''}">${x}</i>`).join(''); };
  function submit() { const y = +d.join(''); const ok = local(y, S.gest && gestActive ? 'gesto' : 'manual'); d = INIT.slice(); ix = 0; drawDigits(); if (!ok && navigator.vibrate) navigator.vibrate([40, 40, 40]); }
  function typeDigit(n) { d[ix] = String(n); ix++; if (ix > 3) submit(); else drawDigits(); }
  const act = {
    up() { d[ix] = String((+d[ix] + 1) % 10); drawDigits(); },
    down() { d[ix] = String((+d[ix] + 9) % 10); drawDigits(); },
    right() { if (ix < 3) { ix++; drawDigits(); } else submit(); },
    left() { if (ix > 0) { ix--; drawDigits(); } },
    ok() { submit(); },
    clear() { d = INIT.slice(); ix = 0; drawDigits(); },
  };
  const keys = $('#keys');
  keys.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<button data-n="${n}">${n}</button>`).join('');
  keys.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) typeDigit(b.dataset.n); });

  // teclado físico / mando en modo teclado (remapeable)
  const KM = JSON.parse(store.get('rx_km', 'null') || 'null') || { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', ok: 'Enter', clear: 'Escape' };
  let learning = null;
  const mapEl = $('#map');
  const NAMES = { up: '↑ Subir', down: '↓ Bajar', left: '← Atrás', right: '→ Avanzar', ok: 'OK', clear: 'Borrar' };
  function drawMap() { mapEl.innerHTML = Object.keys(NAMES).map((a) => `<button data-a="${a}" class="${learning === a ? 'learn' : ''}">${NAMES[a]}: ${learning === a ? '…' : KM[a]}</button>`).join(''); }
  mapEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { learning = b.dataset.a; drawMap(); } });
  addEventListener('keydown', (e) => {
    if (learning) { KM[learning] = e.key; store.set('rx_km', JSON.stringify(KM)); learning = null; drawMap(); e.preventDefault(); return; }
    if (!S.pad || e.target.closest && e.target.closest('input,textarea')) return;
    if (/^[0-9]$/.test(e.key)) { typeDigit(e.key); e.preventDefault(); return; }
    for (const a in KM) if (KM[a] === e.key) { act[a](); e.preventDefault(); return; }
  });
  // mando en modo gamepad
  const prev = {};
  (function poll() {
    if (S.pad && navigator.getGamepads) for (const g of navigator.getGamepads()) {
      if (!g) continue; const b = g.buttons; const p = (n) => !!(b[n] && b[n].pressed);
      const st = { up: p(12) || g.axes[1] < -.7, down: p(13) || g.axes[1] > .7, left: p(14) || g.axes[0] < -.7, right: p(15) || g.axes[0] > .7, ok: p(0), clear: p(1) };
      for (const a in st) { if (st[a] && !prev[a]) act[a](); prev[a] = st[a]; }
    }
    requestAnimationFrame(poll);
  })();

  // gestos: N toques = dígito N, dos dedos = 0
  const gest = $('#gest'); let gestActive = false, taps = 0, gt = null;
  const commit = (n) => { taps = 0; clearTimeout(gt); if (navigator.vibrate) navigator.vibrate(25); typeDigit(n); };
  gest.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length >= 2) { commit(0); return; }
    taps = Math.min(taps + 1, 9); clearTimeout(gt); gt = setTimeout(() => commit(taps), 850);
  }, { passive: false });

  // voz: reconoce el año dicho en voz alta
  let rec = null, lastV = { y: 0, t: 0 };
  function voiceOn() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { alert('Este navegador no tiene reconocimiento de voz'); return; }
    if (rec) return;
    rec = new SR(); rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const y = MC.parseYear(e.results[i][0].transcript);
        if (y && !(y === lastV.y && Date.now() - lastV.t < 3000)) { lastV = { y, t: Date.now() }; local(y, 'voz'); }
      }
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { S.voice = false; save(); apply(); } };
    rec.onend = () => { if (S.voice && rec) setTimeout(() => { try { rec.start(); } catch {} }, 250); };
    try { rec.start(); } catch {}
  }
  function voiceOff() { const r = rec; rec = null; if (r) try { r.stop(); } catch {} }

  // ---------- panel / ajustes ----------
  const save = () => { for (const k in S) store.set('rx_' + k, S[k] ? '1' : '0'); };
  function apply() {
    document.querySelectorAll('[data-k]').forEach((i) => { if (i.type === 'checkbox') i.checked = !!S[i.dataset.k]; });
    document.body.classList.toggle('dim', S.dim);
    $('#pad').style.display = S.keys ? '' : 'none';
    gestActive = S.gest; gest.classList.toggle('on', S.gest);
    if (S.voice) voiceOn(); else voiceOff();
  }
  document.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('change', () => { S[i.dataset.k] = i.checked; save(); apply(); }));
  $('#menu').onclick = () => $('#panel').classList.toggle('open');
  $('#clear').onclick = () => { board.clear(); $('#board').innerHTML = ''; if (ready) ws.send('{"t":"clear"}'); };
  $('#pin').onclick = () => { reqPin(); if (ws) ws.close(); };
  $('#testbtn').onclick = () => deliver({ seat: 1, label: 'prueba', ...MC.info(1759), ts: Date.now(), src: 'test' });
  $('#board').addEventListener('click', (e) => { const r = e.target.closest('.row'); const ev = r && board.get(r.dataset.k); if (ev) { render(ev, false); speak(ev); vibrate(ev); } });

  // inicio (iOS/Android exigen un gesto para voz, micrófono y pantalla activa)
  $('#start').addEventListener('click', async () => {
    $('#start').remove();
    try { if ('wakeLock' in navigator) { await navigator.wakeLock.request('screen'); document.addEventListener('visibilitychange', () => { if (!document.hidden) navigator.wakeLock.request('screen').catch(() => {}); }); } } catch {}
    try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch {}
    apply(); connect();
  });
  drawDigits(); drawMap(); apply();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
