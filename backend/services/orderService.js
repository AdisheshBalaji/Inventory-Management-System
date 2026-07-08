
export function deriveOrderStatus(itemStatuses) {
    if (itemStatuses.every(s => s === 'FULFILLED')) return 'FULFILLED';
    if (itemStatuses.every(s => s === 'REJECTED')) return 'REJECTED';
    if (itemStatuses.every(s => s === 'PENDING')) return 'PENDING';
    return 'PARTIALLY_FULFILLED';
}
