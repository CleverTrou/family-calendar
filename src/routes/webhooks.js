import { updateReminders } from '../services/reminders.js';
import { config } from '../config.js';

/**
 * Register webhook routes for Apple Shortcuts to POST reminders data.
 */
export async function registerWebhookRoutes(fastify) {
  fastify.post('/reminders/sync', async (request, reply) => {
    // Authenticate via shared secret header
    const secret = request.headers['x-webhook-secret'];
    if (config.reminders.webhookSecret && secret !== config.reminders.webhookSecret) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { items, syncedBy } = request.body || {};

    if (!Array.isArray(items)) {
      return reply.code(400).send({ error: '"items" must be an array' });
    }

    const result = updateReminders(items, syncedBy);

    console.log(
      `[Reminders] Received ${result.items.length} items from ${result.syncedBy}`
    );

    return {
      status: 'ok',
      received: result.items.length,
      syncedAt: result.lastSyncedAt,
    };
  });
}
