/**
 * Server-side data cache.
 *
 * WHY: Every Supabase query takes ~400ms (network round-trip to Mumbai).
 * Most data (leads, staff, appointments) doesn't change every second.
 * So we cache query results in server memory (RAM) for a short time.
 *
 * HOW: Simple Map with TTL (time-to-live) per entry.
 * - Key: a string like "leads:firmId" or "staff:firmId"
 * - Value: { data, expires } where expires is a timestamp
 *
 * WHEN TO INVALIDATE: When data changes (POST/PATCH/DELETE),
 * we clear the cache for that data type so the next GET fetches fresh data.
 */

const cache = new Map();

// How long each data type stays cached (in milliseconds)
const TTL = {
  leads:        30_000,   // 30 seconds — changes from incoming calls
  appointments: 60_000,   // 60 seconds — less frequent changes
  staff:       300_000,   // 5 minutes — rarely changes
  firm:        300_000,   // 5 minutes — admin changes only
  messages:     15_000,   // 15 seconds — active conversations
};

/**
 * Get cached data.
 * @param {string} type - 'leads', 'appointments', 'staff', etc.
 * @param {string} scope - Usually firmId, makes cache firm-specific
 * @returns {any|null} - Cached data or null if expired/missing
 */
function get(type, scope = 'global') {
  const key = `${type}:${scope}`;
  const entry = cache.get(key);

  if (!entry) return null;

  // Check if expired
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store data in cache.
 * @param {string} type - 'leads', 'appointments', etc.
 * @param {string} scope - Usually firmId
 * @param {any} data - The query result to cache
 */
function set(type, scope = 'global', data) {
  const key = `${type}:${scope}`;
  const ttl = TTL[type] || 30_000;

  cache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

/**
 * Invalidate (clear) cache for a data type.
 * Called after POST/PATCH/DELETE operations.
 * @param {string} type - 'leads', 'appointments', etc.
 * @param {string} scope - Usually firmId. If omitted, clears ALL scopes for that type.
 */
function invalidate(type, scope) {
  if (scope) {
    // Clear specific scope
    cache.delete(`${type}:${scope}`);
  } else {
    // Clear ALL entries for this type (all firms)
    for (const key of cache.keys()) {
      if (key.startsWith(`${type}:`)) cache.delete(key);
    }
  }
}

/**
 * Clear everything. Used on server restart or major changes.
 */
function clearAll() {
  cache.clear();
}

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (now > val.expires) cache.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { get, set, invalidate, clearAll };
