/* Vista mínima para relojes con navegador (p. ej. Galaxy Watch con Samsung Internet / navegador Wear OS). */
(() => {
  const $ = (s) => document.querySelector(s);
  const p = new URL(location.href).searchParams;
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  if (p.get('p')) set('rx_pin', p.get('p')); if (p.get('k')) set('rx_room', p.get('k'));
  let backoff = 400;
  function connect() {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => { backoff = 400; ws.send(JSON.stringify({ t: 'hello', role: 'watch', room: get('rx_room') || 'main', pin: get('rx_pin') || '' })); };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'ev') {
        $('#c').textContent = m.code; $('#s').innerHTML = (m.seat ? '#' + m.seat : '') + (m.leap ? ' <span id="b">B</span>' : '');
        if (navigator.vibrate) { const a = []; if (m.code === 0) a.push(700); else for (let i = 0; i < m.code; i++) a.push(120, 160); if (m.leap) a.push(450, 400); navigator.vibrate(a); }
      }
    };
    ws.onclose = () => { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 8000); };
    setInterval(() => { try { ws.send('{"t":"ping"}'); } catch {} }, 25000);
  }
  connect();
})();
