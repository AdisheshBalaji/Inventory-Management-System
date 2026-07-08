import pool from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { tokenBlacklist } from '../middleware/rateLimit.js';


// POST /api/register
// Employee registration: hashes the password and inserts a new employee row.

export async function register(req, res) {
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
}

// POST /api/login
// Employee login: validates credentials and issues a signed JWT.

export async function login(req, res) {
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
            jti: randomUUID(),
            id: employee.employee_id,
            name: employee.name,
            email: employee.email,
            warehouse_id: employee.warehouse_id,
            position: employee.position,
            role: 'employee'
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            employee: {
                id: employee.employee_id,
                name: employee.name,
                email: employee.email,
                warehouse_id: employee.warehouse_id,
                position: employee.position
            }
        });
    } catch (err) {
        console.log('Database error: ', err);
        res.status(500).json({ message: 'Login failed' });
    }
}


// POST /api/customer-login
// Customer login: looks up by email only and issues a signed JWT.

export async function customerLogin(req, res) {
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
            jti: randomUUID(),
            id: customer.customer_id,
            name: customer.name,
            email: customer.email,
            role: 'customer'
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            customer: {
                id: customer.customer_id,
                name: customer.name,
                email: customer.email
            }
        });
    } catch (err) {
        console.log('Database Error: ', err);
        res.status(500).json({ message: 'Login failed' });
    }
}

// POST /api/logout
// Revokes the current token by adding its jti to the in-memory blacklist.

export function logout(req, res) {
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
}
