import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────

// Only allow requests from the configured frontend origin.
// Set FRONTEND_URL in .env (e.g. http://localhost:5173 for dev,
// https://your-app.vercel.app for production).
app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// ─────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────

/**
 * Strict limiter for authentication endpoints.
 * 10 attempts per 15 minutes per IP — blocks brute-force login attacks.
 */
const authLimiter = rateLimit({
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
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP. Please slow down.' }
});

// Apply general limiter to all /api/* routes
app.use('/api', apiLimiter);

// ─────────────────────────────────────────────
// JWT BLACKLIST  (in-memory)
// ─────────────────────────────────────────────

/**
 * Maps jti → expiry unix-timestamp (seconds).
 * Tokens added here are rejected by authenticateToken even if cryptographically valid.
 * Entries are cleaned up automatically once they've expired.
 */
const tokenBlacklist = new Map();

// Sweep expired entries every 15 minutes so the Map doesn't grow forever
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of tokenBlacklist) {
        if (exp <= now) tokenBlacklist.delete(jti);
    }
}, 15 * 60 * 1000);

// ─────────────────────────────────────────────
// JWT MIDDLEWARE
// ─────────────────────────────────────────────

/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 * Also rejects tokens whose jti has been blacklisted (i.e. logged out).
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

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

/**
 * Middleware factory — ensures the authenticated user has the expected role.
 */
function requireRole(role) {
    return (req, res, next) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }
        next();
    };
}

// ─────────────────────────────────────────────
// AUTH  (public — no token required)
// ─────────────────────────────────────────────

// Employee registration
app.post('/api/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password, warehouse_id, position } = req.body;

        if (!username || !email || !password || !warehouse_id || !position) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO employee (name, email, password_hash, warehouse_id, position) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, warehouse_id, position]
        );

        res.status(201).json({ message: 'Employee registered successfully' });

    } catch (err) {
        console.error('DB Error: ', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: 'Registration failed' });
    }
});

