import rateLimit from 'express-rate-limit';


// Rate limiting on authentication
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,    // 15 minutes
    max: 10,
    standardHeaders: true,        // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    message: { message: 'Too many attempts from this IP. Please try again in 15 minutes.' }
});


// General rate limiter on all api requests
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP. Please slow down.' }
});

// JWT blacklist in memory
// JWT Blacklist
export const tokenBlacklist = new Map();

// Sweep expired entries every 15 minutes so the Map doesn't grow forever
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of tokenBlacklist) {
        if (exp <= now) tokenBlacklist.delete(jti);
    }
}, 15 * 60 * 1000);
