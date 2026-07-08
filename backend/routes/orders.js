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

// ========================================
// Customer Routes
// ========================================

// Create an order 
router.post('/', authenticateToken, requireRole('customer'), createOrder);

// Get order details with derived overall status 
router.get('/:orderId', authenticateToken, requireRole('customer'), getOrderById);

// ========================================
// Employee Routes
// ========================================


// Get all PENDING items assigned to a warehouse 
router.get('/warehouse/:warehouseId/pending', authenticateToken, requireRole('employee'), getPendingWarehouseOrders);

// Fulfill an order item 
router.patch('/items/:itemId/fulfill', authenticateToken, requireRole('employee'), fulfillOrderItem);

// Reject an order item 
router.patch('/items/:itemId/reject', authenticateToken, requireRole('employee'), rejectOrderItem);

export default router;
