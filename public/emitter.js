/* EMISOR: buscador de calendarios que corre en el teléfono del espectador. */
(() => {
  'use strict';
  const BRAND = 'Buscador';            // Marca visible (cámbiala por la de tu dominio)
  const IDLE_MIN = 6;                  // minutos sin actividad -> se envía al buscador real
  const REAL = 'https://www.google.com/search?q=';
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const $ = (s) => document.querySelector(s);
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  for (const id of ['brand', 'brand2']) $('#' + id).innerHTML = [...BRAND].map((c) => `<span>${c}</span>`).join('');

  // --- sala y sesión (el enlace/QR/NFC puede traer ?k=sala; se guarda y se limpia de la URL)
  const u = new URL(location.href);
  if (u.searchParams.get('k')) { store.set('mc_room', u.searchParams.get('k')); u.searchParams.delete('k'); history.replaceState(null, '', u.pathname + u.search); }
  const room = store.get('mc_room') || 'main';
  let sid = store.get('mc_sid');
  if (!sid) { sid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); store.set('mc_sid', sid); }
  const label = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC';

  // --- conexión en tiempo real con reconexión automática
  let ws, ready = false, pending = null, backoff = 400;
  function connect() {
    try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); } catch { return setTimeout(connect, 2000); }
    ws.onopen = () => { backoff = 400; ws.send(JSON.stringify({ t: 'hello', role: 'tx', room, sid, label })); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'ready') { ready = true; if (pending) { ws.send(JSON.stringify(pending)); pending = null; } } };
    ws.onclose = () => { ready = false; setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 8000); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  function sendYear(y) { const m = { t: 'year', year: y }; if (ready && ws.readyState === 1) ws.send(JSON.stringify(m)); else pending = m; }
  setInterval(() => { if (ready) ws.send('{"t":"ping"}'); }, 25000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (!ws || ws.readyState > 1)) connect(); });
  connect();

  // --- inactividad: tras IDLE_MIN minutos pasa al buscador real
  let last = Date.now(), lastQ = '';
  const bump = () => { last = Date.now(); };
  ['pointerdown', 'touchstart', 'keydown', 'scroll', 'input'].forEach((ev) => addEventListener(ev, bump, { passive: true }));
  const checkIdle = () => { if (Date.now() - last > IDLE_MIN * 60000) location.replace(REAL + encodeURIComponent(lastQ)); };
  setInterval(checkIdle, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkIdle(); });

  // --- calendario
  const leap = MC.isLeap;
  function monthHtml(y, m) {
    const dim = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
    const first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // lunes=0
    let t = '<tr>' + 'LMXJVSD'.split('').map((d, i) => `<th class="${i === 6 ? 'sun' : ''}">${d}</th>`).join('') + '</tr><tr>';
    for (let i = 0; i < first; i++) t += '<td></td>';
    for (let d = 1, c = first; d <= dim; d++, c++) { if (c % 7 === 0 && d > 1) t += '</tr><tr>'; t += `<td class="${c % 7 === 6 ? 'sun' : ''}">${d}</td>`; }
    return `<div class="m"><h4>${MESES[m][0].toUpperCase() + MESES[m].slice(1)}</h4><table>${t}</tr></table></div>`;
  }
  let year = 0;
  function showYear(y, send) {
    year = y; lastQ = `calendario ${y}`;
    $('#home').hidden = true; $('#res').hidden = false;
    $('#q2').value = lastQ; document.title = `${lastQ} - ${BRAND}`;
    $('#title').textContent = `Calendario ${y}`;
    $('#months').innerHTML = Array.from({ length: 12 }, (_, m) => monthHtml(y, m)).join('');
    $('#stats').textContent = `Cerca de ${(1200000 + Math.floor(Math.random() * 3000000)).toLocaleString('es-ES')} resultados (0,${30 + Math.floor(Math.random() * 40)} segundos)`;
    $('#rel').innerHTML = [`calendario ${y + 1}`, `calendario ${y - 1}`, `calendario ${y} con festivos`, `calendario perpetuo ${y}`].map((s) => `<li data-q="${s}">${s}</li>`).join('');
    if (send) sendYear(y);
    window.scrollTo(0, 0);
  }

  function search(q) {
    q = q.trim(); if (!q) return;
    bump(); const y = MC.parseYear(q);
    if (y) { history.pushState({ y }, '', '/?q=' + encodeURIComponent(q)); showYear(y, true); }
    else location.href = REAL + encodeURIComponent(q); // búsqueda normal -> buscador real (cobertura natural)
  }

  // --- sugerencias estilo autocompletar
  function suggest(input, ul) {
    const q = input.value.trim().toLowerCase();
    let s = [];
    if (q && !/\d{4}/.test(q)) s = [q, `${q} 2026`, `${q} con festivos`, `${q} perpetuo`, `${q} para imprimir`];
    else if (q) s = [q, `${q} con festivos`, `${q} completo`];
    ul.innerHTML = s.map((x) => `<li>${x.replace(/</g, '&lt;')}</li>`).join(''); ul.classList.toggle('has', s.length > 0);
  }
  for (const n of ['1', '2']) {
    const input = $('#q' + n), ul = $('#s' + n), form = $('#f' + n);
    input.addEventListener('input', () => suggest(input, ul));
    ul.addEventListener('pointerdown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); input.value = li.textContent; ul.classList.remove('has'); search(input.value); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); ul.classList.remove('has'); input.blur(); search(input.value); });
  }
  $('#lucky').onclick = () => { const v = $('#q1').value.trim(); if (v) search(v); };
  $('#prev').onclick = () => { if (year > MC.MIN) { bump(); showYear(year - 1, true); } };
  $('#next').onclick = () => { if (year < MC.MAX) { bump(); showYear(year + 1, true); } };
  $('#rel').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) search(li.dataset.q); });
  addEventListener('popstate', () => { const q = new URL(location.href).searchParams.get('q'); const y = q && MC.parseYear(q); if (y) showYear(y, true); else { $('#res').hidden = true; $('#home').hidden = false; } });

  const q0 = u.searchParams.get('q'); const y0 = q0 && MC.parseYear(q0);
  if (y0) showYear(y0, true); else setTimeout(() => $('#q1').focus(), 50);
})();
