// Import log buffer first so it captures all subsequent console output
import './services/log-buffer.js';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, getEnabledSources } from './config.js';
import { registerApiRoutes } from './routes/api.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { requireAdmin, isPinRequired, verifyPin, generateToken } from './services/admin-auth.js';
import { startSyncScheduler } from './services/sync-scheduler.js';
import { parseCIDR, matchCIDR } from './services/net-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists for credential store
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

// Warn loudly at startup if the reminders webhook secret is unset or default
const _webhookSecret = process.env.REMINDERS_WEBHOOK_SECRET || '';
if (!_webhookSecret || _webhookSecret === 'change-me-to-a-random-string') {
  console.warn(
    '[Security] REMINDERS_WEBHOOK_SECRET is not set or still the default value. ' +
    'POST /api/reminders/sync is open to anyone on the network. ' +
    'Set a strong random value in .env to protect this endpoint.'
  );
}

// Warn loudly at startup if the admin panel has no PIN protection
if (!process.env.ADMIN_PIN) {
  console.warn(
    '[Security] ADMIN_PIN is not set. The /admin panel (settings, connected accounts, ' +
    'live logs, forced re-sync) is open to anyone who can reach this server. ' +
    'Set ADMIN_PIN in .env to require a PIN before making changes.'
  );
}

// Warn loudly at startup if there's no IP allowlist restricting who can reach the server
if (!process.env.ALLOWED_NETWORKS) {
  console.warn(
    '[Security] ALLOWED_NETWORKS is not set. This server accepts requests from any ' +
    'network it can be reached on. Set ALLOWED_NETWORKS in .env (e.g. your home LAN\'s ' +
    'CIDR range) to restrict access.'
  );
}

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

// ── Security: IP allowlist ────────────────────────────
// If ALLOWED_NETWORKS is set, reject requests from outside those ranges.
if (config.allowedNetworks.length > 0) {
  const nets = config.allowedNetworks.map(parseCIDR);
  fastify.addHook('onRequest', (request, reply, done) => {
    const ip = request.ip;
    if (!nets.some((net) => matchCIDR(ip, net))) {
      console.warn(`[Security] Blocked request from ${ip}`);
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
    done();
  });
  console.log(`[Security] IP allowlist active: ${config.allowedNetworks.join(', ')}`);
}

// ── Security: rate limiting on sensitive endpoints ────
await fastify.register(rateLimit, {
  global: false, // only apply to routes that opt in
});

// ── Security: standard headers ───────────────────────
fastify.addHook('onSend', (request, reply, payload, done) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('Referrer-Policy', 'same-origin');
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "connect-src 'self'"
  );
  done();
});

// No CORS: frontend is served from the same origin as the API.
// Disabling prevents cross-origin pages from silently reading calendar data.
await fastify.register(fastifyCors, { origin: false });

// Serve the frontend as static files
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'frontend'),
  prefix: '/',
});

// API routes (GET /api/calendar, POST /api/sync, GET /api/health)
await fastify.register(registerApiRoutes, { prefix: '/api' });

// Webhook routes (POST /api/reminders/sync)
await fastify.register(registerWebhookRoutes, { prefix: '/api' });

// OAuth callback routes (GET /api/auth/google/start, /api/auth/google/callback)
await fastify.register(registerAuthRoutes, { prefix: '/api/auth' });

// Account management routes (protected by admin PIN)
await fastify.register(async (instance) => {
  instance.addHook('preHandler', requireAdmin);
  await instance.register(registerAccountRoutes);
}, { prefix: '/api/accounts' });

// Admin PIN verification endpoint (rate-limited: 5 attempts/min to prevent brute force)
fastify.post('/api/admin/verify-pin', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
}, async (request, reply) => {
  const { pin } = request.body || {};
  if (!verifyPin(pin)) {
    return reply.code(401).send({ error: 'Invalid PIN' });
  }
  return { token: generateToken() };
});

// Admin status (is PIN required?)
fastify.get('/api/admin/status', async () => {
  return { pinRequired: isPinRequired() };
});

// Serve /admin → admin.html (settings panel for laptop access)
fastify.get('/admin', async (request, reply) => {
  return reply.sendFile('admin.html');
});

// Start the periodic calendar sync scheduler
const sources = getEnabledSources();
console.log('[Server] Enabled sources:', sources);

if (sources.google || sources.icloud) {
  startSyncScheduler();
} else {
  console.warn(
    '[Server] No calendar credentials configured. ' +
      'Visit /admin to connect your calendar accounts, or copy .env.example to .env.'
  );
}

// Start listening
try {
  await fastify.listen({ port: config.port, host: config.host });
  console.log(`[Server] Family Calendar running at http://localhost:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
