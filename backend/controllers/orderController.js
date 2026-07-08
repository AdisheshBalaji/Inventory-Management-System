import pool from '../db.js';
import { deriveOrderStatus } from '../services/orderService.js';


// POST /api/orders
// Creates a new sales order (customer only).
// Routing: each product is assigned to the warehouse with the highest available
export async function createOrder(req, res) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { customer_id, items } = req.body;

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
                product_id: chosen.product_id,
                quantity: item.quantity,
                unit_price: chosen.unit_price,
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
}

// GET /api/orders/:orderId
// Returns full order details with derived overall status
export async function getOrderById(req, res) {
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
}


// GET /api/customers/:customerId/orders
// Returns all orders for a customer, grouped and with derived status

export async function getCustomerOrders(req, res) {
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
                    order_id: row.order_id,
                    total_price: row.total_price,
                    created_at: row.created_at,
                    items: []
                });
            }
            ordersMap.get(row.order_id).items.push({
                item_id: row.item_id,
                product_name: row.product_name,
                quantity: row.quantity,
                unit_price: row.unit_price,
                warehouse_name: row.warehouse_name,
                warehouse_location: row.warehouse_location,
                item_status: row.item_status
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
}

// GET /api/orders/warehouse/:warehouseId/pending
// Returns all pending order items assigned to a warehouse
export async function getPendingWarehouseOrders(req, res) {
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
}


// PATCH /api/orders/items/:itemId/fulfill
// Fulfils an order item

export async function fulfillOrderItem(req, res) {
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
}


// PATCH /api/orders/items/:itemId/reject
// Rejects an order item 

export async function rejectOrderItem(req, res) {
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
}
