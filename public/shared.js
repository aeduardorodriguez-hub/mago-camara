/* Lógica común (servidor + navegadores): código de año, bisiesto y reconocimiento de año en texto/voz. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MIN = 1600, MAX = 9999;
  const CODE_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

  const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  // Día de la semana del 1 de enero (domingo=0), calendario gregoriano.
  const jan1 = (y) => { const p = y - 1; return (p + Math.floor(p / 4) - Math.floor(p / 100) + Math.floor(p / 400) + 1) % 7; };
  // Código de año de la tabla del mentalista (lunes=1 ... domingo=0, meses 6-2-2-5-0-3-5-1-4-6-2-4).
  const code = (y) => (jan1(y) + (isLeap(y) ? 1 : 0)) % 7;
  const inRange = (y) => Number.isInteger(y) && y >= MIN && y <= MAX;
  const info = (y) => { y = Number(y); return inRange(y) ? { year: y, code: code(y), leap: isLeap(y) } : null; };

  const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const U = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
    veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 };
  const T = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
  const H = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
    seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };

  function fromDigits(text) {
    const t = String(text).replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
    const nums = t.match(/\d+/g) || [];
    for (const n of nums) if (n.length === 4 && inRange(+n)) return +n;
    return null;
  }
  function fromWords(text) {
    const toks = strip(text).split(/[^a-z]+/).filter(Boolean);
    let total = 0, cur = 0, any = false; const out = [];
    const flush = () => { if (any) out.push(total + cur); total = 0; cur = 0; any = false; };
    for (const w of toks) {
      if (w in U || w in T || w in H) { cur += (U[w] ?? T[w] ?? H[w]); any = true; }
      else if (w === 'mil') { total += (cur || 1) * 1000; cur = 0; any = true; }
      else if (w === 'y' && any) { /* "ochenta y cuatro" */ }
      else flush();
    }
    flush();
    return out.find(inRange) ?? null;
  }
  // "calendario de 1890", "1890 calendario", "calendario del año 1.890", "mil novecientos ochenta y cuatro"...
  function parseYear(text) { return fromDigits(text) ?? fromWords(text); }

  return { MIN, MAX, CODE_WORDS, isLeap, code, info, parseYear };
});
