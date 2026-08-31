# 🔔 TimbreCraig v2

TimbreCraig convierte un QR colocado en la puerta en un timbre digital. El visitante escanea el QR, toca el timbre y opcionalmente deja nombre, motivo, teléfono y mensaje. El propietario recibe el aviso mediante Telegram o un webhook configurable.

## Flujo

`QR → /r/:homeId → visitante toca el timbre → API valida → rate limit → notificación`

## Funciones

- Interfaz mobile-first y accesible.
- Timbre rápido sin completar formulario.
- Nombre, motivo, teléfono y mensaje opcionales.
- Motivos predefinidos para evitar contenido arbitrario.
- Avisos por Telegram y/o webhook.
- PWA instalable.
- Endpoint de healthcheck.
- Identificador de vivienda configurable.
- Registro temporal de las últimas visitas en memoria (máximo 100).

## Seguridad

- `helmet` y Content Security Policy.
- `X-Powered-By` deshabilitado.
- Límite global de solicitudes y límite estricto para tocar el timbre.
- Body limitado a 8 KB.
- Validación de campos, longitudes y teléfono.
- Sanitización de caracteres de control/HTML.
- IDs de visita generados con `crypto.randomUUID()`.
- Credenciales exclusivamente mediante variables de entorno.
- `.env` ignorado por Git.
- Timeouts para proveedores externos.
- Mensajes de error públicos sin stack traces ni secretos.
- Cloudflare Turnstile opcional para protección anti-bot.
- El webhook no recibe el teléfono del visitante por defecto.
- Los endpoints antiguos con URLs Glitch hardcodeadas fueron eliminados.

> Nota: el almacenamiento en memoria es intencional para el MVP y se pierde al reiniciar. Para producción con historial/panel se recomienda PostgreSQL/Supabase con autenticación del propietario y políticas de retención.

## Instalación

```bash
npm install
cp .env.example .env
npm start
```

Requiere Node.js 20 o superior.

Abrí `http://localhost:3000/r/casa` (o reemplazá `casa` por el valor configurado en `HOME_ID`).

## Telegram

Creá un bot con BotFather, obtené el token y configurá:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Nunca subas el `.env` al repositorio.

## Webhook

Para integrar n8n, Make u otro servicio:

```env
NOTIFICATION_WEBHOOK_URL=https://tu-endpoint-seguro.example/webhook
```

El webhook recibe `event: doorbell.ring` y los datos no sensibles de la visita.

## Turnstile

En producción es recomendable activar Cloudflare Turnstile. Configurá `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`. Si se define la clave secreta, el servidor rechazará solicitudes que no tengan una validación válida. La integración visual del widget debe añadirse al frontend antes de habilitar el secret.

## QR

El QR debe apuntar a la URL pública de la vivienda:

```text
https://tu-dominio.example/r/casa
```

No pongas números telefónicos, tokens ni datos privados dentro del QR.

## Próxima etapa

- PostgreSQL/Supabase para persistencia real.
- Login seguro del propietario.
- Panel privado con historial y estados `waiting/attended/ignored`.
- Push notifications Web Push.
- Múltiples viviendas/usuarios con IDs aleatorios no enumerables.
- Retención y borrado automático de datos personales.
- Tests automatizados y CI.

## Licencia

Proyecto personal de Julián Batistutti.