// Employee login — issues a JWT
app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const [rows] = await pool.query('SELECT * FROM employee WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const employee = rows[0];
        const isPasswordValid = await bcrypt.compare(password, employee.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = {
            jti:          randomUUID(),          // unique token ID — used for blacklisting on logout
            id:           employee.employee_id,
            name:         employee.name,
            email:        employee.email,
            warehouse_id: employee.warehouse_id,
            position:     employee.position,
            role:         'employee'
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            employee: {
                id:           employee.employee_id,
                name:         employee.name,
                email:        employee.email,
                warehouse_id: employee.warehouse_id,
                position:     employee.position
            }
        });
    } catch (err) {
        console.log('Database error: ', err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Customer login — issues a JWT
app.post('/api/customer-login/', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Please enter email' });
        }

        const [rows] = await pool.query('SELECT * FROM customer WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: "Customer doesn't exist" });
        }

        const customer = rows[0];

        const payload = {
            jti:   randomUUID(),          // unique token ID — used for blacklisting on logout
            id:    customer.customer_id,
            name:  customer.name,
            email: customer.email,
            role:  'customer'
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            customer: {
                id:    customer.customer_id,
                name:  customer.name,
                email: customer.email
            }
        });
    } catch (err) {
        console.log('Database Error: ', err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Logout — revoke the current token by adding its jti to the blacklist
// Works for both employee and customer tokens.
app.post('/api/logout', authenticateToken, (req, res) => {
    const { jti, exp } = req.user;

    if (jti && exp) {
        const now = Math.floor(Date.now() / 1000);
        const remainingTTL = exp - now;
        if (remainingTTL > 0) {
            // Store until the token would have naturally expired
            tokenBlacklist.set(jti, exp);
        }
    }

    res.status(200).json({ message: 'Logged out successfully' });
});

// ─────────────────────────────────────────────
// WAREHOUSES  (public)
// ─────────────────────────────────────────────

// Get all warehouses
app.get('/api/warehouses', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT warehouse_id, name, location FROM warehouse');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get warehouse by id  (employee only)
app.get('/api/warehouse/:id', authenticateToken, requireRole('employee'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT warehouse_id, name, location FROM warehouse WHERE warehouse_id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Warehouse not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// STOCK  (employee only)
// ─────────────────────────────────────────────

// Get stock for a warehouse
app.get('/api/stocks/:warehouseId', authenticateToken, requireRole('employee'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.stock_id,
                s.product_id,
                p.name AS product_name,
                p.unit_price,
                s.quantity,
                s.reserved_quantity
            FROM stock s
            JOIN product p ON s.product_id = p.product_id
            WHERE s.warehouse_id = ?
        `, [req.params.warehouseId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database Failure' });
    }
});

// Adjust stock for a product in a warehouse (employee — own warehouse only)
// Body: { product_id, quantity, type: 'IN' | 'OUT' }
// Effect:
//   IN  → stock.quantity += qty  (receiving new goods)
//   OUT → stock.quantity -= qty  (writing off / damage / manual correction)
//         OUT is blocked if it would push quantity below reserved_quantity
// Every adjustment is recorded in stock_transactions as an audit trail.
app.post('/api/stocks/:warehouseId/adjust', authenticateToken, requireRole('employee'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const warehouseId     = parseInt(req.params.warehouseId, 10);
        const employeeWHId    = req.user.warehouse_id;       // from JWT
        const employeeId      = req.user.id;                 // from JWT

        // Scope check — employee may only adjust their own warehouse
        if (warehouseId !== employeeWHId) {
            await connection.rollback();
            return res.status(403).json({ message: 'You are not authorised to adjust stock in another warehouse' });
        }

        const { product_id, quantity, type } = req.body;

        if (!product_id || !quantity || !type) {
            await connection.rollback();
            return res.status(400).json({ message: 'product_id, quantity, and type are required' });
        }

        if (!['IN', 'OUT'].includes(type)) {
            await connection.rollback();
            return res.status(400).json({ message: "type must be 'IN' or 'OUT'" });
        }

        const qty = parseInt(quantity, 10);
        if (!Number.isInteger(qty) || qty <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'quantity must be a positive integer' });
        }

        // Fetch the current stock row
        const [stockRows] = await connection.query(
            'SELECT * FROM stock WHERE product_id = ? AND warehouse_id = ?',
            [product_id, warehouseId]
        );

        if (stockRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'No stock record found for this product in your warehouse' });
        }

        const stock = stockRows[0];

        if (type === 'OUT') {
            // Cannot remove more than what is available (quantity - reserved_quantity)
            const available = stock.quantity - stock.reserved_quantity;
            if (qty > available) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Cannot remove ${qty} units — only ${available} units are available (${stock.reserved_quantity} are reserved)`
                });
            }
        }

        // Apply the stock adjustment
        const delta = type === 'IN' ? qty : -qty;
        await connection.query(
            'UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
            [delta, product_id, warehouseId]
        );

        // Write audit record to stock_transactions
        await connection.query(
            `INSERT INTO stock_transactions (product_id, created_by, warehouse_id, quantity, type)
             VALUES (?, ?, ?, ?, ?)`,
            [product_id, employeeId, warehouseId, qty, type]
        );

        await connection.commit();

        const newQuantity = stock.quantity + delta;
        res.status(200).json({
            message: `Stock ${type === 'IN' ? 'increased' : 'decreased'} successfully`,
            product_id,
            warehouse_id:    warehouseId,
            adjustment:      type === 'IN' ? `+${qty}` : `-${qty}`,
            new_quantity:    newQuantity
        });

    } catch (err) {
        await connection.rollback();
        console.error('Stock adjustment error:', err);
        res.status(500).json({ message: err.message || 'Stock adjustment failed' });
    } finally {
        connection.release();
    }
});

