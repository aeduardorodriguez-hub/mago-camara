/* EMISOR: buscador de calendarios en el teléfono del espectador.
   Flujo: inicio -> resultados (alternativas con miniaturas) -> calendario elegido.
   El año se envía al receptor en cuanto se reconoce en la búsqueda. */
(() => {
  'use strict';
  const BRAND = 'Buscador';            // Texto del logotipo. Para usar tu propio logotipo, sube "logo.png" junto a index.html
  const IDLE_MIN = 6;                  // minutos sin actividad -> se pasa al buscador real
  const REAL = 'https://www.google.com/search?q=';
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  // ---------- logotipo (texto, o logo.png propio si existe) ----------
  $('#logo').innerHTML = [...BRAND].map((c) => `<span>${c}</span>`).join('');
  { const im = new Image(); im.alt = BRAND; im.onload = () => { const l = $('#logo'); l.textContent = ''; l.appendChild(im); }; im.src = 'logo.png'; }

  // ---------- sala / sesión ----------
  const u = new URL(location.href);
  const kq = (u.searchParams.get('k') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  if (kq) { store.set('mc_room', kq); u.searchParams.delete('k'); history.replaceState(null, '', u.pathname + (u.search || '')); }
  const room = store.get('mc_room') || 'main';
  let sid = store.get('mc_sid');
  if (!sid) { sid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); store.set('mc_sid', sid); }
  const label = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC';

  // ---------- envío (tema secreto de ntfy.sh) ----------
  const TOPIC = 'mc-' + room, short = sid.replace(/[^a-z0-9]/gi, '').slice(0, 12);
  let pending = null, sending = false, lastSent = 0;
  async function flush() {
    if (sending || !pending) return; sending = true;
    while (pending) {
      const y = pending;
      try { await fetch('https://ntfy.sh/' + TOPIC, { method: 'POST', body: JSON.stringify({ s: short, l: label, y }), keepalive: true }); if (pending === y) pending = null; }
      catch { await new Promise((r) => setTimeout(r, 1500)); }
    }
    sending = false;
  }
  function sendYear(y) { lastSent = y; pending = y; flush(); }
  const sendIfNew = (y) => { if (y !== lastSent) sendYear(y); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); checkIdle(); } });

  // ---------- inactividad ----------
  let last = Date.now(), lastQ = '';
  const bump = () => { last = Date.now(); };
  ['pointerdown', 'touchstart', 'keydown', 'scroll', 'input'].forEach((ev) => addEventListener(ev, bump, { passive: true }));
  function checkIdle() { if (Date.now() - last > IDLE_MIN * 60000) location.replace(REAL + encodeURIComponent(lastQ)); }
  setInterval(checkIdle, 5000);

  // ---------- datos del calendario ----------
  const leap = MC.isLeap;
  const jan1 = (y) => new Date(Date.UTC(y, 0, 1)).getUTCDay();
  const dim = (y, m) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
  const firstCol = (y, m) => (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const thisYear = new Date().getFullYear();

  // 6 "sitios" de calendarios (decorativos): nombre, ruta, colores y distribución
  const SITES = [
    { n: 'Calendario Fácil', d: 'calendariofacil.com', c: '#1e6bd6', paper: '#ffffff', cols: 3, title: (y) => `Calendario ${y} - Todos los meses y días` },
    { n: 'Almanaque Online', d: 'almanaque-online.com', c: '#0f8a5f', paper: '#f4fbf7', cols: 4, title: (y) => `Almanaque ${y}: calendario completo del año` },
    { n: 'Fechas.info', d: 'fechas.info', c: '#c2410c', paper: '#fffaf5', cols: 3, title: (y) => `Calendario del año ${y} para imprimir` },
    { n: 'Calendarios.net', d: 'calendarios.net', c: '#6d28d9', paper: '#fbf9ff', cols: 4, title: (y) => `Calendario ${y} | Días de la semana y meses` },
    { n: 'Días y Meses', d: 'diasymeses.com', c: '#be123c', paper: '#fff', cols: 3, title: (y) => `¿Qué día de la semana fue? Calendario ${y}` },
    { n: 'Calendario Perpetuo', d: 'calendarioperpetuo.org', c: '#334155', paper: '#f8fafc', cols: 4, title: (y) => `Calendario perpetuo ${y} - consulta cualquier fecha` },
  ];
  const urlPath = (i, y) => [`calendario › ${y}`, `calendarios › ${y}`, `calendario-${y}`, `año › ${y}`, `calendario › ${y} › meses`, `${y}`][i];
  const snippet = (y, i) => {
    const verb = y <= thisYear ? 'empezó' : 'empezará';
    return [`Calendario del año ${y} con los 12 meses y los días de la semana. El ${y} ${verb} en ${DIAS[jan1(y)]}. Consulta cualquier fecha.`,
      `Almanaque completo de ${y}: meses, semanas y días. Encuentra rápidamente en qué día de la semana cae cada fecha del año ${y}.`,
      `Descarga o consulta el calendario ${y} en una sola página. Todos los meses del año ${y}, listos para ver o imprimir.`,
      `Calendario ${y} con numeración de días y semanas. Navega por los años anteriores y siguientes desde la misma página.`,
      `Todos los días del ${y} en un vistazo: ${MESES[0].toLowerCase()} a ${MESES[11].toLowerCase()}. Un calendario claro, sin complicaciones.`][i % 5];
  };

  // miniatura (SVG) con el calendario real del año, distinta por sitio
  const thumbCache = new Map();
  function mini(y, i) {
    const key = y + ':' + i; if (thumbCache.has(key)) return thumbCache.get(key);
    const s = SITES[i], W = 240, H = 320, cols = s.cols, rows = 12 / cols, top = 50, pad = 8;
    const cw = (W - pad * 2) / cols, ch = (H - top - pad) / rows;
    let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${s.paper}"/><rect width="${W}" height="42" fill="${s.c}"/><text x="${W / 2}" y="30" font-size="25" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">${y}</text>`;
    for (let m = 0; m < 12; m++) {
      const x0 = pad + (m % cols) * cw, y0 = top + Math.floor(m / cols) * ch;
      g += `<text x="${x0 + cw / 2}" y="${y0 + 8}" font-size="${cols === 3 ? 7.5 : 6.2}" font-weight="700" fill="${s.c}" text-anchor="middle" font-family="Arial,sans-serif">${MESES[m].toUpperCase()}</text>`;
      const fs = cols === 3 ? 5.3 : 4.3, gx = cw / 7, gy = (ch - 16) / 6.4, fc = firstCol(y, m);
      for (let d = 1; d <= dim(y, m); d++) {
        const c = (fc + d - 1) % 7, r = Math.floor((fc + d - 1) / 7);
        g += `<text x="${x0 + gx * (c + .5)}" y="${y0 + 17 + gy * (r + .75)}" font-size="${fs}" fill="${c === 6 ? '#d1383d' : '#555'}" text-anchor="middle" font-family="Arial,sans-serif">${d}</text>`;
      }
    }
    g += '</svg>'; thumbCache.set(key, g); return g;
  }

  // ---------- vistas ----------
  const views = { home: $('#home'), serp: $('#serp'), site: $('#site') };
  const show = (v) => { for (const k in views) views[k].hidden = k !== v; window.scrollTo(0, 0); };
  let cur = { q: '', y: 0, tab: 'all', s: 0 };

  function renderSerp() {
    const { y, q, tab } = cur; $('#q2').value = q; document.title = `${q} - ${BRAND}`; lastQ = q;
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === tab));
    let h = '';
    if (tab === 'all') {
      const res = (i) => `<article class="res" data-s="${i}"><div class="tn">${mini(y, i)}</div><div class="row"><div class="fav">${esc(SITES[i].n[0])}</div><div class="meta"><div class="nm">${esc(SITES[i].n)}</div><div class="url">https://${SITES[i].d} › ${urlPath(i, y)}</div></div></div><h3>${esc(SITES[i].title(y))}</h3><p>${esc(snippet(y, i))}</p></article>`;
      const pack = `<section class="pack"><h4>Imágenes de ${esc(q)}</h4><div class="strip">${SITES.map((s, i) => `<a class="im" data-s="${i}"><div class="th">${mini(y, i)}</div><span>${esc(s.d)}</span></a>`).join('')}</div></section>`;
      h = res(0) + pack + [1, 2, 3, 4, 5].map(res).join('<div class="sep"></div>');
      h += `<section class="rel"><h4>Búsquedas relacionadas</h4><ul>${[`calendario ${y + 1}`, `calendario ${y - 1}`, `calendario ${y} con festivos`, `calendario ${y} para imprimir`, `qué día de la semana fue ${y}`].map((t) => `<li data-q="${esc(t)}"><svg class="ic"><use href="#i-search"/></svg>${esc(t)}</li>`).join('')}</ul></section>`;
    } else if (tab === 'img') {
      h = `<div class="grid">${SITES.map((s, i) => `<a class="gi" data-s="${i}"><div class="th">${mini(y, i)}</div><span>${esc(s.d)}</span></a>`).join('')}</div>`;
    } else h = `<div class="empty">No se encontraron resultados en esta sección para <b>${esc(q)}</b>.<br>Prueba con la pestaña <b>Todo</b> o <b>Imágenes</b>.</div>`;
    $('#serpBody').innerHTML = h;
  }

  function renderSite() {
    const { y, s } = cur, S = SITES[s];
    const el = views.site; el.style.setProperty('--c', S.c); el.style.setProperty('--h', S.c); el.style.setProperty('--paper', S.paper);
    document.title = `${S.title(y)}`;
    $('#sname').textContent = S.n; $('#stitle').textContent = `Calendario ${y}`;
    $('#slead').textContent = snippet(y, s); $('#syear').textContent = y;
    $('#months').innerHTML = Array.from({ length: 12 }, (_, m) => {
      let t = '<tr>' + 'LMXJVSD'.split('').map((d, i) => `<th class="${i === 6 ? 's' : ''}">${d}</th>`).join('') + '</tr><tr>';
      const fc = firstCol(y, m); for (let i = 0; i < fc; i++) t += '<td></td>';
      for (let d = 1, c = fc; d <= dim(y, m); d++, c++) { if (c % 7 === 0 && d > 1) t += '</tr><tr>'; t += `<td class="${c % 7 === 6 ? 's' : ''}">${d}</td>`; }
      return `<div class="m"><h4>${MESES[m]}</h4><table>${t}</tr></table></div>`;
    }).join('');
    $('#sfoot').textContent = `© ${thisYear} ${S.n} · ${S.d}`;
  }

  // ---------- navegación ----------
  const qs = (o) => '?' + Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  function goHome(push) { show('home'); document.title = BRAND; if (push) history.pushState({ v: 'home' }, '', location.pathname); }
  function goSerp(q, y, push) { cur = { ...cur, q, y, tab: 'all' }; sendIfNew(y); renderSerp(); show('serp'); if (push) history.pushState({ v: 'serp', q, y }, '', qs({ q })); }
  function goSite(i, push) { cur.s = i; renderSite(); show('site'); if (push) history.pushState({ v: 'site', q: cur.q, y: cur.y, s: i }, '', qs({ q: cur.q, s: i, y: cur.y })); }
  function route(st) {
    if (!st || st.v === 'home') return goHome(false);
    cur = { ...cur, q: st.q, y: st.y, s: st.s || 0, tab: 'all' }; sendIfNew(st.y);
    if (st.v === 'site') { renderSite(); show('site'); } else { renderSerp(); show('serp'); }
  }
  addEventListener('popstate', (e) => route(e.state || stateFromUrl()));
  function stateFromUrl() {
    const p = new URL(location.href).searchParams, q = p.get('q'); if (!q) return { v: 'home' };
    const y = MC.parseYear(q); if (!y) return { v: 'home' };
    return p.get('s') !== null ? { v: 'site', q, y: +p.get('y') || y, s: +p.get('s') || 0 } : { v: 'serp', q, y };
  }

  function search(q) {
    q = q.trim(); if (!q) return; bump(); lastQ = q;
    const y = MC.parseYear(q);
    if (y) goSerp(q, y, true);
    else location.href = REAL + encodeURIComponent(q); // búsqueda sin año -> buscador real
  }

  // ---------- sugerencias ----------
  function suggest(input, ul, pill) {
    const q = input.value.trim().toLowerCase(); let s = [];
    if (q) s = /\d{4}/.test(q) ? [q, `${q} con festivos`, `${q} para imprimir`, `${q} completo`] : [q, `${q} 2026`, `${q} con festivos`, `${q} perpetuo`, `${q} para imprimir`];
    ul.innerHTML = s.map((x, i) => `<li><svg class="ic"><use href="#${i === 0 ? 'i-search' : 'i-search'}"/></svg><span>${esc(x)}</span><svg class="ic go"><use href="#i-arrow"/></svg></li>`).join('');
    pill.classList.toggle('open', s.length > 0 && document.activeElement === input);
  }
  for (const n of ['1', '2']) {
    const input = $('#q' + n), ul = $('#s' + n), form = $('#f' + n);
    input.addEventListener('input', () => suggest(input, ul, form));
    input.addEventListener('focus', () => suggest(input, ul, form));
    input.addEventListener('blur', () => setTimeout(() => form.classList.remove('open'), 150));
    ul.addEventListener('pointerdown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); input.value = li.querySelector('span').textContent; form.classList.remove('open'); input.blur(); search(input.value); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); form.classList.remove('open'); input.blur(); search(input.value); });
  }
  $('#lucky').onclick = () => { const v = $('#q1').value.trim(); if (v) search(v); };
  $('#qclear').onclick = () => { const i = $('#q2'); i.value = ''; i.focus(); };
  $('#sback').onclick = () => history.length > 1 ? history.back() : goHome(true);
  $('#tback').onclick = () => history.length > 1 ? history.back() : goSerp(cur.q, cur.y, true);
  $('#tabs').addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { cur.tab = a.dataset.t; renderSerp(); window.scrollTo(0, 0); } });
  $('#serpBody').addEventListener('click', (e) => {
    const r = e.target.closest('[data-q]'); if (r) return search(r.dataset.q);
    const s = e.target.closest('[data-s]'); if (s) goSite(+s.dataset.s, true);
  });
  const yearStep = (d) => { const y = cur.y + d; if (y < MC.MIN || y > MC.MAX) return; bump(); cur.y = y; cur.q = `calendario ${y}`; sendIfNew(y); renderSite(); history.replaceState({ v: 'site', q: cur.q, y, s: cur.s }, '', qs({ q: cur.q, s: cur.s, y })); window.scrollTo(0, 0); };
  $('#prev').onclick = () => yearStep(-1); $('#next').onclick = () => yearStep(1);

  route(history.state || stateFromUrl());
  if (!views.home.hidden) setTimeout(() => { try { $('#q1').focus(); } catch {} }, 60);
})();
