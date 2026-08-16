import { adminDb } from './firebaseAdmin';
import logger from './logger';

// Drop-in replacement for the old socket-server /broadcast fetch call.
// Same signature/shape as before: event name, boardId, and a data payload.
export async function broadcast({ event, boardId, data }) {
  if (!boardId) return; // events without a boardId (rare) are skipped — RTDB events are per-board
  try {
    const ref = adminDb.ref(`boards/${boardId}/events`).push();
    await ref.set({
      event,
      data,
      timestamp: Date.now(),
    });
    // prune events older than 5 min so the node doesn't grow forever
    pruneOldEvents(boardId).catch(e => logger.error(e, 'prune failed'));
  } catch (err) {
    logger.error(err, 'firebase broadcast failed');
  }
}

async function pruneOldEvents(boardId) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  const ref = adminDb.ref(`boards/${boardId}/events`);
  const snap = await ref.orderByChild('timestamp').endAt(cutoff).once('value');
  const updates = {};
  snap.forEach(child => { updates[child.key] = null; });
  if (Object.keys(updates).length) await ref.update(updates);
}

// For user-scoped events (like notifications), separate from board events
export async function broadcastToUser({ event, userId, data }) {
  if (!userId) return;
  try {
    const ref = adminDb.ref(`notifications/${userId}/events`).push();
    await ref.set({
      event,
      data,
      timestamp: Date.now(),
    });
    pruneOldUserEvents(userId).catch(e => logger.error(e, 'prune failed'));
  } catch (err) {
    logger.error(err, 'firebase broadcastToUser failed');
  }
}

async function pruneOldUserEvents(userId) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  const ref = adminDb.ref(`notifications/${userId}/events`);
  const snap = await ref.orderByChild('timestamp').endAt(cutoff).once('value');
  const updates = {};
  snap.forEach(child => { updates[child.key] = null; });
  if (Object.keys(updates).length) await ref.update(updates);
}