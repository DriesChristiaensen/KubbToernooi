const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

let store = new Map<string, RateLimitEntry>();

/**
 * Check if an IP has exceeded the login rate limit (5 attempts per 15 minutes).
 * Increments attempt counter on each call; resets after window expires.
 * @param {string} ip - IP address to check
 * @returns {boolean} True if within limit, false if exceeded
 */
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

/**
 * Clear rate-limit counter for a specific IP (called after successful login).
 * @param {string} ip - IP address to reset
 */
export function resetRateLimitForIp(ip: string): void {
  store.delete(ip);
}

/**
 * Clear all rate-limit counters (admin operation via /api/auth/reset-rate-limit).
 */
export function resetRateLimitStore(): void {
  store = new Map();
}
