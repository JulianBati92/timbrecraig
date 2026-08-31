require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOME_ID = process.env.HOME_ID || 'casa';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(express.json({ limit: '8kb' }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const ringLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados llamados. Esperá unos minutos e intentá nuevamente.' }
});

app.use('/api', limiter);

function clean(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\u0000-\u001F]/g, '').trim().slice(0, max);
}

function publicBaseUrl(req) {
  const configured = clean(process.env.PUBLIC_BASE_URL, 500).replace(/\/$/, '');
  if (configured) return configured;

  const proto = clean(req.headers['x-forwarded-proto'], 20) || req.protocol || 'https';
  const host = clean(req.headers['x-forwarded-host'], 255) || clean(req.get('host'), 255);
  if (!host) throw new Error('Unable to determine public host');
  return `${proto.split(',')[0]}://${host.split(',')[0]}`;
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.success === true;
}

function visitText(visit) {
  return [
    `👤 ${visit.name || 'Visitante'}`,
    `📌 ${visit.reason}`,
    `📞 ${visit.phone || 'No informado'}`,
    `💬 ${visit.message || 'Sin mensaje'}`,
    `🕐 ${new Date(visit.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`
  ].join('\n');
}

function ntfyConfig() {
  const server = clean(process.env.NTFY_SERVER || 'https://ntfy.sh', 500).replace(/\/$/, '');
  const topic = clean(process.env.NTFY_TOPIC, 64);
  const token = clean(process.env.NTFY_TOKEN, 500);
  return { server, topic, token };
}

async function notifyNtfy(visit) {
  const { server, topic, token } = ntfyConfig();
  if (!topic) {
    const error = new Error('NTFY_TOPIC is not configured');
    error.code = 'NOTIFICATION_NOT_CONFIGURED';
    throw error;
  }

  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic)) {
    const error = new Error('NTFY_TOPIC has an invalid format');
    error.code = 'NOTIFICATION_NOT_CONFIGURED';
    throw error;
  }

  const headers = {
    'content-type': 'application/json'
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${server}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic,
      title: '🔔 Hay alguien en la puerta',
      message: visitText(visit),
      priority: 5,
      tags: ['door', 'bell']
    }),
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) {
    throw new Error(`ntfy notification failed (${response.status})`);
  }
}

app.get('/api/health', (_req, res) => {
  const { topic } = ntfyConfig();
  res.json({
    ok: true,
    service: 'timbrecraig',
    version: '2.3.0',
    notificationsConfigured: Boolean(topic),
    provider: 'ntfy'
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    homeId: HOME_ID,
    doorbellUrl: `${publicBaseUrl(req)}/r/${encodeURIComponent(HOME_ID)}`,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null
  });
});

app.get('/api/qr', async (req, res) => {
  try {
    const doorbellUrl = `${publicBaseUrl(req)}/r/${encodeURIComponent(HOME_ID)}`;
    const svg = await QRCode.toString(doorbellUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 720
    });
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
  } catch (error) {
    console.error('qr_error', { message: error.message });
    res.status(500).json({ error: 'No pudimos generar el QR.' });
  }
});

app.get('/qr', (req, res) => {
  const doorbellUrl = `${publicBaseUrl(req)}/r/${encodeURIComponent(HOME_ID)}`;
  res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>QR · TimbreCraig</title><style>body{font-family:system-ui;background:#10131a;color:#fff;margin:0;display:grid;min-height:100vh;place-items:center}.card{background:#181d27;padding:32px;border-radius:24px;text-align:center;max-width:460px;margin:20px;box-shadow:0 18px 60px #0007}.qr{background:#fff;padding:18px;border-radius:18px;width:min(300px,80vw)}h1{margin-bottom:4px}p{color:#bbc3d2}.url{word-break:break-all;font-size:13px}.actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}a,button{border:0;border-radius:12px;padding:12px 16px;font-weight:700;text-decoration:none;cursor:pointer}a{background:#ffd54a;color:#111}button{background:#fff;color:#111}@media print{body{background:#fff;color:#000}.card{box-shadow:none;background:#fff}.actions,.url{display:none}p{color:#333}}</style></head><body><main class="card"><div>🔔</div><h1>TimbreCraig</h1><p>Escaneá para tocar el timbre</p><img class="qr" src="/api/qr" alt="Código QR del timbre"><p class="url">${doorbellUrl}</p><div class="actions"><a href="/api/qr" target="_blank" rel="noopener">Abrir QR</a><button onclick="window.print()">Imprimir cartel</button></div></main></body></html>`);
});

app.post('/api/homes/:homeId/ring', ringLimiter, async (req, res) => {
  try {
    if (req.params.homeId !== HOME_ID) {
      return res.status(404).json({ error: 'Timbre no encontrado.' });
    }

    const allowedReasons = ['Visita', 'Entrega', 'Correo', 'Técnico', 'Otro'];
    const name = clean(req.body.name, 80);
    const reason = clean(req.body.reason, 30) || 'Visita';
    const message = clean(req.body.message, 300);
    const phone = clean(req.body.phone, 40);

    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({ error: 'Motivo inválido.' });
    }
    if (phone && !/^[+0-9 ()-]{6,40}$/.test(phone)) {
      return res.status(400).json({ error: 'Teléfono inválido.' });
    }

    const human = await verifyTurnstile(clean(req.body.turnstileToken, 2048), req.ip);
    if (!human) {
      return res.status(403).json({ error: 'No pudimos validar la solicitud.' });
    }

    const visit = {
      id: crypto.randomUUID(),
      homeId: HOME_ID,
      name,
      reason,
      message,
      phone,
      createdAt: new Date().toISOString()
    };

    try {
      await notifyNtfy(visit);
    } catch (error) {
      console.error('notification_error', { visitId: visit.id, message: error.message });
      if (error.code === 'NOTIFICATION_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'El timbre todavía no tiene configurado el celular receptor.' });
      }
      return res.status(502).json({ error: 'No pudimos entregar el aviso al celular. Intentá nuevamente.' });
    }

    return res.status(201).json({
      ok: true,
      visitId: visit.id,
      message: 'Avisamos que estás en la puerta.'
    });
  } catch (error) {
    console.error('ring_error', { message: error.message });
    return res.status(500).json({ error: 'No pudimos enviar el aviso. Intentá nuevamente.' });
  }
});

app.get('/', (_req, res) => res.redirect(302, `/r/${encodeURIComponent(HOME_ID)}`));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.get('/r/:homeId', (req, res) => {
  if (req.params.homeId !== HOME_ID) return res.status(404).send('Timbre no encontrado');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((_err, _req, res, _next) => res.status(500).json({ error: 'Error interno.' }));

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`TimbreCraig v2.3 escuchando en puerto ${PORT}`));
}
