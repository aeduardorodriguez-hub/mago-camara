/* RECEPTOR del mentalista: web (ntfy.sh) + voz + mando/teclado + gestos configurables. Salida: pantalla, voz, vibración, reloj. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const isApp = !!window.AndroidApp, W = MC.CODE_WORDS, NTFY = 'https://ntfy.sh/';
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // ---------- ajustes ----------
  const DEF = { web: 1, voice: 0, pad: 1, gest: 0, speak: 1, seat: 1, vib: 1, dim: 0, watch: 0 };
  const S = {}; for (const k in DEF) S[k] = store.get('rx_' + k, String(DEF[k])) === '1';
  S.gap = +store.get('rx_gap', '650') || 650; S.sens = +store.get('rx_sens', '30') || 30;
  const saveS = () => { for (const k in DEF) store.set('rx_' + k, S[k] ? '1' : '0'); store.set('rx_gap', S.gap); store.set('rx_sens', S.sens); };

  // ---------- clave y enlace del espectador ----------
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const urlKey = (new URL(location.href).searchParams.get('k') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  const key = urlKey || store.get('rx_key', '') || rnd(); store.set('rx_key', key);
  if (urlKey && !isApp) history.replaceState(null, '', location.pathname);
  const TOPIC = 'mc-' + key;
  const siteVal = () => store.get('rx_site', '') || (isApp ? '' : new URL('./', location.href).href);
  function linkFor() {
    let s = siteVal().trim(); if (!/^https?:\/\//i.test(s)) return '';
    s = /\.html?$/i.test(s) ? s.replace(/[^/]*$/, '') : s.replace(/\/?$/, '/');
    try { return new URL('index.html?k=' + key, s).href; } catch { return ''; }
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
  const LBL = { voz: 'Entrada por voz', gesto: 'Entrada por gestos', manual: 'Entrada manual', prueba: 'Prueba' };
  function showEv(ev, fresh) {
    $('#hero').hidden = false; $('#empty').hidden = true;
    $('#who').textContent = ev.seat ? `Persona ${ev.seat}${ev.label ? ' · ' + ev.label : ''}` : (LBL[ev.label] || ev.label);
    $('#code').textContent = ev.code; $('#yr').textContent = ev.year; $('#leap').hidden = !ev.leap;
    const h = $('#hero'); h.classList.remove('pop'); void h.offsetWidth; if (fresh) h.classList.add('pop');
    board.set(ev.seat ? 's' + ev.seat : 'x' + ev.label, ev);
    drawBoard(fresh ? ev : null);
  }
  function drawBoard(hl) {
    const rows = [...board.entries()].sort((a, b) => b[1].ts - a[1].ts).slice(0, 14);
    $('#board').innerHTML = rows.map(([k, e]) => `<div class="person${e === hl ? ' new' : ''}" data-k="${k}"><div class="av">${e.seat || '·'}</div><div class="pi"><b>${e.seat ? 'Persona ' + e.seat : esc(LBL[e.label] || e.label)}</b><span>${e.year}${e.seat && e.label ? ' · ' + esc(e.label) : ''}</span></div>${e.leap ? '<span class="pb">BISIESTO</span>' : ''}<div class="pc">${e.code}</div></div>`).join('');
    $('#empty').hidden = board.size > 0; if (!board.size) $('#hero').hidden = true;
  }
  function speak(ev) {
    if (!S.speak || !('speechSynthesis' in window)) return;
    const txt = `${S.seat && ev.seat ? 'Persona ' + ev.seat + '. ' : ''}${W[ev.code]}${ev.leap ? '. Bisiesto' : ''}`;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = 1.15; speechSynthesis.speak(u); } catch {}
  }
  function vibrate(ev) {
    if (!S.vib) return; const p = [];
    if (ev.code === 0) p.push(700); else for (let i = 0; i < ev.code; i++) p.push(120, 160);
    if (ev.leap) p.push(450, 400); buzz(p);
  }
  function deliver(ev, o = {}) { cur = ev; showEv(ev, !o.silent); if (!o.silent) { speak(ev); vibrate(ev); } }
  function local(year, src) {
    const i = MC.info(year);
    if (!i) { toast('Ese año no está entre 1600 y 9999'); buzz([40, 40, 40]); return false; }
    deliver({ seat: 0, label: src, ...i, ts: Date.now(), src }); mirror(i, 0); return true;
  }

  // ---------- red: ntfy.sh por SSE ----------
  const seatOf = (() => { let m = {}; try { m = JSON.parse(store.get('rx_seats', '{}')); } catch {} return (sid) => { if (!m[sid]) { m[sid] = Object.keys(m).length + 1; store.set('rx_seats', JSON.stringify(m)); } return m[sid]; }; })();
  const seen = new Set(); let es = null, lastT = Math.floor(Date.now() / 1000) - 90;
  function mirror(i, seat) {
    if (!S.watch) return;
    fetch(`${NTFY}${TOPIC}-w?title=${encodeURIComponent('#' + (seat || '-'))}&priority=5`, { method: 'POST', body: `${i.code}${i.leap ? ' B' : ''}` }).catch(() => {});
  }
  const online = (on) => { $('#dot').classList.toggle('on', on); $('#pres').textContent = on ? 'En línea' : 'Reconectando…'; };
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
      const seat = seatOf(p.s.slice(0, 12)), old = Date.now() / 1000 - (m.time || 0) > 30;
      deliver({ seat, label: String(p.l || '').slice(0, 12), ...i, ts: (m.time || Date.now() / 1000) * 1000, src: 'web' }, { silent: old });
      if (!old) mirror(i, seat);
    };
  }
  setInterval(() => { if (es && es.readyState === 2) connect(); }, 5000);

  // ---------- año tecleado (4 dígitos) ----------
  let d = ['', '', '', ''], ix = 0, lastSrc = 'manual';
  function drawDigits() { $('#digits').innerHTML = d.map((x, n) => `<i class="${x ? 'f' : ''}${n === ix ? ' c' : ''}">${x || '–'}</i>`).join(''); $('#gpDots').innerHTML = d.map((x) => `<i class="${x ? 'f' : ''}"></i>`).join(''); }
  function resetDigits() { d = ['', '', '', '']; ix = 0; drawDigits(); }
  function typeDigit(n, src) {
    lastSrc = src || lastSrc; d[ix] = String(n); ix++;
    if (ix > 3) { const y = +d.join(''); resetDigits(); local(y, lastSrc); } else drawDigits();
  }
  const A = {
    back() { if (ix > 0) { ix--; d[ix] = ''; drawDigits(); } },
    clear() { resetDigits(); },
    replay() { if (cur) { showEv(cur, false); speak(cur); vibrate(cur); } else toast('Aún no hay ningún código'); },
    dim() { S.dim = !S.dim; saveS(); apply(); },
  };
  const ACTS = [...Array(10).keys()].map((n) => 'd' + n).concat(['back', 'clear', 'replay', 'dim']);
  const ACT_NAME = { back: 'Borrar el último dígito', clear: 'Limpiar el año tecleado', replay: 'Repetir el último código', dim: 'Pantalla discreta (activar/desactivar)' };
  const actName = (a) => /^d\d$/.test(a) ? 'Dígito ' + a[1] : ACT_NAME[a] || a;
  function run(a, src) { if (/^d\d$/.test(a)) typeDigit(a[1], src || 'gesto'); else if (A[a]) A[a](); }
  $('#keys').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<button data-n="${n}">${n}</button>`).join('');
  $('#keys').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { buzz(15); typeDigit(b.dataset.n, 'manual'); } });
  $('#kBack').onclick = () => A.back(); $('#kReplay').onclick = () => A.replay();

  // ---------- gestos: lista editable + motor ----------
  const DEF_G = [['UU', 'd1'], ['UR', 'd2'], ['UD', 'd3'], ['UL', 'd4'], ['RU', 'd5'], ['RR', 'd6'], ['RD', 'd7'], ['RL', 'd8'], ['DU', 'd9'], ['DR', 'd0'], ['DD', 'back'], ['DL', 'clear'], ['LU', 'replay'], ['LR', 'dim']];
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
  function dir(dn) {
    if (sink) return sink(dn);
    buzz(12); buf += dn; showSeq(buf); clearTimeout(gt);
    const exact = G.some((g) => g.seq === buf), longer = G.some((g) => g.seq.length > buf.length && g.seq.startsWith(buf));
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
  swipe($('#practice'), dir); swipe($('#gestPad'), dir); swipe($('#cap'), dir);

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

  // ---------- mando / teclado ----------
  const KM_DEF = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight', ok: 'Enter', clear: 'Escape' };
  let KM = { ...KM_DEF }; try { Object.assign(KM, JSON.parse(store.get('rx_km2', '{}'))); } catch {}
  const KN = { U: '↑ Arriba', D: '↓ Abajo', L: '← Izquierda', R: '→ Derecha', ok: 'Botón A (repetir)', clear: 'Botón B (borrar)' };
  let learning = null;
  function drawMap() { $('#map').innerHTML = Object.keys(KN).map((a) => `<button data-a="${a}" class="${learning === a ? 'learn' : ''}">${KN[a]}: <b>${learning === a ? 'pulsa un botón…' : esc(KM[a])}</b></button>`).join(''); }
  $('#map').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { learning = b.dataset.a; drawMap(); } });
  $('#resetKeys').onclick = () => { KM = { ...KM_DEF }; store.set('rx_km2', '{}'); drawMap(); };
  const padOn = () => S.pad || sink || tab === 'gest';
  addEventListener('keydown', (e) => {
    if (learning) { KM[learning] = e.key; store.set('rx_km2', JSON.stringify(KM)); learning = null; drawMap(); e.preventDefault(); return; }
    if (!padOn() || (e.target.matches && e.target.matches('input,textarea'))) return;
    if (/^[0-9]$/.test(e.key) && !sink) { typeDigit(e.key, 'manual'); e.preventDefault(); return; }
    for (const a in KM) if (KM[a] === e.key) { e.preventDefault(); if ('UDLR'.includes(a)) dir(a); else if (!sink) a === 'ok' ? A.replay() : A.clear(); return; }
  });
  const prev = {};
  (function poll() {
    if (padOn() && navigator.getGamepads) for (const g of navigator.getGamepads()) {
      if (!g) continue; const b = g.buttons, p = (n) => !!(b[n] && b[n].pressed);
      const st = { U: p(12) || g.axes[1] < -.7, D: p(13) || g.axes[1] > .7, L: p(14) || g.axes[0] < -.7, R: p(15) || g.axes[0] > .7, ok: p(0), clear: p(1) };
      for (const a in st) { if (st[a] && !prev[a]) { if ('UDLR'.includes(a)) dir(a); else if (!sink) a === 'ok' ? A.replay() : A.clear(); } prev[a] = st[a]; }
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
  function voiceOff() { const r = rec; rec = null; if (r) try { r.stop(); } catch {} }

  // ---------- ajustes / enlace / QR ----------
  function drawLink() {
    const l = linkFor(); $('#linkBox').textContent = l || 'Escribe arriba la dirección de tu sitio para generar el enlace.';
    const q = $('#qr'); q.classList.toggle('on', !!l);
    if (l) { try { const c = qrcode(0, 'M'); c.addData(l); c.make(); q.innerHTML = c.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { q.classList.remove('on'); } }
  }
  $('#siteIn').value = store.get('rx_site', '') || (isApp ? '' : siteVal());
  $('#siteIn').addEventListener('input', (e) => { let v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v) && v.includes('.')) v = 'https://' + v; store.set('rx_site', v); drawLink(); });
  $('#shareBtn').onclick = async () => { const l = linkFor(); if (!l) return toast('Primero escribe la dirección de tu sitio'); if (navigator.share) { try { await navigator.share({ title: 'Calendario', url: l }); return; } catch {} } toast((await copyText(l)) ? 'Enlace copiado' : 'No se pudo copiar'); };
  $('#newkey').onclick = async () => { if (await ask('¿Crear una clave nueva? Los enlaces y QR anteriores dejarán de funcionar.', 'Crear')) { store.set('rx_key', rnd()); store.set('rx_seats', '{}'); location.reload(); } };
  $('#clear').onclick = async () => { if (await ask('¿Borrar el historial de personas y códigos?', 'Borrar')) { board.clear(); drawBoard(null); $('#hero').hidden = true; toast('Historial borrado'); } };
  $('#testbtn').onclick = () => deliver({ seat: 1, label: 'prueba', ...MC.info(1759), ts: Date.now(), src: 'test' });
  $('#board').addEventListener('click', (e) => { const r = e.target.closest('.person'), ev = r && board.get(r.dataset.k); if (ev) { cur = ev; showEv(ev, false); speak(ev); vibrate(ev); } });
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
    $('#gap').value = S.gap; $('#gapv').textContent = S.gap + ' ms'; $('#sens').value = S.sens; $('#sensv').textContent = S.sens + ' px';
    $('#wtopic').textContent = TOPIC + '-w'; $('#micState').textContent = S.voice ? '● Escuchando' : '';
    if (S.voice) voiceOn(); else voiceOff();
  }
  $$('.sw').forEach((i) => i.addEventListener('change', () => { S[i.dataset.k] = i.checked; saveS(); apply(); if (i.dataset.k === 'gest' && i.checked) toast('Ve a Inicio: la pantalla queda negra para gestos'); }));

  // ---------- inicio ----------
  async function begin(t) {
    $('#welcome').remove(); $('#app').removeAttribute('aria-hidden');
    try { if ('wakeLock' in navigator) { await navigator.wakeLock.request('screen'); document.addEventListener('visibilitychange', () => { if (!document.hidden) navigator.wakeLock.request('screen').catch(() => {}); }); } } catch {}
    try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch {}
    apply(); connect(); go(t || 'home');
  }
  $('#start').onclick = () => begin('home'); $('#startHelp').onclick = () => begin('help');
  $('#keyshow').textContent = key; drawDigits(); drawGestures(); drawMap(); drawLink(); drawBoard(null); showSeq('');
  if ('serviceWorker' in navigator && !isApp) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