// Get stock transaction history for a warehouse (employee — own warehouse only)
// Returns all IN/OUT adjustments with product name and the employee who made the change.
app.get('/api/stocks/:warehouseId/transactions', authenticateToken, requireRole('employee'), async (req, res) => {
    try {
        const warehouseId  = parseInt(req.params.warehouseId, 10);
        const employeeWHId = req.user.warehouse_id; // from JWT

        // Scope check
        if (warehouseId !== employeeWHId) {
            return res.status(403).json({ message: 'You are not authorised to view transactions for another warehouse' });
        }

        const [rows] = await pool.query(`
            SELECT
                st.transaction_id,
                st.type,
                st.quantity,
                st.created_at,
                p.product_id,
                p.name        AS product_name,
                p.unit_price,
                e.employee_id AS created_by_id,
                e.name        AS created_by_name,
                e.position    AS created_by_position
            FROM stock_transactions st
            JOIN product  p ON st.product_id  = p.product_id
            JOIN employee e ON st.created_by  = e.employee_id
            WHERE st.warehouse_id = ?
            ORDER BY st.created_at DESC
        `, [warehouseId]);

        res.json(rows);
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ message: 'Failed to fetch transactions' });
    }
});

// ─────────────────────────────────────────────
// PRODUCTS  (public)
// ─────────────────────────────────────────────

