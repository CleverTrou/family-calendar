/**
 * Weather service using Open-Meteo API (free, no API key required).
 *
 * Fetches:
 * - Current conditions (temperature, weather code)
 * - 14-day daily forecast (high, low, weather code)
 *
 * WMO Weather Codes: https://open-meteo.com/en/docs#weathervariables
 */

import { config } from '../config.js';
import { loadSettings } from './settings.js';

let cachedWeather = null;
let lastFetchTime = null;
const CACHE_DURATION_MS = 30 * 60_000; // 30 minutes

/**
 * Map WMO weather codes (0–99) to { icon, label } for display.
 * Icons are Unicode symbols chosen for clarity on low-res screens.
 */
const WMO_CODES = {
  0:  { icon: '☀️', label: 'Clear' },
  1:  { icon: '🌤', label: 'Mostly clear' },
  2:  { icon: '⛅', label: 'Partly cloudy' },
  3:  { icon: '☁️', label: 'Overcast' },
  45: { icon: '🌫', label: 'Fog' },
  48: { icon: '🌫', label: 'Rime fog' },
  51: { icon: '🌦', label: 'Light drizzle' },
  53: { icon: '🌦', label: 'Drizzle' },
  55: { icon: '🌧', label: 'Heavy drizzle' },
  56: { icon: '🌧', label: 'Freezing drizzle' },
  57: { icon: '🌧', label: 'Heavy freezing drizzle' },
  61: { icon: '🌧', label: 'Light rain' },
  63: { icon: '🌧', label: 'Rain' },
  65: { icon: '🌧', label: 'Heavy rain' },
  66: { icon: '🌧', label: 'Freezing rain' },
  67: { icon: '🌧', label: 'Heavy freezing rain' },
  71: { icon: '🌨', label: 'Light snow' },
  73: { icon: '🌨', label: 'Snow' },
  75: { icon: '❄️', label: 'Heavy snow' },
  77: { icon: '🌨', label: 'Snow grains' },
  80: { icon: '🌦', label: 'Light showers' },
  81: { icon: '🌧', label: 'Showers' },
  82: { icon: '🌧', label: 'Heavy showers' },
  85: { icon: '🌨', label: 'Light snow showers' },
  86: { icon: '❄️', label: 'Heavy snow showers' },
  95: { icon: '⛈', label: 'Thunderstorm' },
  96: { icon: '⛈', label: 'Thunderstorm w/ hail' },
  99: { icon: '⛈', label: 'Thunderstorm w/ heavy hail' },
};

function decodeWeatherCode(code) {
  return WMO_CODES[code] || { icon: '🌡', label: 'Unknown' };
}

/**
 * Fetch weather from Open-Meteo.
 * Returns { current, daily[] } or null if location not configured.
 */
/**
 * Resolve weather location: settings.json takes priority, .env is fallback.
 */
function getWeatherLocation() {
  const settings = loadSettings();
  const sLat = settings.weather && settings.weather.lat;
  const sLon = settings.weather && settings.weather.lon;
  if (sLat && sLon) return { lat: sLat, lon: sLon };
  // Fall back to .env
  return { lat: config.weather.lat, lon: config.weather.lon };
}

export async function fetchWeather() {
  const { lat, lon } = getWeatherLocation();
  if (!lat || !lon) return null;

  // Use cache if still fresh
  if (cachedWeather && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION_MS) {
    return cachedWeather;
  }

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code',
      temperature_unit: 'fahrenheit',
      timezone: config.timezone,
      forecast_days: '14',
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();

    const current = {
      temp: Math.round(data.current.temperature_2m),
      ...decodeWeatherCode(data.current.weather_code),
    };

    const daily = data.daily.time.map((date, i) => ({
      date, // "YYYY-MM-DD"
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      ...decodeWeatherCode(data.daily.weather_code[i]),
    }));

    cachedWeather = { current, daily };
    lastFetchTime = Date.now();

    console.log(`[Weather] Updated: ${current.temp}°F ${current.label}, ${daily.length}-day forecast`);
    return cachedWeather;
  } catch (err) {
    console.error('[Weather] Fetch failed:', err.message);
    // Return stale cache if available
    return cachedWeather;
  }
}

/**
 * Return the cached weather data (for inclusion in API responses).
 */
export function getCachedWeather() {
  return cachedWeather;
}
