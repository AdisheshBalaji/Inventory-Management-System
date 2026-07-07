import rateLimit from 'express-rate-limit';

// ─────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────

/**
 * Strict limiter for authentication endpoints.
 * 10 attempts per 15 minutes per IP — blocks brute-force login attacks.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,    // 15 minutes
    max: 10,
    standardHeaders: true,        // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    message: { message: 'Too many attempts from this IP. Please try again in 15 minutes.' }
});

/**
 * General limiter for all other API routes.
 * 200 requests per 15 minutes per IP — prevents API abuse.
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP. Please slow down.' }
});

// ─────────────────────────────────────────────
// JWT BLACKLIST  (in-memory)
// ─────────────────────────────────────────────

/**
 * Maps jti → expiry unix-timestamp (seconds).
 * Tokens added here are rejected by authenticateToken even if cryptographically valid.
 * Entries are cleaned up automatically once they've expired.
 */
export const tokenBlacklist = new Map();

// Sweep expired entries every 15 minutes so the Map doesn't grow forever
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of tokenBlacklist) {
        if (exp <= now) tokenBlacklist.delete(jti);
    }
}, 15 * 60 * 1000);
