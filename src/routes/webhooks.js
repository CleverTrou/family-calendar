import { updateReminders } from '../services/reminders.js';
import { config } from '../config.js';

const FIELD_SEP = '|||';

/**
 * Parse the pipe-delimited text format from Apple Shortcuts.
 *
 * Expected format (one reminder per line):
 *   syncedBy:Trevor
 *   Buy groceries|||2026-03-25T10:00:00-0500|||Pick up milk and eggs|||0
 *   Call dentist|||2026-03-26T14:00:00-0500||||1
 *
 * Fields per line: title|||dueDate|||notes|||priority
 * Empty fields are fine (e.g., no notes → "title|||date||||||0")
 */
function parsePipeDelimited(raw) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // First line must be syncedBy:Name
  const headerMatch = lines[0].match(/^syncedBy:(.+)$/i);
  if (!headerMatch) return null;

  const syncedBy = headerMatch[1].trim();
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(FIELD_SEP);
    const title = (parts[0] || '').trim();
    if (!title) continue;

    items.push({
      title,
      dueDate: (parts[1] || '').trim() || null,
      notes: (parts[2] || '').trim() || '',
      priority: parsePriority(parts[3]),
      isCompleted: false,
      list: (parts[4] || '').trim() || 'Family',
    });
  }

  return items.length > 0 ? { items, syncedBy } : null;
}

function parsePriority(val) {
  if (!val) return 0;
  val = val.trim();
  if (val === 'None' || val === 'none' || val === '0') return 0;
  return parseInt(val) || 0;
}

/**
 * Parse JSON body with fallback for malformed Shortcuts JSON.
 * Supports both proper {"items":[...]} and the flat concatenated shape.
 */
function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    // no-op
  }

  // Fallback: extract fields from malformed JSON (flat concatenated shape)
  try {
    const syncedByMatch = raw.match(/"syncedBy"\s*:\s*"?([^"}\n]+)"?/);
    const syncedBy = syncedByMatch ? syncedByMatch[1].trim() : 'Unknown';

    const itemsMatch = raw.match(/"items"\s*:\s*\{([\s\S]*)\}\s*,\s*"syncedBy"/);
    if (!itemsMatch) return null;

    const inner = itemsMatch[1];
    const extract = (key) => {
      const m = inner.match(new RegExp(`"${key}"\\s*:\\s*"?([\\s\\S]*?)(?="[a-zA-Z]+"\\s*:|$)`));
      if (!m) return '';
      return m[1].replace(/[",\s]+$/, '').replace(/^"/, '');
    };

    // Split newline-concatenated fields back into individual items
    const titles = extract('title').split('\n').map((s) => s.trim()).filter(Boolean);
    if (titles.length === 0) return null;

    const split = (val) => {
      const parts = val.split('\n').map((s) => s.trim());
      while (parts.length < titles.length) parts.push(parts[parts.length - 1] || '');
      return parts;
    };

    const notes = split(extract('notes'));
    const dueDates = split(extract('dueDate'));
    const priorities = split(extract('priority'));
    const lists = split(extract('list'));

    const items = titles.map((title, i) => ({
      title,
      notes: notes[i] || '',
      dueDate: dueDates[i] || null,
      isCompleted: false,
      priority: parsePriority(priorities[i]),
      list: lists[i] || 'Family',
    }));

    return { items, syncedBy };
  } catch {
    return null;
  }
}

/**
 * Register webhook routes for Apple Shortcuts to POST reminders data.
 */
export async function registerWebhookRoutes(fastify) {
  // Accept any body as plain text so Fastify won't reject malformed payloads
  for (const ct of ['application/json', 'text/plain']) {
    fastify.addContentTypeParser(ct, { parseAs: 'string' }, (req, body, done) =>
      done(null, body)
    );
  }

  fastify.post('/reminders/sync', async (request, reply) => {
    // Authenticate via shared secret header
    const secret = request.headers['x-webhook-secret'];
    if (config.reminders.webhookSecret && secret !== config.reminders.webhookSecret) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (!raw || !raw.trim()) {
      return reply.code(400).send({ error: 'Empty body' });
    }

    // Try pipe-delimited format first (starts with "syncedBy:"), then JSON
    let parsed = parsePipeDelimited(raw) || tryParseJson(raw);

    if (!parsed) {
      console.error('[Reminders] Failed to parse body. Raw content:');
      console.error(raw);
      return reply.code(400).send({
        error: 'Could not parse request body',
        hint: 'Expected pipe-delimited text (syncedBy:Name header + title|||date|||notes|||priority lines) or JSON',
      });
    }

    let { items, syncedBy } = parsed;

    // Handle flat concatenated JSON (items is an object, not an array)
    if (items && !Array.isArray(items)) {
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
