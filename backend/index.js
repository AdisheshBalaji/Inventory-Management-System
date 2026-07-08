import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiLimiter } from './middleware/rateLimit.js';

import authRoutes            from './routes/auth.js';
import { orderRouter,
         customerRouter }    from './routes/orders.js';
import stockRoutes           from './routes/stocks.js';
import productRoutes         from './routes/products.js';
import warehouseRoutes       from './routes/warehouses.js';

dotenv.config();

const app = express();

// ─────────────────────────────────────────────
// GLOBAL MIDDLEWARE
// ─────────────────────────────────────────────

app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Apply general rate limit to all /api/* routes
app.use('/api', apiLimiter);

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

app.use('/api',                    authRoutes);       // POST /api/register, /api/login, /api/logout, etc.
app.use('/api/orders',             orderRouter);      // POST/GET /api/orders/*
app.use('/api/stocks',             stockRoutes);      // GET/POST /api/stocks/*
app.use('/api/products',           productRoutes);    // GET /api/products/*
app.use('/api',                    warehouseRoutes);  // GET /api/warehouses, /api/warehouse/:id
app.use('/api/customers/:customerId', customerRouter);// GET /api/customers/:customerId/orders

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});
