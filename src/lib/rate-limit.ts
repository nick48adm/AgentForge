/**
 * rate-limit.ts
 * In-process sliding window rate limiter.
 * Keyed by userId or IP. No Redis needed — works per-process.
 * For multi-instance deployments, swap with @upstash/ratelimit.
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Clean up old entries every 5 minutes to prevent memory leak
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

// Allow the process to exit even with the interval running
if (cleanupInterval.unref) cleanupInterval.unref()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * @param key      unique identifier (userId, IP, etc.)
 * @param limit    max requests per window
 * @param windowMs window size in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  let win = store.get(key)

  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + windowMs }
    store.set(key, win)
  }

  win.count++
  const allowed = win.count <= limit
  const remaining = Math.max(0, limit - win.count)

  return { allowed, remaining, resetAt: win.resetAt }
}

/** Per-user chat: 30 req/min */
export function chatLimit(userId: string) {
  return rateLimit(`chat:${userId}`, 30, 60_000)
}

/** Auth endpoints: 10 req/15min per IP */
export function authLimit(ip: string) {
  return rateLimit(`auth:${ip}`, 10, 15 * 60_000)
}

/** Admin endpoints: 60 req/min per user */
export function adminLimit(userId: string) {
  return rateLimit(`admin:${userId}`, 60, 60_000)
}

/** Widget public endpoints: 20 req/min per IP */
export function widgetLimit(ip: string) {
  return rateLimit(`widget:${ip}`, 20, 60_000)
}
