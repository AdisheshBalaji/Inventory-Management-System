// ─────────────────────────────────────────────
// ORDER SERVICE
// ─────────────────────────────────────────────

/**
 * Derives the overall status of an order from its individual item statuses.
 * - All FULFILLED  → FULFILLED
 * - All REJECTED   → REJECTED
 * - All PENDING    → PENDING
 * - Mixed          → PARTIALLY_FULFILLED
 */
export function deriveOrderStatus(itemStatuses) {
    if (itemStatuses.every(s => s === 'FULFILLED')) return 'FULFILLED';
    if (itemStatuses.every(s => s === 'REJECTED'))  return 'REJECTED';
    if (itemStatuses.every(s => s === 'PENDING'))   return 'PENDING';
    return 'PARTIALLY_FULFILLED';
}
