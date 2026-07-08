import jwt from 'jsonwebtoken';
import { tokenBlacklist } from './rateLimit.js';


/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 * Also rejects tokens whose jti has been blacklisted
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Reject if this token has been explicitly revoked via logout
        if (decoded.jti && tokenBlacklist.has(decoded.jti)) {
            return res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}


// Middleware factory — ensures the authenticated user has the expected role.
export function requireRole(role) {
    return (req, res, next) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }
        next();
    };
}
