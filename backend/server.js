import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Register Route for Employees
app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password, warehouse_id, position } = req.body;

        // Validate input
        if (!username || !email || !password || !warehouse_id || !position) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert employee
        const [result] = await pool.query(
            'INSERT INTO employee (name, email, password_hash, warehouse_id, position) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, warehouse_id, position]
        );

        res.status(201).json({
            message: "Employee registered successfully"
        });
        
    } catch (err) {
        console.error("DB Error: ", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Username or email already exists" });
        }
        res.status(500).json({ message: "Registration failed" });
    }
});

// Login route for Employees
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password required" });
        }

        // Find employee by email
        const [rows] = await pool.query(
            'SELECT * FROM employee WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const employee = rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, employee.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.status(200).json({
            message: "Login successful",
            employee: {
                id: employee.employee_id,
                name: employee.name,
                email: employee.email,
                warehouse_id: employee.warehouse_id,
                position: employee.position
            }
        });
    } catch (err) {
        console.log("Database error: ", err);
        res.status(500).json({ message: "Login failed" });
    }
});

// Get all warehouses (for registration dropdown)
app.get('/api/warehouses', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT warehouse_id, name, location FROM warehouse');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message }); 
    }
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});