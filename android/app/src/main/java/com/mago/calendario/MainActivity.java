package com.mago.calendario;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Locale;

/** Receptor del mentalista: WebView con la web empaquetada + puentes nativos (voz, TTS, vibración). */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.local";
    private WebView web;
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingSpeak = null, pendingLang = null;
    private long lastBack = 0;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath(); if (path == null || path.equals("/")) path = "/r.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    String ext = MimeTypeMap.getFileExtensionFromUrl(path);
                    String mime = "js".equals(ext) ? "text/javascript" : "json".equals(ext) ? "application/json" : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                    return new WebResourceResponse(mime == null ? "text/plain" : mime, "utf-8", in);
                } catch (IOException e) { return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (HOST.equals(r.getUrl().getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception ignored) {}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("OK", (d, w) -> r.confirm()).setOnCancelListener(d -> r.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("Sí", (d, w) -> r.confirm()).setNegativeButton("No", (d, w) -> r.cancel()).setOnCancelListener(d -> r.cancel()).show(); return true;
            }
            @Override public boolean onJsPrompt(WebView v, String url, String msg, String def, JsPromptResult r) {
                EditText et = new EditText(MainActivity.this); et.setText(def); et.setSingleLine(false);
                new AlertDialog.Builder(MainActivity.this).setMessage(msg).setView(et).setPositiveButton("OK", (d, w) -> r.confirm(et.getText().toString())).setNegativeButton("Cancelar", (d, w) -> r.cancel()).setOnCancelListener(d -> r.cancel()).show(); return true;
            }
        });
        web.loadUrl("https://" + HOST + "/r.html");
    }

    private void js(String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    // ---------- reconocimiento de voz ----------
    private String srLang = "es-ES";
    private void startRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { js("window.__srError('service-not-allowed')"); return; }
        if (recognizer != null) recognizer.destroy();
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle p) {} public void onBeginningOfSpeech() {} public void onRmsChanged(float f) {}
            public void onBufferReceived(byte[] b) {} public void onEndOfSpeech() {} public void onPartialResults(Bundle p) {} public void onEvent(int t, Bundle p) {}
            public void onError(int e) {
                if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) js("window.__srError('not-allowed')");
                js("window.__srEnd()");
            }
            public void onResults(Bundle res) {
                ArrayList<String> l = res.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (l != null) for (String t : l) js("window.__srResult(" + JSONObject.quote(t) + ")");
                js("window.__srEnd()");
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, srLang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        recognizer.startListening(i);
    }
    @Override public void onRequestPermissionsResult(int code, String[] p, int[] r) {
        if (code == 7) { if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) startRecognition(); else js("window.__srError('not-allowed')"); }
    }

    // ---------- puente JS ----------
    private class Bridge {
        @JavascriptInterface public void srStart(String lang) {
            srLang = lang == null ? "es-ES" : lang;
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 7);
                else startRecognition();
            });
        }
        @JavascriptInterface public void srStop() { runOnUiThread(() -> { if (recognizer != null) { recognizer.destroy(); recognizer = null; } }); }
        @JavascriptInterface public void speak(String text) {
            runOnUiThread(() -> {
                if (tts == null) {
                    pendingSpeak = text;
                    tts = new TextToSpeech(MainActivity.this, st -> {
                        if (st == TextToSpeech.SUCCESS) { tts.setLanguage(new Locale("es", "ES")); tts.setSpeechRate(1.15f); ttsReady = true; if (pendingSpeak != null) tts.speak(pendingSpeak, TextToSpeech.QUEUE_FLUSH, null, "mc"); }
                    });
                } else if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mc");
            });
        }
        @JavascriptInterface public void stopSpeak() { runOnUiThread(() -> { if (tts != null && ttsReady) tts.stop(); }); }
        @JavascriptInterface public void vibrate(String json) {
            try {
                JSONArray a = new JSONArray(json); long[] t = new long[a.length() + 1]; t[0] = 0;
                for (int i = 0; i < a.length(); i++) t[i + 1] = a.getLong(i);
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(t, -1)); else v.vibrate(t, -1);
            } catch (Exception ignored) {}
        }
        @JavascriptInterface public void copy(String text) {
            runOnUiThread(() -> { ClipboardManager c = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE); c.setPrimaryClip(ClipData.newPlainText("enlace", text)); Toast.makeText(MainActivity.this, "Enlace copiado", Toast.LENGTH_SHORT).show(); });
        }
    }

    @Override public void onBackPressed() {
        long n = System.currentTimeMillis();
        if (n - lastBack < 2000) super.onBackPressed(); else { lastBack = n; Toast.makeText(this, "Pulsa otra vez para salir", Toast.LENGTH_SHORT).show(); }
    }
    @Override protected void onDestroy() {
        if (recognizer != null) recognizer.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }
}
