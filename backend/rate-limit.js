const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MIN_INTERVAL_MS = 2 * 1000;
const MAX_KEYS = 5000;

const hits = new Map();

export function rateLimit(key, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }

  if (recent.length > 0 && now - recent.at(-1) < MIN_INTERVAL_MS) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) prune(now);

  return true;
}

function prune(now) {
  for (const [key, times] of hits) {
    if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(key);
  }
}
