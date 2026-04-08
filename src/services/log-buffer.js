/**
 * In-memory ring buffer for recent log messages.
 *
 * Intercepts console.log/warn/error so all application logs
 * are captured and available via the admin panel's log viewer.
 * The original console methods still work (output goes to stdout/stderr).
 */

const MAX_ENTRIES = 200;
const buffer = [];

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function addEntry(level, args) {
  const message = args.map((a) =>
    typeof a === 'string' ? a : JSON.stringify(a, null, 2)
  ).join(' ');

  buffer.push({
    time: new Date().toISOString(),
    level,
    message,
  });

  // Trim to max size
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

// Intercept console methods
console.log = function (...args) {
  addEntry('info', args);
  originalLog.apply(console, args);
};

console.warn = function (...args) {
  addEntry('warn', args);
  originalWarn.apply(console, args);
};

console.error = function (...args) {
  addEntry('error', args);
  originalError.apply(console, args);
};

/** Get recent log entries, optionally filtered by level. */
export function getLogs(level, limit) {
  let entries = buffer;
  if (level) {
    entries = entries.filter((e) => e.level === level);
  }
  if (limit && limit < entries.length) {
    entries = entries.slice(-limit);
  }
  return entries;
}

/** Get the total number of entries in the buffer. */
export function getLogCount() {
  return buffer.length;
}
