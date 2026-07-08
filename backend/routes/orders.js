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

const orderRouter = Router();
const customerRouter = Router({ mergeParams: true });

// ========================================
// Customer Routes (/api/orders/*)
// ========================================

// Create an order
orderRouter.post('/', authenticateToken, requireRole('customer'), createOrder);

// Get order details with derived overall status
orderRouter.get('/:orderId', authenticateToken, requireRole('customer'), getOrderById);

// ========================================
// Employee Routes (/api/orders/*)
// ========================================

// Get all PENDING items assigned to a warehouse
orderRouter.get('/warehouse/:warehouseId/pending', authenticateToken, requireRole('employee'), getPendingWarehouseOrders);

// Fulfill an order item
orderRouter.patch('/items/:itemId/fulfill', authenticateToken, requireRole('employee'), fulfillOrderItem);

// Reject an order item
orderRouter.patch('/items/:itemId/reject', authenticateToken, requireRole('employee'), rejectOrderItem);

// ========================================
// Customer sub-resource (/api/customers/:customerId/orders)
// ========================================

// Get all orders for a customer (mounted separately in index.js)
customerRouter.get('/orders', authenticateToken, requireRole('customer'), getCustomerOrders);

export { orderRouter, customerRouter };
