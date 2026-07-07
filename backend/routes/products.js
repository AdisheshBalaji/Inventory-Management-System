import { Router } from 'express';
import { getAvailableProducts, getProductById } from '../controllers/productController.js';

const router = Router();

// Get all available products deduplicated across warehouses (public)
router.get('/available', getAvailableProducts);

// Get product by ID with available quantity (public)
router.get('/:productId', getProductById);

export default router;
