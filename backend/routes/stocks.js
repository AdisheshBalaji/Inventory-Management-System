import { Router } from 'express';
import {
    getStockByWarehouse,
    adjustStock,
    getStockTransactions
} from '../controllers/stockController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get stock for a warehouse (employee only)
router.get('/:warehouseId', authenticateToken, requireRole('employee'), getStockByWarehouse);

// Adjust stock for a product in a warehouse (employee — own warehouse only)
router.post('/:warehouseId/adjust', authenticateToken, requireRole('employee'), adjustStock);

// Get stock transaction history for a warehouse (employee — own warehouse only)
router.get('/:warehouseId/transactions', authenticateToken, requireRole('employee'), getStockTransactions);

export default router;