// Get all available products (deduplicated across warehouses)
// Groups by name+price so each product appears once with total available quantity.
app.get('/api/products/available', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                MIN(p.product_id) AS product_id,
                p.name,
                p.unit_price,
                SUM(s.quantity - s.reserved_quantity) AS available_quantity
            FROM product p
            JOIN stock s ON p.product_id = s.product_id
            WHERE (s.quantity - s.reserved_quantity) > 0
            GROUP BY p.name, p.unit_price
            ORDER BY p.name
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get product by ID with available quantity  (public)
app.get('/api/products/:productId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.product_id,
                p.name,
                p.unit_price,
                SUM(s.quantity - s.reserved_quantity) AS available_quantity
            FROM product p
            JOIN stock s ON p.product_id = s.product_id
            WHERE p.product_id = ?
            GROUP BY p.product_id, p.name, p.unit_price
        `, [req.params.productId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// ORDERS — CUSTOMER  (customer only)
// ─────────────────────────────────────────────

// Helper: derive overall order status from item statuses
function deriveOrderStatus(itemStatuses) {
    if (itemStatuses.every(s => s === 'FULFILLED')) return 'FULFILLED';
    if (itemStatuses.every(s => s === 'REJECTED'))  return 'REJECTED';
    if (itemStatuses.every(s => s === 'PENDING'))   return 'PENDING';
    return 'PARTIALLY_FULFILLED';
}

// Create an order
// Routing: each product is assigned to the warehouse with the highest available
// stock for that product name that can fulfil the requested quantity.
app.post('/api/orders', authenticateToken, requireRole('customer'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { customer_id, items } = req.body;
        // items = [{ product_id, quantity }, ...]

        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({ message: 'Invalid order data' });
        }

        let totalPrice = 0;
        const orderItems = [];

        for (const item of items) {
            // Find the warehouse with the most available stock for this product name
            // that can satisfy the requested quantity.
            const [stockOptions] = await connection.query(`
                SELECT
                    p.product_id,
                    p.name,
                    p.unit_price,
                    s.warehouse_id,
                    (s.quantity - s.reserved_quantity) AS available_quantity
                FROM product p
                JOIN stock s ON p.product_id = s.product_id
                WHERE p.name = (SELECT name FROM product WHERE product_id = ?)
                  AND (s.quantity - s.reserved_quantity) >= ?
                ORDER BY available_quantity DESC
                LIMIT 1
            `, [item.product_id, item.quantity]);

            if (stockOptions.length === 0) {
                throw new Error(
                    `Insufficient stock for product. Requested: ${item.quantity}`
                );
            }

            const chosen = stockOptions[0];
            totalPrice += chosen.unit_price * item.quantity;
            orderItems.push({
                product_id:   chosen.product_id,
                quantity:     item.quantity,
                unit_price:   chosen.unit_price,
                warehouse_id: chosen.warehouse_id
            });
        }

        // Create sales order
        const [orderResult] = await connection.query(
            'INSERT INTO sales_orders (customer_id, total_price, status) VALUES (?, ?, ?)',
            [customer_id, totalPrice, 'PENDING']
        );
        const orderId = orderResult.insertId;

        // Create order items and reserve stock
        for (const item of orderItems) {
            await connection.query(
                `INSERT INTO sales_order_items
                    (order_id, product_id, quantity, unit_price, warehouse_id, status)
                 VALUES (?, ?, ?, ?, ?, 'PENDING')`,
                [orderId, item.product_id, item.quantity, item.unit_price, item.warehouse_id]
            );

            await connection.query(
                'UPDATE stock SET reserved_quantity = reserved_quantity + ? WHERE product_id = ? AND warehouse_id = ?',
                [item.quantity, item.product_id, item.warehouse_id]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: 'Order placed successfully',
            orderId,
            totalPrice
        });

    } catch (err) {
        await connection.rollback();
        console.error('Order creation error:', err);
        res.status(400).json({ message: err.message || 'Order failed' });
    } finally {
        connection.release();
    }
});

// Get order details (with derived overall status)
app.get('/api/orders/:orderId', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                so.order_id,
                so.customer_id,
                so.total_price,
                so.created_at,
                soi.item_id,
                soi.product_id,
                p.name         AS product_name,
                soi.quantity,
                soi.unit_price,
                (soi.quantity * soi.unit_price) AS item_total,
                soi.warehouse_id,
                w.name         AS warehouse_name,
                soi.status     AS item_status
            FROM sales_orders so
            JOIN sales_order_items soi ON so.order_id = soi.order_id
            JOIN product p             ON soi.product_id  = p.product_id
            JOIN warehouse w           ON soi.warehouse_id = w.warehouse_id
            WHERE so.order_id = ?
            ORDER BY soi.item_id
        `, [req.params.orderId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const overall_status = deriveOrderStatus(rows.map(r => r.item_status));
        res.json({ ...rows[0], overall_status, items: rows });
    } catch (err) {
        console.error('Error fetching order:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all orders for a customer
app.get('/api/customers/:customerId/orders', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                so.order_id,
                so.total_price,
                so.created_at,
                soi.item_id,
                p.name         AS product_name,
                soi.quantity,
                soi.unit_price,
                w.name         AS warehouse_name,
                w.location     AS warehouse_location,
                soi.status     AS item_status
            FROM sales_orders so
            JOIN sales_order_items soi ON so.order_id    = soi.order_id
            JOIN product p             ON soi.product_id  = p.product_id
            JOIN warehouse w           ON soi.warehouse_id = w.warehouse_id
            WHERE so.customer_id = ?
            ORDER BY so.created_at DESC, so.order_id DESC, soi.item_id
        `, [req.params.customerId]);

        if (rows.length === 0) {
            return res.json([]);
        }

        // Group flat rows into orders
        const ordersMap = new Map();
        for (const row of rows) {
            if (!ordersMap.has(row.order_id)) {
                ordersMap.set(row.order_id, {
                    order_id:    row.order_id,
                    total_price: row.total_price,
                    created_at:  row.created_at,
                    items: []
                });
            }
            ordersMap.get(row.order_id).items.push({
                item_id:            row.item_id,
                product_name:       row.product_name,
                quantity:           row.quantity,
                unit_price:         row.unit_price,
                warehouse_name:     row.warehouse_name,
                warehouse_location: row.warehouse_location,
                item_status:        row.item_status
            });
        }

        const orders = Array.from(ordersMap.values()).map(order => ({
            ...order,
            overall_status: deriveOrderStatus(order.items.map(i => i.item_status))
        }));

        res.json(orders);
    } catch (err) {
        console.error('Error fetching customer orders:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// ORDERS — EMPLOYEE ACTIONS  (employee only)
// ─────────────────────────────────────────────

// Get all PENDING items assigned to a warehouse (employee view)
app.get('/api/orders/warehouse/:warehouseId/pending', authenticateToken, requireRole('employee'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                soi.item_id,
                soi.order_id,
                soi.product_id,
                p.name         AS product_name,
                soi.quantity,
                soi.unit_price,
                soi.warehouse_id,
                soi.status     AS item_status,
                so.customer_id,
                c.name         AS customer_name,
                so.created_at
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.order_id    = so.order_id
            JOIN product p       ON soi.product_id  = p.product_id
            JOIN customer c      ON so.customer_id  = c.customer_id
            WHERE soi.warehouse_id = ?
              AND soi.status = 'PENDING'
            ORDER BY so.created_at ASC
        `, [req.params.warehouseId]);

        res.json(rows);
    } catch (err) {
        console.error('Error fetching pending orders:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fulfill an order item (employee)
// Effect: stock.quantity -= qty, stock.reserved_quantity -= qty, item.status = FULFILLED
// Warehouse scope is taken from the verified JWT — no longer supplied by the client.
app.patch('/api/orders/items/:itemId/fulfill', authenticateToken, requireRole('employee'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const itemId = req.params.itemId;
        const employeeWarehouseId = req.user.warehouse_id; // from JWT

        const [items] = await connection.query(
            'SELECT * FROM sales_order_items WHERE item_id = ?',
            [itemId]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Order item not found' });
        }

        const item = items[0];

        // Scope check — employee can only act on their own warehouse
        if (item.warehouse_id !== employeeWarehouseId) {
            await connection.rollback();
            return res.status(403).json({ message: 'You are not authorised to fulfil items from another warehouse' });
        }

        if (item.status !== 'PENDING') {
            await connection.rollback();
            return res.status(400).json({ message: `Item is already ${item.status}` });
        }

        // Deduct from stock
        await connection.query(
            `UPDATE stock
             SET quantity          = quantity          - ?,
                 reserved_quantity = reserved_quantity - ?
             WHERE product_id = ? AND warehouse_id = ?`,
            [item.quantity, item.quantity, item.product_id, item.warehouse_id]
        );

        // Mark item as fulfilled
        await connection.query(
            "UPDATE sales_order_items SET status = 'FULFILLED' WHERE item_id = ?",
            [itemId]
        );

        await connection.commit();
        res.status(200).json({ message: 'Item fulfilled successfully' });

    } catch (err) {
        await connection.rollback();
        console.error('Fulfillment error:', err);
        res.status(500).json({ message: err.message || 'Fulfillment failed' });
    } finally {
        connection.release();
    }
});

// Reject an order item (employee)
// Effect: stock.reserved_quantity -= qty (quantity unchanged), item.status = REJECTED
// Warehouse scope is taken from the verified JWT — no longer supplied by the client.
app.patch('/api/orders/items/:itemId/reject', authenticateToken, requireRole('employee'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const itemId = req.params.itemId;
        const employeeWarehouseId = req.user.warehouse_id; // from JWT

        const [items] = await connection.query(
            'SELECT * FROM sales_order_items WHERE item_id = ?',
            [itemId]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Order item not found' });
        }

        const item = items[0];

        // Scope check
        if (item.warehouse_id !== employeeWarehouseId) {
            await connection.rollback();
            return res.status(403).json({ message: 'You are not authorised to reject items from another warehouse' });
        }

        if (item.status !== 'PENDING') {
            await connection.rollback();
            return res.status(400).json({ message: `Item is already ${item.status}` });
        }

        // Release the reservation — do NOT deduct quantity
        await connection.query(
            'UPDATE stock SET reserved_quantity = reserved_quantity - ? WHERE product_id = ? AND warehouse_id = ?',
            [item.quantity, item.product_id, item.warehouse_id]
        );

        // Mark item as rejected
        await connection.query(
            "UPDATE sales_order_items SET status = 'REJECTED' WHERE item_id = ?",
            [itemId]
        );

        await connection.commit();
        res.status(200).json({ message: 'Item rejected successfully' });

    } catch (err) {
        await connection.rollback();
        console.error('Rejection error:', err);
        res.status(500).json({ message: err.message || 'Rejection failed' });
    } finally {
        connection.release();
    }
});

// ─────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});
