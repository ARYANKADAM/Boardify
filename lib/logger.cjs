const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
let Sentry = null;
if (SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: SENTRY_DSN });
  } catch (e) {
    // optional dependency not installed — fall back to console
    console.warn('Sentry not available:', e && e.message);
  }
}

function info(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

function error(err, ...args) {
  console.error(err, ...args);
  if (Sentry && err) {
    try { Sentry.captureException(err); } catch (e) { /* ignore */ }
  }
}

module.exports = { info, warn, error };
