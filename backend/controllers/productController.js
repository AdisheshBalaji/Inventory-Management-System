import pool from '../db.js';



// GET / api / products / available
// Returns all available products deduplicated across warehouses(public).
// Groups by name + price so each product appears once with total available quantity.

export async function getAvailableProducts(req, res) {
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
}


//GET /api/products/:productId
//Returns a product by ID with its total available quantity across all warehouses

export async function getProductById(req, res) {
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
}
