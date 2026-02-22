import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, getEnabledSources } from './config.js';
import { registerApiRoutes } from './routes/api.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { startSyncScheduler } from './services/sync-scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      'Copy .env.example to .env and fill in your credentials.'
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
