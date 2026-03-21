/**
 * Simple in-memory TTL cache for API responses.
 * Keeps page switches instant by serving stale data while the network catches up.
 */

const store = new Map();

// How long to cache each endpoint (ms)
const TTL_MAP = {
  '/leads':        30_000,   // 30s — changes from incoming calls
  '/appointments': 60_000,   // 60s
  '/staff':       300_000,   // 5 min — rarely changes
  '/knowledge':   300_000,   // 5 min
  '/firms':       300_000,   // 5 min
  '/templates':   300_000,   // 5 min
  '/settings':     60_000,   // 60s
};

// Which cache keys to invalidate when a path is mutated
const INVALIDATE_MAP = {
  '/leads':        ['/leads'],
  '/appointments': ['/appointments'],
  '/staff':        ['/staff'],
  '/knowledge':    ['/knowledge'],
  '/firms':        ['/firms'],
  '/templates':    ['/templates'],
  '/settings':     ['/settings'],
};

export function getTTL(path) {
  for (const [prefix, ttl] of Object.entries(TTL_MAP)) {
    if (path.startsWith(prefix)) return ttl;
  }
  return 0; // don't cache
}

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data, ttlMs) {
  if (!ttlMs) return;
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateByPath(mutatedPath) {
  for (const [prefix, keys] of Object.entries(INVALIDATE_MAP)) {
    if (mutatedPath.startsWith(prefix)) {
      for (const key of store.keys()) {
        if (keys.some(k => key.includes(k))) store.delete(key);
      }
    }
  }
}

export function clearAll() {
  store.clear();
}
