import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// endpoint for customer registration
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

// endpoint for employee login
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


// endpoint to get all warehouses
app.get('/api/warehouses', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT warehouse_id, name, location FROM warehouse');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message }); 
    }
});

// endpoint to get warehouse by id
app.get('/api/warehouse/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT warehouse_id, name, location FROM warehouse WHERE warehouse_id = ?',
            [req.params.id]
        );

        if(rows.length === 0){
            return res.status(404).json({message: 'Warehouse not found'})
        }

        res.json(rows[0]);


    }catch(err){
        res.status(500).json({error: err.message})
    }
})

// endpoint to get stocks for a warehouse
app.get('/api/stocks/:warehouseId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.stock_id,
                s.product_id,
                p.name as product_name,
                p.unit_price,
                s.quantity,
                s.reserved_quantity
            FROM stock s
            JOIN product p ON s.product_id = p.product_id
            WHERE s.warehouse_id = ?
            `, [req.params.warehouseId]);
            res.json(rows);
    }catch(err){
        res.status(500).json({message : "Database Failure"})
    }
})


// endpoint for customer login
app.post("/api/customer-login/", async (req, res) => {
    try {
        const {email} = req.body;
        if(!email){
            return res.json({message : "Please enter email"});
        }
        const [rows] = await pool.query(`
            SELECT * FROM customer 
            WHERE email = ?
            `, [email])

        if(rows.length === 0){
            return res.status(401).sendjson({message : "Customer doesn't exist"})
        }

        const customer = rows[0];

        res.status(200).json({
            message: "Login successful",
            customer: {
                id: customer.customer_id,
                name : customer.name,
                email : customer.email
            }
        });
    }catch(err){
        console.log("Database Error: ", err);
        res.status(500).json({ message: "Login failed" });
    }
})

// endpoint to get available products
app.get('/api/products/available', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.product_id,
                p.name,
                p.unit_price,
                SUM(s.quantity - s.reserved_quantity) as available_quantity
            FROM product p
            JOIN stock s ON p.product_id = s.product_id
            WHERE (s.quantity - s.reserved_quantity) > 0
            GROUP BY p.product_id, p.name, p.unit_price
            ORDER BY p.name
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get product by ID with available quantity
app.get('/api/products/:productId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.product_id,
                p.name,
                p.unit_price,
                SUM(s.quantity - s.reserved_quantity) as available_quantity
            FROM product p
            JOIN stock s ON p.product_id = s.product_id
            WHERE p.product_id = ?
            GROUP BY p.product_id, p.name, p.unit_price
        `, [req.params.productId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ error: err.message });
    }
});


// endpoint to create an order
app.post('/api/orders', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { customer_id, items } = req.body;
        // items = [{product_id, quantity}, ...]

        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({ message: "Invalid order data" });
        }

        let totalPrice = 0;
        const orderItems = [];

        // Validate and reserve stock for each item
        for (const item of items) {
            // Get product details and available stock
            const [product] = await connection.query(`
                SELECT
                    p.product_id,
                    p.unit_price,
                    SUM(s.quantity - s.reserved_quantity) as available_quantity,
                    s.warehouse_id
                FROM product p
                JOIN stock s ON p.product_id = s.product_id
                WHERE p.product_id = ?
                GROUP BY p.product_id, p.unit_price, s.warehouse_id
                LIMIT 1
            `, [item.product_id]);

            if (product.length === 0) {
                throw new Error(`Product ${item.product_id} not found`);
            }

            const available = product[0].available_quantity;
            if (available < item.quantity) {
                throw new Error(`Insufficient stock for product ${item.product_id}. Available: ${available}`);
            }

            totalPrice += product[0].unit_price * item.quantity;
            orderItems.push({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: product[0].unit_price,
                warehouse_id: product[0].warehouse_id
            });
        }

        // Create sales order record
        const [orderResult] = await connection.query(
            'INSERT INTO sales_orders (customer_id, total_price, status) VALUES (?, ?, ?)',
            [customer_id, totalPrice, 'PENDING']
        );

        const orderId = orderResult.insertId;

        // Create order items and reserve stock
        for (const item of orderItems) {
            await connection.query(
                'INSERT INTO sales_order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [orderId, item.product_id, item.quantity, item.unit_price]
            );

            // Reserve stock
            await connection.query(
                'UPDATE stock SET reserved_quantity = reserved_quantity + ? WHERE product_id = ? AND warehouse_id = ?',
                [item.quantity, item.product_id, item.warehouse_id]
            );
        }

        await connection.commit();
        res.status(201).json({ 
            message: "Order placed successfully",
            orderId: orderId,
            totalPrice: totalPrice
        });

    } catch (err) {
        await connection.rollback();
        console.error("Order creation error:", err);
        res.status(400).json({ message: err.message || "Order failed" });
    } finally {
        connection.release();
    }
});

// endpoint to get order details
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                so.order_id,
                so.customer_id,
                so.total_price,
                so.status,
                so.created_at,
                soi.item_id,
                soi.product_id,
                p.name as product_name,
                soi.quantity,
                soi.unit_price,
                (soi.quantity * soi.unit_price) as item_total
            FROM sales_orders so
            JOIN sales_order_items soi ON so.order_id = soi.order_id
            JOIN product p ON soi.product_id = p.product_id
            WHERE so.order_id = ?
            ORDER BY soi.item_id
        `, [req.params.orderId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ error: err.message });
    }
});



const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});


