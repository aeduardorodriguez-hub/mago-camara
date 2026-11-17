/* Puentes nativos: voz (SpeechRecognizer), síntesis (TextToSpeech) y vibración dentro del WebView. */
(function () {
  if (!window.AndroidApp) return;
  const def = (k, v) => Object.defineProperty(window, k, { value: v, configurable: true, writable: true });
  class SR {
    constructor() { this.lang = 'es-ES'; this.continuous = true; this.interimResults = false; }
    start() { window.__sr = this; AndroidApp.srStart(this.lang); }
    stop() { AndroidApp.srStop(); }
  }
  def('SpeechRecognition', SR); def('webkitSpeechRecognition', SR);
  window.__srResult = (t) => { const r = window.__sr; if (r && r.onresult) r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); };
  window.__srEnd = () => { const r = window.__sr; if (r && r.onend) r.onend(); };
  window.__srError = (c) => { const r = window.__sr; if (r && r.onerror) r.onerror({ error: c }); };
  def('SpeechSynthesisUtterance', function (t) { this.text = t; });
  def('speechSynthesis', { cancel() { AndroidApp.stopSpeak(); }, speak(u) { AndroidApp.speak(u.text || ''); } });
  navigator.vibrate = (p) => { AndroidApp.vibrate(JSON.stringify([].concat(p))); return true; };
})();
