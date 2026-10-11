// Capture console output before loading the app.
import './services/log-buffer.js';
import { buildApp } from './app.js';
import { config, getEnabledSources } from './config.js';
import { startSyncScheduler } from './services/sync-scheduler.js';

const fastify = await buildApp();

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
