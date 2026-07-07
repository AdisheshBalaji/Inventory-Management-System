import { Router } from 'express';
import { register, login, customerLogin, logout } from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Employee registration
router.post('/register', authLimiter, register);

// Employee login — issues a JWT
router.post('/login', authLimiter, login);

// Customer login — issues a JWT
router.post('/customer-login', authLimiter, customerLogin);

// Logout — revoke the current token (works for both employee and customer tokens)
router.post('/logout', authenticateToken, logout);

export default router;
