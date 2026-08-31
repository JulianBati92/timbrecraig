# 🔔 TimbreCraig v2.3

TimbreCraig convierte un QR colocado en la puerta en un timbre digital. El visitante escanea el QR, toca el timbre y opcionalmente deja nombre, motivo, teléfono y mensaje. El propietario recibe el aviso directamente en su celular mediante ntfy.

## Flujo

`QR → TimbreCraig → API valida → ntfy → celular`

## Funciones

- Interfaz mobile-first.
- Timbre rápido sin completar formulario.
- Nombre, motivo, teléfono y mensaje opcionales.
- Notificación push inmediata mediante ntfy.
- Prioridad máxima para los avisos del timbre.
- QR dinámico generado por el backend.
- Página `/qr` preparada para abrir o imprimir el código.
- PWA instalable.
- Healthcheck en `/api/health`.
- Identificador de vivienda configurable.
- Sin base de datos ni almacenamiento permanente de datos del visitante.

## Instalación

```bash
npm install
cp .env.example .env
npm start
```

Requiere Node.js 20 o superior.

Abrí `http://localhost:3000/r/casa`. El QR está disponible en `http://localhost:3000/qr`.

## Avisos al celular con ntfy

1. Instalá la aplicación ntfy en el celular receptor.
2. Elegí un topic privado, largo y aleatorio.
3. Suscribí el celular a ese mismo topic.
4. Configurá en el backend:

```env
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=tu-topic-privado-y-aleatorio
```

No hace falta guardar un número telefónico en TimbreCraig. El celular que esté suscripto al topic recibe el aviso.

`NTFY_TOKEN` queda disponible para una futura instalación de ntfy con autenticación, pero no es necesario para el uso básico con un topic público aleatorio.

## Seguridad

- Helmet y Content Security Policy.
- `X-Powered-By` deshabilitado.
- Rate limit general y límite específico para el timbre.
- Body limitado a 8 KB.
- Validación y sanitización de campos.
- IDs de visita generados con `crypto.randomUUID()`.
- El topic de ntfy se mantiene como variable de entorno y no se envía al navegador.
- Timeouts para servicios externos.
- Sin credenciales hardcodeadas en el repositorio.
- Sin dependencia de los antiguos servidores Glitch, Twilio o Trello.

> Un topic de `ntfy.sh` sin autenticación debe tratarse como un secreto: usá un valor largo, aleatorio y difícil de adivinar. Para mayor privacidad puede migrarse más adelante a una instancia propia de ntfy con autenticación.

## Vercel

Variables mínimas:

```env
HOME_ID=casa
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=tu-topic-privado-y-aleatorio
```

`PUBLIC_BASE_URL` puede quedar vacío en Vercel porque TimbreCraig detecta el host público automáticamente.

No configures todavía `TURNSTILE_SECRET_KEY`: el backend lo soporta, pero el widget del frontend debe integrarse antes de habilitar esa validación.

## QR

Una vez desplegado:

```text
https://tu-dominio/qr
```

muestra el QR para imprimir. El código apunta automáticamente a:

```text
https://tu-dominio/r/casa
```

No pongas el número telefónico, el topic de ntfy ni ningún token dentro del QR.

## Licencia

Proyecto personal de Julián Batistutti.
