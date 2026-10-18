import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEmbed, sendApplication, validateApplication } from './application.js';
import { loadEnv } from './env.js';
import { rateLimit } from './rate-limit.js';

loadEnv();

const PORT = Number(process.env.PORT ?? 3000);
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL?.trim();
const PUBLIC_DIR = resolve(fileURLToPath(new URL('../frontend/', import.meta.url)));
const MAX_BODY_BYTES = 8 * 1024;
const GENERIC_ERROR = 'Deine Bewerbung konnte gerade nicht gesendet werden. Bitte versuche es erneut.';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    let oversized = false;

    req.on('data', (chunk) => {
      if (oversized) return;

      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        reject(Object.assign(new Error('Anfrage zu groß'), { status: 413 }));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Ungültiges JSON'), { status: 400 }));
      }
    });

    req.on('error', reject);
  });
}

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket.remoteAddress ?? 'unknown';
}

async function handleApply(req, res) {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    sendJson(res, 415, { ok: false, error: 'Ungültige Anfrage.' });
    return;
  }

  if (!rateLimit(clientKey(req))) {
    sendJson(res, 429, { ok: false, error: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
    return;
  }

  let payload;

  try {
    payload = await readJson(req);
  } catch (error) {
    sendJson(res, error.status ?? 400, { ok: false, error: 'Ungültige Anfrage.' });
    return;
  }

  if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const result = validateApplication(payload);

  if (!result.ok) {
    sendJson(res, result.status, { ok: false, error: result.error });
    return;
  }

  if (!WEBHOOK_URL) {
    console.error('[apply] DISCORD_WEBHOOK_URL ist nicht gesetzt');
    sendJson(res, 503, { ok: false, error: GENERIC_ERROR });
    return;
  }

  try {
    await sendApplication(WEBHOOK_URL, buildEmbed(result.answers, result.platform));
    console.log('[apply] Bewerbung übermittelt');
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('[apply] Übermittlung fehlgeschlagen:', error.message);
    sendJson(res, 502, { ok: false, error: GENERIC_ERROR });
  }
}

async function serveStatic(req, res, pathname) {
  let requested;

  try {
    requested = decodeURIComponent(pathname);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Ungültige Anfrage.' });
    return;
  }

  const file = resolve(PUBLIC_DIR, `.${requested === '/' ? '/index.html' : requested}`);

  if (!file.startsWith(PUBLIC_DIR + sep)) {
    sendJson(res, 404, { ok: false, error: 'Nicht gefunden.' });
    return;
  }

  let info;

  try {
    info = await stat(file);
  } catch {
    sendJson(res, 404, { ok: false, error: 'Nicht gefunden.' });
    return;
  }

  if (!info.isFile()) {
    sendJson(res, 404, { ok: false, error: 'Nicht gefunden.' });
    return;
  }

  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Cache-Control': 'no-cache',
    'Content-Length': info.size,
    'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(file).pipe(res);
}

async function handleRequest(req, res) {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (pathname === '/api/apply') {
    if (req.method !== 'POST') {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'POST' });
      res.end();
      return;
    }

    await handleApply(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { ok: false, error: 'Nicht gefunden.' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  await serveStatic(req, res, pathname);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('[server] Anfrage fehlgeschlagen:', error.message);

    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Interner Fehler.' });
    else res.destroy();
  });
});

server.on('clientError', (error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(PORT, () => {
  console.log(`Mod-Application läuft auf http://localhost:${PORT}`);

  if (!WEBHOOK_URL) {
    console.warn('DISCORD_WEBHOOK_URL ist nicht gesetzt – Bewerbungen können nicht gesendet werden.');
  }
});
