import os from 'node:os';
import { readFileSync, statfsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getCachedData, syncAllCalendars } from '../services/calendar-store.js';
import {
  loadSettings,
  saveSettings,
  getAvailableFonts,
} from '../services/settings.js';
import { config } from '../config.js';

/**
 * Register REST API routes for both the display frontend and the admin panel.
 */
export async function registerApiRoutes(fastify) {
  // ── Display endpoints ───────────────────────────────

  // Primary endpoint: all combined calendar + reminders data + settings
  fastify.get('/calendar', async () => {
    return getCachedData();
  });

  // Force an immediate re-sync
  fastify.post('/sync', async () => {
    await syncAllCalendars();
    return { status: 'ok', ...getCachedData() };
  });

  // Health check
  fastify.get('/health', async () => {
    const data = getCachedData();
    return {
      status: 'ok',
      lastSyncTime: data.lastSyncTime,
      lastError: data.lastError,
      eventCount: data.events.length,
      remindersCount: data.reminders.items.length,
      enabledSources: data.enabledSources,
      uptime: Math.round(process.uptime()),
    };
  });

  // ── Settings endpoints (used by /admin panel) ───────

  // Get current settings + metadata for the admin panel
  fastify.get('/settings', async () => {
    const data = getCachedData();
    return {
      settings: data.settings,
      knownCalendars: data.knownCalendars,
      availableFonts: getAvailableFonts(),
    };
  });

  // Save updated settings
  fastify.put('/settings', async (request) => {
    const updated = saveSettings(request.body);
    // Trigger a re-sync so visibility changes take effect immediately
    syncAllCalendars();
    return { status: 'ok', settings: updated };
  });

  // ── Display schedule endpoint (polled by Pi) ────────

  /**
   * Returns whether the display should be on or off right now,
   * based on the schedule in settings. The Pi polls this endpoint
   * every 30–60 seconds and runs xset dpms force on/off accordingly.
   */
  fastify.get('/display/status', async () => {
    const settings = loadSettings();
    const { screenSchedule, screenOnTime, screenOffTime, screenOnDays } = settings.display;

    // If schedule is disabled, screen should always be on
    if (!screenSchedule) {
      return { screenOn: true, schedule: false };
    }

    // Get current time in the configured display timezone
    const now = new Date();
    const tz = config.timezone;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour').value);
    const minute = parseInt(parts.find((p) => p.type === 'minute').value);
    const currentMinutes = hour * 60 + minute;

    // Check day-of-week (0=Sun, 1=Mon, ...)
    const dayStr = dayFormatter.format(now);
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentDay = dayMap[dayStr];
    const dayEnabled = !screenOnDays || screenOnDays.includes(currentDay);

    // Parse on/off times to minutes since midnight
    const [onH, onM] = (screenOnTime || '06:30').split(':').map(Number);
    const [offH, offM] = (screenOffTime || '23:00').split(':').map(Number);
    const onMinutes = onH * 60 + onM;
    const offMinutes = offH * 60 + offM;

    let screenOn;
    if (onMinutes < offMinutes) {
      // Normal range: on at 06:30, off at 23:00
      screenOn = dayEnabled && currentMinutes >= onMinutes && currentMinutes < offMinutes;
    } else {
      // Overnight range: on at 22:00, off at 06:00 (spans midnight)
      screenOn = dayEnabled && (currentMinutes >= onMinutes || currentMinutes < offMinutes);
    }

    return {
      screenOn,
      schedule: true,
      currentTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      currentDay,
      onTime: screenOnTime,
      offTime: screenOffTime,
    };
  });

  // ── System stats (admin panel monitoring) ───────────

  fastify.get('/system/stats', async () => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    // CPU usage: compute from per-core idle vs total ticks
    let cpuUsage = null;
    try {
      const totalIdle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
      const totalTick = cpus.reduce(
        (sum, cpu) => sum + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq,
        0
      );
      cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);
    } catch { /* ignore */ }

    // Disk usage for root filesystem
    let disk = null;
    try {
      const stats = statfsSync('/');
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      disk = {
        total,
        free,
        used: total - free,
        usedPercent: Math.round(((total - free) / total) * 100),
      };
    } catch { /* ignore */ }

    // CPU temperature (Raspberry Pi: /sys/class/thermal/)
    let cpuTemp = null;
    try {
      const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
      cpuTemp = parseInt(raw) / 1000; // millidegrees → degrees C
    } catch { /* not a Pi or no thermal zone */ }

    // GPU temperature (Pi-specific, via vcgencmd)
    let gpuTemp = null;
    try {
      const raw = execFileSync('vcgencmd', ['measure_temp'], { encoding: 'utf-8' });
      const match = raw.match(/temp=([\d.]+)/);
      if (match) gpuTemp = parseFloat(match[1]);
    } catch { /* not a Pi */ }

    // Throttling status (Pi-specific)
    let throttled = null;
    try {
      const raw = execFileSync('vcgencmd', ['get_throttled'], { encoding: 'utf-8' });
      const match = raw.match(/throttled=(0x[0-9a-f]+)/i);
      if (match) {
        const bits = parseInt(match[1], 16);
        throttled = {
          raw: match[1],
          underVoltageNow: !!(bits & 0x1),
          frequencyCappedNow: !!(bits & 0x2),
          throttledNow: !!(bits & 0x4),
          underVoltageOccurred: !!(bits & 0x10000),
          frequencyCappedOccurred: !!(bits & 0x20000),
          throttledOccurred: !!(bits & 0x40000),
        };
      }
    } catch { /* not a Pi */ }

    // Fan speed (Raspberry Pi 5 active cooler)
    let fan = null;
    try {
      // hwmon index can vary; glob for the right path
      const { readdirSync } = await import('node:fs');
      const hwmonBase = '/sys/devices/platform/cooling_fan/hwmon';
      const hwmonDirs = readdirSync(hwmonBase);
      if (hwmonDirs.length > 0) {
        const rpm = parseInt(readFileSync(`${hwmonBase}/${hwmonDirs[0]}/fan1_input`, 'utf-8'));
        let dutyCycle = null;
        try {
          const cur = parseInt(readFileSync('/sys/devices/virtual/thermal/cooling_device0/cur_state', 'utf-8'));
          const max = parseInt(readFileSync('/sys/devices/virtual/thermal/cooling_device0/max_state', 'utf-8'));
          dutyCycle = max > 0 ? Math.round((cur / max) * 100) : null;
        } catch { /* cur_state not available */ }
        fan = { rpm, dutyCycle };
      }
    } catch { /* not a Pi 5 or no fan */ }

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: {
        system: Math.round(os.uptime()),
        process: Math.round(process.uptime()),
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || null,
        usagePercent: cpuUsage,
        loadAvg: {
          '1m': loadAvg[0],
          '5m': loadAvg[1],
          '15m': loadAvg[2],
        },
        temperature: cpuTemp,
        gpuTemperature: gpuTemp,
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usedPercent: Math.round((usedMem / totalMem) * 100),
      },
      disk,
      fan,
      throttled,
    };
  });
}
