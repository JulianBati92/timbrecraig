require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOME_ID = process.env.HOME_ID || 'casa';
const MAX_VISITS = 100;
const visits = [];

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } } }));
app.use(express.json({ limit: '8kb' }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));

const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const ringLimiter = rateLimit({ windowMs: 5 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados llamados. Esperá unos minutos e intentá nuevamente.' } });
app.use('/api', limiter);

function clean(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\u0000-\u001F]/g, '').trim().slice(0, max);
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  return data.success === true;
}

async function notifyOwner(visit) {
  const text = `🔔 TimbreCraig\nHay alguien en la puerta.\n👤 ${visit.name || 'Visitante'}\n📌 ${visit.reason}\n💬 ${visit.message || 'Sin mensaje'}\n🕐 ${new Date(visit.createdAt).toLocaleString('es-AR')}`;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && chatId) {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) throw new Error('Notification provider failed');
  }
  const webhook = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'doorbell.ring', visit: { ...visit, phone: undefined } }), signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error('Webhook provider failed');
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'timbrecraig', version: '2.0.0' }));
app.get('/api/config', (_req, res) => res.json({ homeId: HOME_ID, turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null }));

app.post('/api/homes/:homeId/ring', ringLimiter, async (req, res) => {
  try {
    if (req.params.homeId !== HOME_ID) return res.status(404).json({ error: 'Timbre no encontrado.' });
    const allowedReasons = ['Visita', 'Entrega', 'Correo', 'Técnico', 'Otro'];
    const name = clean(req.body.name, 80);
    const reason = clean(req.body.reason, 30) || 'Visita';
    const message = clean(req.body.message, 300);
    const phone = clean(req.body.phone, 40);
    if (!allowedReasons.includes(reason)) return res.status(400).json({ error: 'Motivo inválido.' });
    if (phone && !/^[+0-9 ()-]{6,40}$/.test(phone)) return res.status(400).json({ error: 'Teléfono inválido.' });
    const human = await verifyTurnstile(clean(req.body.turnstileToken, 2048), req.ip);
    if (!human) return res.status(403).json({ error: 'No pudimos validar la solicitud.' });

    const visit = { id: crypto.randomUUID(), homeId: HOME_ID, name, reason, message, phone, status: 'waiting', createdAt: new Date().toISOString() };
    visits.unshift(visit);
    if (visits.length > MAX_VISITS) visits.length = MAX_VISITS;
    try { await notifyOwner(visit); } catch (error) { console.error('notification_error', { visitId: visit.id, message: error.message }); }
    return res.status(201).json({ ok: true, visitId: visit.id, message: 'Avisamos que estás en la puerta.' });
  } catch (error) {
    console.error('ring_error', { message: error.message });
    return res.status(500).json({ error: 'No pudimos enviar el aviso. Intentá nuevamente.' });
  }
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.get('/r/:homeId', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((_err, _req, res, _next) => res.status(500).json({ error: 'Error interno.' }));

app.listen(PORT, () => console.log(`TimbreCraig v2 escuchando en puerto ${PORT}`));
