import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists for credential store
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

// CORS for local development (browser on MacBook → server on Pi)
await fastify.register(fastifyCors, { origin: true });

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

// Admin PIN verification endpoint
fastify.post('/api/admin/verify-pin', async (request, reply) => {
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

// Protected settings endpoints
fastify.addHook('preHandler', (request, reply, done) => {
  // Only protect settings-write and account routes
  const protectedPaths = ['/api/settings'];
  if (request.method === 'PUT' && protectedPaths.some((p) => request.url.startsWith(p))) {
    requireAdmin(request, reply, done);
    return;
  }
  done();
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
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[Server] Family Calendar running at http://localhost:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
