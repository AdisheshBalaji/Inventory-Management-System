import { Router } from 'express';
import { getAllWarehouses, getWarehouseById } from '../controllers/warehouseController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get all warehouses (public)
router.get('/warehouses', getAllWarehouses);

// Get warehouse by id (employee only)
router.get('/warehouse/:id', authenticateToken, requireRole('employee'), getWarehouseById);

export default router;
