import pool from '../db.js';

// ─────────────────────────────────────────────
// STOCK CONTROLLERS
// ─────────────────────────────────────────────

/**
 * GET /api/stocks/:warehouseId
 * Returns all stock rows for a warehouse (employee only).
 */
export async function getStockByWarehouse(req, res) {
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
}

/**
 * POST /api/stocks/:warehouseId/adjust
 * Adjusts stock for a product in a warehouse (employee — own warehouse only).
 * Body: { product_id, quantity, type: 'IN' | 'OUT' }
 *
 * Effect:
 *   IN  → stock.quantity += qty  (receiving new goods)
 *   OUT → stock.quantity -= qty  (writing off / damage / manual correction)
 *         OUT is blocked if it would push quantity below reserved_quantity
 * Every adjustment is recorded in stock_transactions as an audit trail.
 */
export async function adjustStock(req, res) {
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
}

/**
 * GET /api/stocks/:warehouseId/transactions
 * Returns all IN/OUT adjustments for a warehouse (employee — own warehouse only).
 * Includes product name and the employee who made each change.
 */
export async function getStockTransactions(req, res) {
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
}
