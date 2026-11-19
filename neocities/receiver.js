/* RECEPTOR del mentalista: web (ntfy.sh) + voz + mando/teclado + gestos configurables. Salida: pantalla, voz, vibración, reloj. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const isApp = !!window.AndroidApp, W = MC.CODE_WORDS;
  const srvOk = (v) => /^(https:\/\/|http:\/\/localhost)/i.test(v);
  const srvVal = () => store.get('rx_srv', '').trim();
  const NTFY = (srvOk(srvVal()) ? srvVal() : 'https://ntfy.sh').replace(/\/?$/, '/');
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // ---------- ajustes ----------
  const DEF = { web: 1, voice: 0, pad: 1, gest: 0, speak: 1, seat: 1, vib: 1, dim: 0, watch: 0, autosend: 1, askname: 0 };
  const S = {}; for (const k in DEF) S[k] = store.get('rx_' + k, String(DEF[k])) === '1';
  S.gap = +store.get('rx_gap', '650') || 650; S.sens = +store.get('rx_sens', '30') || 30; S.clearSec = +store.get('rx_clearSec', '6');
  const saveS = () => { for (const k in DEF) store.set('rx_' + k, S[k] ? '1' : '0'); store.set('rx_gap', S.gap); store.set('rx_sens', S.sens); store.set('rx_clearSec', S.clearSec); };

  // ---------- clave y enlace del espectador ----------
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const urlKey = (new URL(location.href).searchParams.get('k') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  const key = urlKey || store.get('rx_key', '') || rnd(); store.set('rx_key', key);
  { const fq = new URL(location.href).searchParams.get('form'); if (['auto', 'phone', 'round', 'square'].includes(fq)) store.set('rx_form', fq); }
  if (urlKey && !isApp) history.replaceState(null, '', location.pathname);
  const TOPIC = 'mc-' + key;
  const siteVal = () => store.get('rx_site', '') || (isApp ? '' : new URL('./', location.href).href);
  function linkFor() {
    let s = siteVal().trim(); if (!/^https?:\/\//i.test(s)) return '';
    s = /\.html?$/i.test(s) ? s.replace(/[^/]*$/, '') : s.replace(/\/?$/, '/');
    try { return new URL('index.html?k=' + key + (srvOk(srvVal()) ? '&s=' + encodeURIComponent(srvVal()) : '') + (S.askname ? '&n=1' : ''), s).href; } catch { return ''; }
  }

  // ---------- utilidades de interfaz ----------
  let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400); }
  function ask(msg, yes = 'Aceptar') { return new Promise((res) => { $('#dlgMsg').textContent = msg; $('#dlgYes').textContent = yes; $('#dlg').hidden = false; const done = (v) => { $('#dlg').hidden = true; res(v); }; $('#dlgYes').onclick = () => done(true); $('#dlgNo').onclick = () => done(false); }); }
  async function copyText(t) {
    if (isApp && window.AndroidApp.copy) { window.AndroidApp.copy(t); return true; }
    try { await navigator.clipboard.writeText(t); return true; } catch {}
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
  }
  const ARROW = { U: 'i-U', D: 'i-D', L: 'i-L', R: 'i-R' };
  const chips = (seq) => [...seq].map((d) => `<i><svg><use href="#${ARROW[d]}"/></svg></i>`).join('');
  const arrows = (seq) => [...seq].map((d) => ({ U: '↑', D: '↓', L: '←', R: '→' }[d])).join('');

  // ---------- salida ----------
  const board = new Map(); let cur = null;
  let wmode = 'auto';   // vista de reloj: auto | hero | list
  const LBL = { voz: 'Entrada por voz', gesto: 'Entrada por gestos', manual: 'Entrada manual', prueba: 'Prueba' };
  // Espectadores: número por orden de llegada (ESP 1, ESP 2…), editable; el nombre es opcional
  let seats = {}, names = {};
  try { seats = JSON.parse(store.get('rx_seats', '{}')) || {}; } catch {}
  try { names = JSON.parse(store.get('rx_names', '{}')) || {}; } catch {}
  const saveSeats = () => { store.set('rx_seats', JSON.stringify(seats)); store.set('rx_names', JSON.stringify(names)); };
  const seatOf = (sid) => { if (!seats[sid]) { seats[sid] = Math.max(0, ...Object.values(seats)) + 1; saveSeats(); } return seats[sid]; };
  const seatNum = (e) => (e.sid ? seats[e.sid] || e.seat || 0 : 0);
  const pname = (e) => (e.sid && names[e.sid]) || e.pname || '';
  const whoTxt = (e) => (seatNum(e) ? 'ESP ' + seatNum(e) : (LBL[e.label] || e.label));
  const subTxt = (e) => (seatNum(e) ? (e.src === 'manual' ? [pname(e), e.label].filter(Boolean).join(' · ') : (pname(e) || e.label || '')) : '');
  const keyOf = (e) => (e.sid ? 'w' + e.sid : 'x' + e.label);
  // Respaldo: el año tecleado/dicho/por gestos se guarda en el número ESP de "destino" sin tocar a los demás
  function sidForSeat(n) {
    const f = Object.keys(seats).find((k) => seats[k] === n); if (f) return f;
    let k = 'm' + n; while (seats[k] !== undefined) k += 'x'; seats[k] = n; saveSeats(); return k;
  }
  let target = 0;
  const nextFree = () => { const used = new Set([...board.values()].map(seatNum)); let n = 1; while (used.has(n)) n++; return n; };
  const curTarget = () => target || nextFree();
  function setTarget(n) { target = Math.max(1, Math.min(20, n)); drawTarget(); }
  function drawTarget() {
    const t = curTarget(), ex = [...board.values()].find((e) => seatNum(e) === t);
    $('#tgtNum').textContent = 'ESP ' + t; $('#tgtSub').textContent = ex ? `ya tiene ${ex.year} · se reemplazará` : 'libre';
    drawWatch();
  }
  function showEv(ev, fresh) {
    $('#hero').hidden = false; $('#empty').hidden = true;
    $('#who').textContent = whoTxt(ev) + (subTxt(ev) ? ' · ' + subTxt(ev) : '');
    $('#code').textContent = ev.code; $('#yr').textContent = ev.year; $('#leap').hidden = !ev.leap;
    const h = $('#hero'); h.classList.remove('pop'); void h.offsetWidth; if (fresh) h.classList.add('pop');
    board.set(keyOf(ev), ev); drawBoard(fresh ? ev : null); drawLast(ev); drawTarget();
  }
  // franja fija con el último resultado (visible en todas las pestañas y sobre la pantalla de gestos)
  function drawLast(ev) {
    const html = `<b>${esc(whoTxt(ev))}</b><span>${ev.year}</span><strong>${ev.code}</strong>${ev.leap ? '<em>BISIESTO</em>' : ''}`;
    $('#lastRow').hidden = false; $('#lastRow').innerHTML = html; $('#gpRes').innerHTML = html;
  }
  function drawBoard(hl) {
    const all = [...board.entries()];
    const web = all.filter(([, e]) => e.sid).sort((a, b) => seatNum(a[1]) - seatNum(b[1]));
    const loc = all.filter(([, e]) => !e.sid).sort((a, b) => b[1].ts - a[1].ts);
    const row = ([k, e]) => `<div class="person${e === hl ? ' new' : ''}" data-k="${esc(k)}"><div class="av">${seatNum(e) || '·'}</div><div class="pi"><b>${esc(whoTxt(e))}</b><span>${esc(subTxt(e))}</span></div><div class="py">${e.year}</div>${e.leap ? '<span class="pb">BISIESTO</span>' : ''}<div class="pc">${e.code}</div>${e.sid ? `<button class="icb ed" data-edit="${esc(e.sid)}" aria-label="Editar espectador"><svg><use href="#i-edit"/></svg></button>` : ''}</div>`;
    $('#board').innerHTML = [...web, ...loc].map(row).join('');
    $('#boardHead').hidden = !board.size; $('#empty').hidden = board.size > 0;
    if (!board.size) { $('#hero').hidden = true; $('#lastRow').hidden = true; }
    drawWatch();
  }
  function speak(ev) {
    if (!S.speak || !('speechSynthesis' in window)) return;
    const txt = `${S.seat && seatNum(ev) ? 'Espectador ' + seatNum(ev) + '. ' : ''}${W[ev.code]}${ev.leap ? '. Bisiesto' : ''}`;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = 1.15; speechSynthesis.speak(u); } catch {}
  }
  function vibrate(ev) {
    if (!S.vib) return; const p = [];
    if (ev.code === 0) p.push(700); else for (let i = 0; i < ev.code; i++) p.push(120, 160);
    if (ev.leap) p.push(450, 400); buzz(p);
  }
  function deliver(ev, o = {}) { cur = ev; if (ev.src === 'web') wmode = 'auto'; showEv(ev, !o.silent); if (!o.silent) { speak(ev); vibrate(ev); } }
  function local(year, src) {
    const i = MC.info(year);
    if (!i) { toast(`${year} no está entre 1600 y 9999`); buzz([40, 40, 40]); return false; }
    const n = curTarget(), sid = sidForSeat(n); target = 0;
    deliver({ sid, seat: n, pname: '', label: src, ...i, ts: Date.now(), src: 'manual' }); mirror(i, n); return true;
  }

  // ---------- red: ntfy.sh por SSE ----------
  const seen = new Set(); let es = null, lastT = Math.floor(Date.now() / 1000) - 90;
  function mirror(i, seat) {
    if (!S.watch) return;
    fetch(`${NTFY}${TOPIC}-w?title=${encodeURIComponent('#' + (seat || '-'))}&priority=5`, { method: 'POST', body: `${i.code}${i.leap ? ' B' : ''}` }).catch(() => {});
  }
  let offT = null;   // null = sin alerta pendiente · número = cuenta atrás · 'on' = alerta ya mostrada
  const online = (on) => {
    $('#dot').classList.toggle('on', on);
    if (on) { if (typeof offT === 'number') clearTimeout(offT); offT = null; $('#bkBtn').classList.remove('alert'); $('#pres').textContent = 'En línea'; }
    else {
      if (offT === null) offT = setTimeout(() => { offT = 'on'; $('#bkBtn').classList.add('alert'); $('#pres').textContent = 'Sin conexión'; toast('Sin conexión: usa «Respaldo» si lo necesitas'); buzz([200, 100, 200]); drawWatch(); }, 6000);
      if (offT !== 'on') $('#pres').textContent = 'Reconectando…';
    }
    drawWatch();
  };

  function connect() {
    if (es) es.close();
    es = new EventSource(`${NTFY}${TOPIC}/sse?since=${lastT}`);
    es.onopen = () => online(true);
    es.onerror = () => online(false);
    es.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.event !== 'message' || !m.id || seen.has(m.id)) return; seen.add(m.id);
      if (m.time) lastT = Math.max(lastT, m.time);
      let p; try { p = JSON.parse(m.message); } catch { return; }
      const i = MC.info(p.y); if (!i || !S.web || typeof p.s !== 'string') return;
      const sid = p.s.slice(0, 12), seat = seatOf(sid), old = Date.now() / 1000 - (m.time || 0) > 30;
      const prevEv = board.get('w' + sid); if (prevEv && prevEv.ts > (m.time || Date.now() / 1000) * 1000) return;   // gana siempre el más reciente
      deliver({ sid, seat, pname: String(p.n || '').replace(/[<>&"]/g, '').slice(0, 20), label: String(p.l || '').slice(0, 12), ...i, ts: (m.time || Date.now() / 1000) * 1000, src: 'web' }, { silent: old });
      if (!old) mirror(i, seat);
    };
  }
  setInterval(() => { if (es && es.readyState === 2) connect(); }, 5000);

  // ---------- año tecleado (4 dígitos) ----------
  let d = ['', '', '', ''], ix = 0, lastSrc = 'manual', clr = null;
  function drawDigits() {
    $('#digits').innerHTML = d.map((x, n) => `<i class="${x ? 'f' : ''}${n === ix ? ' c' : ''}">${x || '–'}</i>`).join('');
    $('#gpDots').innerHTML = d.map((x) => `<i class="${x ? 'f' : ''}"></i>`).join('');
    $('#gpDigits').textContent = d.map((x) => x || '·').join(' ');
    drawWatch();
  }
  function resetDigits() { clearTimeout(clr); d = ['', '', '', '']; ix = 0; drawDigits(); }
  // los dígitos sueltos se borran solos: evita que un gesto accidental se mezcle con el año siguiente
  function armClear() { clearTimeout(clr); if (S.clearSec > 0 && ix > 0 && ix < 4) clr = setTimeout(() => { resetDigits(); toast('Dígitos sueltos borrados'); buzz([30, 60, 30]); }, S.clearSec * 1000); }
  // validación al teclear: nunca se acepta un dígito que haga imposible un año de 1600 a 9999
  function badDigit(n) {
    const t = d.slice(0, ix).join('') + n;
    if (t.length === 1 && n === '0') return 'Un año no empieza por 0';
    if (t.length === 2 && t[0] === '1' && +t[1] < 6) return 'Con 1 delante el año debe ser 16… o mayor';
    return '';
  }
  function sendYear() {
    if (ix < 4) { buzz([40, 40, 40]); toast(ix ? `Faltan dígitos (llevas ${d.slice(0, ix).join('')})` : 'No hay año tecleado'); return; }
    const y = +d.join(''), src = lastSrc; resetDigits(); local(y, src);
  }
  function typeDigit(n, src) {
    n = String(n); lastSrc = src || lastSrc;
    if (ix > 3) { buzz([40, 40, 40]); toast('Ya hay 4 dígitos: envía el año o bórralo'); return; }
    const bad = badDigit(n); if (bad) { buzz([40, 40, 40]); toast(bad); return; }
    d[ix] = n; ix++; drawDigits();
    if (ix > 3) { clearTimeout(clr); if (S.autosend) sendYear(); } else armClear();
  }
  const A = {
    back() { if (ix > 0) { ix--; d[ix] = ''; drawDigits(); armClear(); } },
    clear() { resetDigits(); },
    send() { sendYear(); },
    replay() { if (cur) { showEv(cur, false); speak(cur); vibrate(cur); } else toast('Aún no hay ningún código'); },
    dim() { S.dim = !S.dim; saveS(); apply(); },
    listen() { listenOnce(); },
    tnext() { setTarget(curTarget() + 1); toast('Destino: ESP ' + curTarget()); buzz(15); },
    tprev() { setTarget(curTarget() - 1); toast('Destino: ESP ' + curTarget()); buzz(15); },
  };
  const ACTS = [...Array(10).keys()].map((n) => 'd' + n).concat(['back', 'clear', 'send', 'replay', 'listen', 'tprev', 'tnext', 'dim']);
  const ACT_NAME = { back: 'Borrar el último dígito', clear: 'Limpiar el año tecleado', send: 'Enviar el año (cuando hay 4 dígitos)', replay: 'Repetir el último código', listen: 'Escuchar un año por voz (una vez)', tnext: 'Destino: siguiente espectador', tprev: 'Destino: espectador anterior', dim: 'Pantalla discreta (activar/desactivar)' };
  const actName = (a) => /^d\d$/.test(a) ? 'Dígito ' + a[1] : ACT_NAME[a] || a;
  function run(a, src) { if (/^d\d$/.test(a)) typeDigit(a[1], src || 'gesto'); else if (A[a]) A[a](); }
  $('#keys').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<button data-n="${n}">${n}</button>`).join('');
  $('#keys').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { buzz(15); typeDigit(b.dataset.n, 'manual'); } });
  $('#kBack').onclick = () => A.back(); $('#kReplay').onclick = () => A.replay();

  // ---------- gestos: lista editable + motor ----------
  const DEF_G = [['UU', 'd1'], ['UR', 'd2'], ['UD', 'd3'], ['UL', 'd4'], ['RU', 'd5'], ['RR', 'd6'], ['RD', 'd7'], ['RL', 'd8'], ['DU', 'd9'], ['DR', 'd0'], ['DD', 'back'], ['DL', 'clear'], ['LU', 'replay'], ['LD', 'send'], ['LR', 'listen']];
  const defaults = () => DEF_G.map(([seq, act], i) => ({ id: 'g' + i, seq, act }));
  const okG = (g) => g && /^[UDLR]{1,5}$/.test(g.seq) && ACTS.includes(g.act);
  let G; try { const a = JSON.parse(store.get('rx_g2', 'null')); G = Array.isArray(a) && a.every(okG) ? a : defaults(); } catch { G = defaults(); }
  const saveG = () => { store.set('rx_g2', JSON.stringify(G)); drawGestures(); };
  let buf = '', gt = null, sink = null, tab = 'home', prT = null;

  function drawGestures() {
    $('#glist').innerHTML = G.length ? G.map((g) => `<div class="g"><div class="seq">${chips(g.seq)}</div><div class="ga">${esc(actName(g.act))}</div><button class="icb" data-edit="${g.id}" aria-label="Editar"><svg><use href="#i-edit"/></svg></button><button class="icb d" data-del="${g.id}" aria-label="Eliminar"><svg><use href="#i-trash"/></svg></button></div>`).join('') : '<div class="card muted">No hay gestos. Pulsa «Nuevo gesto».</div>';
    $('#helpGest').innerHTML = `<table class="gt">${G.map((g) => `<tr><td>${arrows(g.seq)}</td><td>${esc(actName(g.act))}</td></tr>`).join('')}</table><p class="muted" style="margin-top:10px">Los mismos movimientos sirven con la cruceta del mando.</p>`;
  }
  function showSeq(s, msg, bad) {
    const el = $('#prSeq'); el.classList.toggle('ph', !s); el.textContent = s ? arrows(s) : 'Desliza aquí o usa la cruceta';
    $('#gpSeq').textContent = arrows(s); const a = $('#prAct'); a.textContent = msg || ' '; a.classList.toggle('bad', !!bad);
  }
  // Entrada de direcciones (pantalla, teclado o mando). Se ignoran duplicados entre fuentes
  // (un mando que llega a la vez como teclado y como gamepad) y las teclas mantenidas.
  const lastAt = {}; const inLog = [];
  function logIn(t) { inLog.unshift(t); inLog.length = Math.min(inLog.length, 6); $('#inLog').innerHTML = inLog.map(esc).join('<br>'); }
  function dir(dn, src, raw) {
    const now = performance.now(), p = lastAt[dn];
    if (p && p.s !== src && now - p.t < 200) { logIn(`${src}${raw ? ' · ' + raw : ''} → ${arrows(dn)}  (duplicado de ${p.s}, ignorado)`); return; }
    lastAt[dn] = { t: now, s: src };
    logIn(`${src}${raw ? ' · ' + raw : ''} → ${arrows(dn)}`);
    if (sink) return sink(dn);
    buzz(12); buf += dn; showSeq(buf); clearTimeout(gt);
    const longer = G.some((g) => g.seq.length > buf.length && g.seq.startsWith(buf));
    if (!longer) return resolve();
    gt = setTimeout(resolve, S.gap);   // hay gestos más largos: se espera la pausa
  }
  function resolve() {
    clearTimeout(gt); const s = buf; buf = ''; const g = G.find((x) => x.seq === s);
    if (!g) { buzz([40, 40, 40]); showSeq(s, 'Sin gesto asignado', true); }
    else if (tab === 'gest') showSeq(s, actName(g.act));
    else { buzz(10); run(g.act, 'gesto'); showSeq(s); }
    clearTimeout(prT); prT = setTimeout(() => showSeq(''), 1600);
  }
  function swipe(el, cb) {
    let sx = 0, sy = 0, id = null;
    el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; id = e.pointerId; });
    el.addEventListener('pointerup', (e) => { if (id !== e.pointerId) return; id = null; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < S.sens) return; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U')); });
    el.addEventListener('pointercancel', () => { id = null; });
  }
  swipe($('#practice'), (x) => dir(x, 'pantalla')); swipe($('#gestPad'), (x) => dir(x, 'pantalla')); swipe($('#cap'), (x) => dir(x, 'pantalla'));

  // editor de gestos
  let edit = null;
  function drawEditor() {
    $('#capSeq').innerHTML = edit.seq ? chips(edit.seq) : '<span class="muted">Desliza aquí…</span>';
    $('#acts').innerHTML = ACTS.slice(0, 10).map((a) => `<button data-a="${a}" class="${edit.act === a ? 'on' : ''}">${a[1]}</button>`).join('') + ACTS.slice(10).map((a) => `<button class="wd ${edit.act === a ? 'on' : ''}" data-a="${a}">${esc(actName(a))}</button>`).join('');
  }
  function openEditor(id) {
    const g = id && G.find((x) => x.id === id); edit = g ? { id, seq: g.seq, act: g.act } : { id: null, seq: '', act: '' };
    $('#shT').textContent = g ? 'Editar gesto' : 'Nuevo gesto'; $('#shDel').hidden = !g; $('#shMsg').textContent = '';
    sink = (dn) => { if (edit.seq.length >= 5) { $('#shMsg').textContent = 'Máximo 5 movimientos.'; return; } edit.seq += dn; $('#shMsg').textContent = ''; buzz(12); drawEditor(); };
    drawEditor(); $('#sheet').hidden = false;
  }
  function closeEditor() { $('#sheet').hidden = true; sink = null; edit = null; }
  $('#sheet .arrows').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.d === 'x') { edit.seq = edit.seq.slice(0, -1); drawEditor(); } else sink(b.dataset.d); });
  $('#acts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { edit.act = b.dataset.a; drawEditor(); } });
  $('#shX').onclick = closeEditor; $('#sheet').addEventListener('pointerdown', (e) => { if (e.target.id === 'sheet') closeEditor(); });
  $('#shSave').onclick = () => {
    if (!edit.seq) return ($('#shMsg').textContent = 'Dibuja al menos un movimiento.');
    if (!edit.act) return ($('#shMsg').textContent = 'Elige qué debe hacer el gesto.');
    const dup = G.find((g) => g.seq === edit.seq && g.id !== edit.id);
    if (dup) return ($('#shMsg').textContent = `Ese gesto ya está en uso: ${actName(dup.act)}.`);
    if (edit.id) Object.assign(G.find((g) => g.id === edit.id), { seq: edit.seq, act: edit.act }); else G.push({ id: 'g' + Date.now().toString(36), seq: edit.seq, act: edit.act });
    saveG(); closeEditor(); toast('Gesto guardado');
  };
  $('#shDel').onclick = async () => { if (await ask('¿Eliminar este gesto?', 'Eliminar')) { G = G.filter((g) => g.id !== edit.id); saveG(); closeEditor(); toast('Gesto eliminado'); } };
  $('#gnew').onclick = () => openEditor(null);
  $('#greset').onclick = async () => { if (await ask('¿Restaurar los gestos predeterminados? Se perderán tus cambios.', 'Restaurar')) { G = defaults(); saveG(); toast('Gestos restaurados'); } };
  $('#glist').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
    if (ed) openEditor(ed.dataset.edit);
    if (de && await ask('¿Eliminar este gesto?', 'Eliminar')) { G = G.filter((g) => g.id !== de.dataset.del); saveG(); toast('Gesto eliminado'); }
  });
  $('#gap').oninput = (e) => { S.gap = +e.target.value; $('#gapv').textContent = S.gap + ' ms'; saveS(); };
  $('#sens').oninput = (e) => { S.sens = +e.target.value; $('#sensv').textContent = S.sens + ' px'; saveS(); };
  $('#clearSec').oninput = (e) => { S.clearSec = +e.target.value; $('#clearv').textContent = S.clearSec ? S.clearSec + ' s' : 'nunca'; saveS(); };

  // ---------- mando / teclado ----------
  // Cada acción del mando (↑ ↓ ← → y dos botones) se puede asignar a una tecla o a un botón/eje del gamepad.
  const BIND_DEF = { U: { k: 'ArrowUp', g: 12 }, D: { k: 'ArrowDown', g: 13 }, L: { k: 'ArrowLeft', g: 14 }, R: { k: 'ArrowRight', g: 15 }, ok: { k: 'Enter', g: 0 }, clear: { k: 'Escape', g: 1 } };
  let BIND = JSON.parse(JSON.stringify(BIND_DEF)), learned = {};
  try { learned = JSON.parse(store.get('rx_bind3', '{}')); for (const a in learned) if (BIND[a]) BIND[a] = learned[a]; } catch {}
  const BN = { U: '↑ Arriba', D: '↓ Abajo', L: '← Izquierda', R: '→ Derecha', ok: 'Botón A (repetir)', clear: 'Botón B (limpiar)' };
  const bindTxt = (b) => [b.k && 'tecla ' + b.k, b.g !== undefined && 'botón ' + b.g, b.ax !== undefined && `eje ${b.ax}${b.s > 0 ? '+' : '−'}`].filter(Boolean).join(' / ');
  let learnQ = [];
  const learning = () => learnQ[0] || null;
  function drawMap() {
    $('#map').innerHTML = Object.keys(BN).map((a) => `<button data-a="${a}" class="${learning() === a ? 'learn' : ''}">${BN[a]}: <b>${learning() === a ? 'pulsa el botón…' : esc(bindTxt(BIND[a]))}</b></button>`).join('');
    $('#wiz').textContent = learnQ.length ? `Pulsa en el mando: ${BN[learnQ[0]]}` : 'Asignar la cruceta paso a paso';
  }
  function learn(b) {
    const a = learning(); if (!a) return;
    for (const o in BIND) if (o !== a && ((b.k && BIND[o].k === b.k) || (b.g !== undefined && BIND[o].g === b.g) || (b.ax !== undefined && BIND[o].ax === b.ax && BIND[o].s === b.s))) { toast(`Ese botón ya es «${BN[o]}»`); return; }
    BIND[a] = b; learned[a] = b; store.set('rx_bind3', JSON.stringify(learned)); learnQ.shift(); buzz(20);
    if (!learnQ.length) toast('Mando asignado ✓'); drawMap();
  }
  $('#map').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { learnQ = [b.dataset.a]; drawMap(); } });
  $('#wiz').onclick = () => { learnQ = learnQ.length ? [] : ['U', 'D', 'L', 'R']; drawMap(); };
  $('#resetKeys').onclick = () => { BIND = JSON.parse(JSON.stringify(BIND_DEF)); learned = {}; learnQ = []; store.set('rx_bind3', '{}'); drawMap(); };
  const padOn = () => S.pad || sink || tab === 'gest';
  const keyId = (e) => (e.key && e.key !== 'Unidentified' ? e.key : e.code);
  function fire(a, src, raw) { if ('UDLR'.includes(a)) dir(a, src, raw); else if (!sink) { a === 'ok' ? A.replay() : A.clear(); } }
  addEventListener('keydown', (e) => {
    const id = keyId(e);
    if (learning()) { e.preventDefault(); if (!e.repeat) learn({ k: id }); return; }
    if (!padOn() || (e.target.matches && e.target.matches('input,textarea'))) return;
    if (e.repeat) { e.preventDefault(); return; }            // tecla mantenida: no cuenta
    if (/^[0-9]$/.test(e.key) && !sink) { typeDigit(e.key, 'manual'); e.preventDefault(); return; }
    for (const a in BIND) if (BIND[a].k === id) { e.preventDefault(); fire(a, 'teclado', id); return; }
  });
  const prev = {};
  (function poll() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    for (const g of pads) {
      const down = (b) => (b.g !== undefined && g.buttons[b.g] && g.buttons[b.g].pressed) || (b.ax !== undefined && Math.abs(g.axes[b.ax] || 0) > .6 && Math.sign(g.axes[b.ax]) === b.s);
      if (learning()) {                                       // asignación: primer botón o eje que se pulse
        let found = null;
        g.buttons.forEach((bt, i) => { if (!found && bt.pressed && !prev['L' + i]) found = { g: i }; prev['L' + i] = bt.pressed; });
        g.axes.forEach((v, i) => { const k = 'A' + i; if (!found && Math.abs(v) > .6 && !prev[k]) found = { ax: i, s: Math.sign(v) }; prev[k] = Math.abs(v) > .6; });
        if (found) learn(found); continue;
      }
      if (!padOn()) continue;
      for (const a in BIND) {
        const b = BIND[a], k = g.index + a; let on = !!down(b);
        if (!on && learned[a] === undefined && 'UDLR'.includes(a)) on = (a === 'U' && g.axes[1] < -.7) || (a === 'D' && g.axes[1] > .7) || (a === 'L' && g.axes[0] < -.7) || (a === 'R' && g.axes[0] > .7);
        if (on && !prev[k]) fire(a, 'mando', b.g !== undefined ? 'botón ' + b.g : 'eje ' + b.ax);
        prev[k] = on;
      }
    }
    requestAnimationFrame(poll);
  })();

  // ---------- voz ----------
  let rec = null, lastV = { y: 0, t: 0 };
  function voiceOn() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { S.voice = false; saveS(); apply(); toast('Este navegador no tiene reconocimiento de voz'); return; }
    if (rec) return;
    rec = new SR(); rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const y = MC.parseYear(e.results[i][0].transcript);
        if (y && !(y === lastV.y && Date.now() - lastV.t < 3000)) { lastV = { y, t: Date.now() }; local(y, 'voz'); }
      }
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { S.voice = false; saveS(); apply(); toast('Permite el micrófono para usar la voz'); } };
    rec.onend = () => { if (S.voice && rec) setTimeout(() => { try { rec.start(); } catch {} }, 250); };
    try { rec.start(); } catch {}
  }
  // Escucha puntual (respaldo): no deja el micrófono abierto ni capta conversaciones de fondo
  let onceRec = null;
  const micUi = (on) => { $('#bkVoice').classList.toggle('on', on); $('#bkVoice span').textContent = on ? 'Escuchando… di el año' : 'Decir el año'; };
  function listenOnce() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Este navegador no tiene reconocimiento de voz'); return; }
    if (onceRec) { try { onceRec.stop(); } catch {} onceRec = null; micUi(false); return; }
    const r = new SR(); onceRec = r; r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    const done = () => { if (onceRec === r) { onceRec = null; micUi(false); } };
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const y = MC.parseYear(e.results[i][0].transcript);
        if (y) { local(y, 'voz'); try { r.stop(); } catch {} done(); return; }
      }
      toast('No entendí un año: repítelo');
    };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Permite el micrófono para usar la voz'); done(); };
    r.onend = done; micUi(true); buzz(20);
    try { r.start(); } catch { done(); }
    setTimeout(() => { if (onceRec === r) { try { r.stop(); } catch {} done(); } }, 9000);
  }
  function voiceOff() { const r = rec; rec = null; if (r) try { r.stop(); } catch {} }

  // ---------- respaldo de emergencia ----------
  const openBk = () => { $('#bk').hidden = false; drawTarget(); };
  const closeBk = () => { $('#bk').hidden = true; if (onceRec) { try { onceRec.stop(); } catch {} } };
  $('#bkBtn').onclick = () => ($('#bk').hidden ? openBk() : closeBk()); $('#bkOpen').onclick = openBk; $('#bkX').onclick = closeBk;
  $('#tgtPrev').onclick = () => A.tprev(); $('#tgtNext').onclick = () => A.tnext(); $('#bkVoice').onclick = () => listenOnce();

  // ---------- ajustes / enlace / QR ----------
  function drawLink() {
    const l = linkFor(); $('#linkBox').textContent = l || 'Escribe arriba la dirección de tu sitio para generar el enlace.';
    const q = $('#qr'); q.classList.toggle('on', !!l);
    if (l) { try { const c = qrcode(0, 'M'); c.addData(l); c.make(); q.innerHTML = c.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { q.classList.remove('on'); } }
  }
  $('#srvIn').value = srvVal();
  $('#srvIn').addEventListener('change', (e) => { const v = e.target.value.trim(); if (v && !srvOk(v)) { toast('La dirección debe empezar por https://'); return; } store.set('rx_srv', v); toast('Servidor guardado: reiniciando…'); setTimeout(() => location.reload(), 700); });
  $('#siteIn').value = store.get('rx_site', '') || (isApp ? '' : siteVal());
  $('#siteIn').addEventListener('input', (e) => { let v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v) && v.includes('.')) v = 'https://' + v; store.set('rx_site', v); drawLink(); });
  $('#shareBtn').onclick = async () => { const l = linkFor(); if (!l) return toast('Primero escribe la dirección de tu sitio'); if (navigator.share) { try { await navigator.share({ title: 'Calendario', url: l }); return; } catch {} } toast((await copyText(l)) ? 'Enlace copiado' : 'No se pudo copiar'); };
  $('#newkey').onclick = async () => { if (await ask('¿Crear una clave nueva? Los enlaces y QR anteriores dejarán de funcionar.', 'Crear')) { store.set('rx_key', rnd()); store.set('rx_seats', '{}'); store.set('rx_names', '{}'); location.reload(); } };
  async function newRound() { if (await ask('¿Empezar una ronda nueva? Se borra la lista y la numeración ESP vuelve a 1.', 'Nueva ronda')) { seats = {}; names = {}; saveSeats(); board.clear(); cur = null; drawBoard(null); toast('Ronda nueva: el próximo en escribir será ESP 1'); } }
  $('#clear').onclick = newRound; $('#newRound').onclick = newRound;
  // editar un espectador: nombre y número (si el número ya está en uso, se intercambian)
  let editSid = null;
  function openPerson(sid) { editSid = sid; $('#pT').textContent = 'ESP ' + seats[sid]; $('#pName').value = names[sid] || ''; $('#pNum').value = seats[sid]; $('#psheet').hidden = false; }
  const closePerson = () => { $('#psheet').hidden = true; editSid = null; };
  $('#pX').onclick = $('#pNo').onclick = closePerson;
  $('#pYes').onclick = () => {
    const sid = editSid, n = Math.max(1, Math.min(99, parseInt($('#pNum').value, 10) || seats[sid])), nm = $('#pName').value.replace(/[<>&"]/g, '').trim().slice(0, 20);
    if (nm) names[sid] = nm; else delete names[sid];
    if (n !== seats[sid]) { const other = Object.keys(seats).find((k) => k !== sid && seats[k] === n); if (other) seats[other] = seats[sid]; seats[sid] = n; }
    saveSeats(); closePerson(); drawBoard(null); if (cur && cur.sid) drawLast(cur); toast('Guardado');
  };
  $('#testbtn').onclick = () => deliver({ seat: 1, label: 'prueba', ...MC.info(1759), ts: Date.now(), src: 'test' });
  $('#board').addEventListener('click', (e) => { const ed = e.target.closest('[data-edit]'); if (ed) return openPerson(ed.dataset.edit); const r = e.target.closest('.person'), ev = r && board.get(r.dataset.k); if (ev) { cur = ev; showEv(ev, false); speak(ev); vibrate(ev); } });
  document.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('[data-act="copylink"]')) { const l = linkFor(); if (!l) { toast('Primero escribe la dirección de tu sitio'); go('set'); return; } toast((await copyText(l)) ? 'Enlace copiado' : 'No se pudo copiar'); }
  });

  // ---------- navegación ----------
  const TITLES = { home: 'Inicio', input: 'Entrada', gest: 'Gestos', set: 'Ajustes', help: 'Ayuda' };
  function go(t) {
    tab = t; $$('.tab').forEach((s) => s.classList.toggle('on', s.id === 'tab-' + t)); $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === t));
    $('#barTitle').textContent = TITLES[t]; $('#gestPad').classList.toggle('on', S.gest && t === 'home'); buf = ''; showSeq(''); buzz(8);
    const el = $('#tab-' + t); if (el) el.scrollTop = 0;
  }
  function apply() {
    $$('.sw').forEach((i) => { i.checked = !!S[i.dataset.k]; });
    document.body.classList.toggle('dim', S.dim); $('#padmap').hidden = !S.pad;
    $('#gestPad').classList.toggle('on', S.gest && tab === 'home');
    $('#gap').value = S.gap; $('#gapv').textContent = S.gap + ' ms'; $('#sens').value = S.sens; $('#sensv').textContent = S.sens + ' px'; $('#clearSec').value = S.clearSec; $('#clearv').textContent = S.clearSec ? S.clearSec + ' s' : 'nunca';
    $('#wtopic').textContent = TOPIC + '-w'; $('#micState').textContent = S.voice ? '● Escuchando' : '';
    if (S.voice) voiceOn(); else voiceOff();
  }
  $$('.sw').forEach((i) => i.addEventListener('change', () => { S[i.dataset.k] = i.checked; saveS(); apply(); if (i.dataset.k === 'askname') drawLink(); if (i.dataset.k === 'gest' && i.checked && !$('#bk').hidden) { closeBk(); go('home'); } if (i.dataset.k === 'gest' && i.checked) toast('Ve a Inicio: la pantalla queda negra para gestos'); }));

  // ---------- vista de reloj (pantalla redonda o cuadrada) ----------
  // Un espectador en grande (código, año, BISIESTO) o hasta 5 en lista (ESP · año · código · B). Todo cabe sin desplazarse.
  const isWatch = () => document.body.classList.contains('watch');
  function drawWatch() {
    if (!isWatch()) return;
    $('#wDot').classList.toggle('on', $('#dot').classList.contains('on'));
    const ents = [...board.values()].sort((a, b) => seatNum(a) - seatNum(b)), body = $('#wBody');
    if (!ents.length) { body.innerHTML = '<div class="wv-wait"><div class="pulse"><i></i><i></i><i></i></div><p>Esperando…</p></div>'; }
    else {
      const mode = wmode === 'auto' ? (ents.length === 1 ? 'hero' : 'list') : wmode;
      const last = (cur && board.get(keyOf(cur))) || ents.reduce((a, b) => (b.ts > a.ts ? b : a));
      if (mode === 'hero') {
        body.innerHTML = `<div class="wv-who">${esc(whoTxt(last))}${pname(last) ? ' · ' + esc(pname(last)) : ''}</div><div class="wv-code">${last.code}</div><div class="wv-year">${last.year}</div>${last.leap ? '<div class="wv-leap">BISIESTO</div>' : ''}`;
      } else {
        body.innerHTML = `<div class="wlist">${ents.map((e) => `<div class="wr${e === last ? ' hl' : ''}"><b>${esc(whoTxt(e))}</b><span class="y">${e.year}</span><span class="b">${e.leap ? 'B' : ''}</span><strong>${e.code}</strong></div>`).join('')}</div>`;
      }
    }
    const typed = d.filter(Boolean).length;
    $('#wFoot').textContent = typed ? `ESP ${curTarget()} · ${d.map((x) => x || '·').join(' ')}` : '';
  }
  function applyForm() {
    const f = store.get('rx_form', 'auto'), w = innerWidth, h = innerHeight, mn = Math.min(w, h), ratio = Math.max(w, h) / Math.max(1, mn);
    const watch = f === 'round' || f === 'square' ? true : f === 'phone' ? false : (mn <= 340 && ratio <= 1.3);
    document.body.classList.toggle('watch', watch); document.body.classList.toggle('round', watch && f !== 'square'); drawWatch();
  }
  { const q = new URL(location.href).searchParams.get('form'); if (['auto', 'phone', 'round', 'square'].includes(q)) store.set('rx_form', q); }
  $('#formSel').value = store.get('rx_form', 'auto'); $('#formSel').onchange = (e) => { store.set('rx_form', e.target.value); applyForm(); };
  addEventListener('resize', applyForm); addEventListener('orientationchange', applyForm);
  // toque = alternar vista; pulsación larga = ronda nueva; deslizar = gestos de respaldo
  { const wv = $('#wv'); let t0 = 0, x0 = 0, y0 = 0, lp = null;
    wv.addEventListener('pointerdown', (e) => { t0 = Date.now(); x0 = e.clientX; y0 = e.clientY; clearTimeout(lp); lp = setTimeout(() => { lp = null; newRound(); }, 900); });
    wv.addEventListener('pointerup', (e) => { const moved = Math.hypot(e.clientX - x0, e.clientY - y0); clearTimeout(lp); if (lp === null && Date.now() - t0 >= 900) return; if (moved < 12 && Date.now() - t0 < 600) { const n = [...board.values()].length; if (n > 1 || wmode !== 'auto') { const cm = wmode === 'auto' ? (n === 1 ? 'hero' : 'list') : wmode; wmode = cm === 'hero' ? 'list' : 'hero'; drawWatch(); buzz(10); } } });
    wv.addEventListener('pointercancel', () => clearTimeout(lp)); swipe(wv, (x) => dir(x, 'pantalla')); }

  // ---------- inicio ----------
  function begin(t) {
    const wk = $('#wKey').value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (wk && wk.length >= 4 && wk !== key) { store.set('rx_key', wk); store.set('rx_seats', '{}'); store.set('rx_names', '{}'); location.reload(); return; }
    $('#welcome').remove(); $('#app').removeAttribute('aria-hidden');
    apply(); connect(); go(t || 'home');          // primero arranca todo; lo opcional después y sin esperar
    try { if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').catch(() => {}); document.addEventListener('visibilitychange', () => { if (!document.hidden) navigator.wakeLock.request('screen').catch(() => {}); }); } } catch {}
    try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch {}
  }
  $('#start').onclick = () => begin('home'); $('#startHelp').onclick = () => begin('help');
  applyForm();
  $('#keyIn').value = key;
  $('#keyIn').addEventListener('change', (e) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (v.length < 4) { toast('La clave necesita al menos 4 letras o números'); e.target.value = key; return; }
    store.set('rx_key', v); store.set('rx_seats', '{}'); store.set('rx_names', '{}'); toast('Clave guardada: reiniciando…'); setTimeout(() => location.reload(), 700);
  });
  $('#watchLink').textContent = 'Para el reloj, usa esta misma clave: ' + key;
  $('#wKey').value = key;
  drawDigits(); drawGestures(); drawMap(); drawLink(); drawBoard(null); showSeq('');
  if ('serviceWorker' in navigator && !isApp) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
