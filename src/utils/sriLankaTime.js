const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function colomboParts(date) {
  const shifted = new Date(date.getTime() + COLOMBO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours() + shifted.getUTCMinutes() / 60
  };
}

function startOfColomboDay(date = new Date()) {
  const parts = colomboParts(date);
  return new Date(Date.UTC(parts.year, parts.month, parts.day) - COLOMBO_OFFSET_MS);
}

function colomboHourDecimal(date) {
  return colomboParts(date).hour;
}

module.exports = { COLOMBO_OFFSET_MS, colomboParts, startOfColomboDay, colomboHourDecimal };
