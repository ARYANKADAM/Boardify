// Lightweight ESM logger for API routes. Uses console and optional Sentry if available.
const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentryPromise = null;

function ensureSentry() {
  if (!SENTRY_DSN) return null;
  if (!sentryPromise) {
    sentryPromise = import('@sentry/node').then(Sentry => {
      try { Sentry.init({ dsn: SENTRY_DSN }); } catch (e) {}
      return Sentry;
    }).catch(() => null);
  }
  return sentryPromise;
}

export function info(...args) { console.log(...args); }
export function warn(...args) { console.warn(...args); }
export async function error(err, ...args) {
  console.error(err, ...args);
  const Sentry = await ensureSentry();
  if (Sentry && err) {
    try { Sentry.captureException(err); } catch (e) {}
  }
}

export default { info, warn, error };
