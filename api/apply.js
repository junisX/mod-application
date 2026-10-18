import { buildEmbed, sendApplication, validateApplication } from '../backend/application.js';
import { rateLimit } from '../backend/rate-limit.js';

const GENERIC_ERROR = 'Deine Bewerbung konnte gerade nicht gesendet werden. Bitte versuche es erneut.';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'https://junisx.github.io,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function applyCors(res, origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
}

function send(res, status, payload, origin) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  applyCors(res, origin);
  res.status(status).send(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const origin = req.headers.origin ?? '';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    applyCors(res, origin);
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    send(res, 405, { ok: false, error: 'Methode nicht erlaubt.' }, origin);
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    console.error('DISCORD_WEBHOOK_URL ist nicht gesetzt');
    send(res, 503, { ok: false, error: GENERIC_ERROR }, origin);
    return;
  }

  const clientIp = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';

  if (!rateLimit(clientIp)) {
    send(res, 429, { ok: false, error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }, origin);
    return;
  }

  let payload = req.body;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }

  if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
    send(res, 200, { ok: true }, origin);
    return;
  }

  const result = validateApplication(payload);

  if (!result.ok) {
    send(res, result.status, { ok: false, error: result.error }, origin);
    return;
  }

  try {
    await sendApplication(webhookUrl, buildEmbed(result.answers, result.platform));
    send(res, 200, { ok: true }, origin);
  } catch (error) {
    console.error('Übermittlung fehlgeschlagen:', error.message);
    send(res, 502, { ok: false, error: GENERIC_ERROR }, origin);
  }
}
