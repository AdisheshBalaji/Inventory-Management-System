import pool from '../db.js';

// ─────────────────────────────────────────────
// WAREHOUSE CONTROLLERS
// ─────────────────────────────────────────────

/**
 * GET /api/warehouses
 * Returns all warehouses (public).
 */
export async function getAllWarehouses(req, res) {
    try {
        const [rows] = await pool.query('SELECT warehouse_id, name, location FROM warehouse');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/warehouse/:id
 * Returns a single warehouse by ID (employee only).
 */
export async function getWarehouseById(req, res) {
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
}
