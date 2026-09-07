// Lets a page keep working with no signal: a write is tried immediately, and only
// dropped into a locally-persisted queue if it actually fails to reach the network
// (not for a real validation/permission error, which surfaces to the user as normal).
// Queued writes are retried automatically once a connection is back. Every write here
// is an upsert/delete keyed on stable columns (never a bare insert of "the next row"),
// so replaying one twice, or out of order relative to a different hole/match, is safe —
// last write wins, which is fine since each match only ever has one scorer.

const QUEUE_KEY = 'lads26_pending_writes';
const RETRY_INTERVAL_MS = 15000;

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full/unavailable — the queue still lives in memory for this session.
  }
}

let queue = loadQueue();
let flushing = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(queue.length));
}

// fn(pendingCount) is called immediately and again whenever the queue changes.
// Returns an unsubscribe function.
export function onQueueChange(fn) {
  listeners.add(fn);
  fn(queue.length);
  return () => listeners.delete(fn);
}

export function pendingCount() {
  return queue.length;
}

function isNetworkError(err) {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String(err.message ?? err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('internet connection') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  );
}

function runWrite(supabase, action) {
  const { table, op, rows, match, onConflict } = action;
  const base = supabase.from(table);
  if (op === 'upsert') return base.upsert(rows, onConflict ? { onConflict } : undefined);
  if (op === 'insert') return base.insert(rows);
  if (op === 'delete') {
    let q = base.delete();
    for (const [col, val] of Object.entries(match)) {
      q = Array.isArray(val) ? q.in(col, val) : q.eq(col, val);
    }
    return q;
  }
  throw new Error(`Unknown offline-queue op "${op}"`);
}

// Attempts the write now. If it fails for a real (non-network) reason, resolves with
// { ok: false, error } so the caller can show it. If it fails because there's no
// connection, it's queued for later and this still resolves { ok: true, queued: true }
// so the caller can update local UI state optimistically.
export async function queueWrite(supabase, action) {
  try {
    const { error } = await runWrite(supabase, action);
    if (!error) return { ok: true };
    if (!isNetworkError(error)) return { ok: false, error };
  } catch (err) {
    if (!isNetworkError(err)) return { ok: false, error: err };
  }

  queue.push({ ...action, queuedAt: Date.now() });
  saveQueue(queue);
  notify();
  return { ok: true, queued: true };
}

// Replays queued writes in order, oldest first. Stops at the first one that's still
// unreachable (leaving it and everything after it queued) rather than reordering.
export async function flushQueue(supabase) {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      let stop = false;
      try {
        const { error } = await runWrite(supabase, queue[0]);
        if (error && isNetworkError(error)) stop = true;
        // A non-network error on replay isn't recoverable by resending the same
        // payload, so it's dropped rather than blocking every write behind it.
      } catch (err) {
        if (isNetworkError(err)) stop = true;
      }
      if (stop) break;
      queue.shift();
      saveQueue(queue);
      notify();
    }
  } finally {
    flushing = false;
  }
}

// Call once per page: retries the queue whenever the browser regains connectivity,
// and on a periodic timer as a fallback (the 'online' event doesn't reliably fire on
// mobile Safari, e.g. after Airplane Mode is toggled off).
export function initAutoSync(supabase) {
  window.addEventListener('online', () => flushQueue(supabase));
  setInterval(() => flushQueue(supabase), RETRY_INTERVAL_MS);
  flushQueue(supabase);
}
