# Calendario mental

Tres piezas conectadas por WebSocket:

| Pieza | URL | Quién la usa |
|---|---|---|
| **Emisor** (buscador de calendarios) | `/` | Espectadores, en su propio móvil |
| **Receptor** | `/r` (PIN) | Mentalista: pantalla, voz, vibración |
| **Reloj** | `/w` | Navegador del reloj (opcional) |

## Arrancar
```bash
npm install
PIN=4821 npm start          # http://localhost:3000   (receptor en /r)
npm test                    # fórmula (302 736 fechas 1600-2500), reconocimiento de año y servidor
```
Variables: `PORT`, `PIN` (obligatorio en producción), `NTFY_TOPIC` (notificación al móvil/reloj vía la app ntfy), `NTFY_SERVER`.

## Publicar
Necesita HTTPS + WebSocket persistente (Render, Fly.io, Railway, VPS). Vercel/Netlify serverless **no** sirven.
Apunta tu dominio (calendario-en-linea.com…) al servicio. Enlace/QR/NFC para el espectador: `https://tudominio/` (sala opcional `/?k=mesa1`).

## Cómo funciona
- El espectador escribe cualquier frase con un año ("calendario de 1890", "1890 calendario", "calendario del año 1.890"…) → se muestra el calendario real de ese año y se envía `año · código · bisiesto`.
- Si escribe algo que no contiene un año (1600-9999), pasa al buscador real (cobertura natural).
- Tras 6 min sin actividad, el emisor redirige al buscador real (`IDLE_MIN` en `public/emitter.js`).
- Cada espectador es una "Persona N" (se recuerda por dispositivo), con varios a la vez.
- Código = `(día + mes + código_año) mod 7`, **restando 1 solo en enero/febrero de años bisiestos**. Meses: 6-2-2-5-0-3-5-1-4-6-2-4.
- El receptor calcula todo localmente: voz, mando y gestos siguen funcionando sin internet (service worker).

## Modos del receptor (`/r` → Modos)
Web · Voz (reconoce "mil setecientos cincuenta y nueve" o "1759") · Mando/teclado (8BitDo Zero2, botones remapeables) · Gestos (N toques = dígito, dos dedos = 0) · Teclado en pantalla.
Salida: pantalla, voz por auriculares, vibración (N pulsos = código; 1 larga = 0; pulso largo extra = bisiesto).
