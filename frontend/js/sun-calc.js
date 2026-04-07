/**
 * Sunrise/sunset calculator using the NOAA solar position algorithm.
 * Accurate to ~1 minute at latitudes between ±72°.
 *
 * Reference: NOAA Solar Calculations spreadsheet
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 */

/**
 * Calculate sunrise and sunset times for a given location and date.
 * @param {number} lat  - Latitude in decimal degrees (positive = N)
 * @param {number} lon  - Longitude in decimal degrees (positive = E)
 * @param {Date}   date - The date to calculate for
 * @returns {{ sunrise: number, sunset: number } | null}
 *   sunrise/sunset as hours in UTC (e.g. 12.5 = 12:30 UTC), or null for polar day/night
 */
function getSunTimes(lat, lon, date) {
  var rad = Math.PI / 180;

  // Day of year (1-365)
  var start = new Date(date.getFullYear(), 0, 0);
  var dayOfYear = Math.floor((date - start) / 86400000);

  // Fractional year (gamma) in radians
  var gamma = (2 * Math.PI / 365) * (dayOfYear - 1);

  // Equation of time (minutes) — corrects for orbital eccentricity and axial tilt
  var eqTime = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );

  // Solar declination (radians)
  var decl = 0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.00148  * Math.sin(3 * gamma);

  // Hour angle for official sunrise/sunset (zenith = 90.833°, accounts for refraction)
  var cosHA = (
    Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)
  ) / (
    Math.cos(lat * rad) * Math.cos(decl)
  );

  // Polar day (midnight sun) or polar night — no sunrise/sunset
  if (cosHA > 1 || cosHA < -1) return null;

  var ha = Math.acos(cosHA) / rad; // degrees

  // Sunrise and sunset in minutes from midnight UTC
  var sunriseMin = 720 - 4 * (lon + ha) - eqTime;
  var sunsetMin  = 720 - 4 * (lon - ha) - eqTime;

  return {
    sunrise: sunriseMin / 60, // decimal hours UTC
    sunset:  sunsetMin  / 60,
  };
}

/**
 * Check whether it should be dark right now based on sunrise/sunset.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} true if currently between sunset and sunrise (dark)
 */
function isSunDark(lat, lon) {
  var now = new Date();
  var times = getSunTimes(lat, lon, now);

  // If no sunrise/sunset (polar), use declination to guess:
  // positive declination + northern hemisphere = midnight sun (light)
  if (!times) {
    var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    var gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
    var decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma);
    return (lat > 0) ? (decl < 0) : (decl > 0);
  }

  // Current time as decimal hours UTC
  var nowUTC = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  return nowUTC < times.sunrise || nowUTC > times.sunset;
}

/**
 * Get formatted sunrise/sunset times for display (in browser's local time).
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} [tz] - Optional IANA timezone (e.g. "America/New_York")
 * @returns {{ sunrise: string, sunset: string } | null}
 */
function getFormattedSunTimes(lat, lon, tz) {
  var now = new Date();
  var times = getSunTimes(lat, lon, now);
  if (!times) return null;

  function utcDecimalToDate(decimalHoursUTC) {
    var d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMinutes(Math.round(decimalHoursUTC * 60));
    return d;
  }

  var opts = { hour: 'numeric', minute: '2-digit', hour12: true };
  if (tz) opts.timeZone = tz;

  var fmt = new Intl.DateTimeFormat('en-US', opts);

  return {
    sunrise: fmt.format(utcDecimalToDate(times.sunrise)),
    sunset:  fmt.format(utcDecimalToDate(times.sunset)),
  };
}
