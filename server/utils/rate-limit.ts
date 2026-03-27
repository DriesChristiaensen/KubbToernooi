const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

let store = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { attempts: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    return false;
  }

  entry.attempts++;
  return true;
}

export function resetRateLimitStore(): void {
  store = new Map();
}
