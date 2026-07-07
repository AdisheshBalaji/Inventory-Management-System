import { Router } from 'express';
import {
    createOrder,
    getOrderById,
    getCustomerOrders,
    getPendingWarehouseOrders,
    fulfillOrderItem,
    rejectOrderItem
} from '../controllers/orderController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// ── Customer routes ───────────────────────────

// Create an order (customer only)
router.post('/', authenticateToken, requireRole('customer'), createOrder);

// Get order details with derived overall status (customer only)
router.get('/:orderId', authenticateToken, requireRole('customer'), getOrderById);

// ── Employee routes ───────────────────────────

// Get all PENDING items assigned to a warehouse (employee only)
// NOTE: this route must be defined before /:orderId to avoid param conflicts
router.get('/warehouse/:warehouseId/pending', authenticateToken, requireRole('employee'), getPendingWarehouseOrders);

// Fulfill an order item (employee only)
router.patch('/items/:itemId/fulfill', authenticateToken, requireRole('employee'), fulfillOrderItem);

// Reject an order item (employee only)
router.patch('/items/:itemId/reject', authenticateToken, requireRole('employee'), rejectOrderItem);

export default router;
