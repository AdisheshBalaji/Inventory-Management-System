import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, handleUnauthorized, logout } from '../utils/auth';
import './dashboard.css';

const API = 'http://localhost:8000';

function Dashboard() {
    const [employee, setEmployee]         = useState(null);
    const [warehouse, setWarehouse]       = useState(null);
    const [stocks, setStocks]             = useState([]);
    const [pendingItems, setPendingItems] = useState([]);
    const [activeTab, setActiveTab]       = useState('stock');   // 'stock' | 'orders' | 'adjust' | 'history'
    const [loading, setLoading]           = useState(true);
    const [ordersLoading, setOrdersLoading]         = useState(false);
    const [actionLoading, setActionLoading]         = useState(null);

    // ── Adjust Stock state ──
    const [adjustForm, setAdjustForm]     = useState({ product_id: '', quantity: '', type: 'IN' });
    const [adjustLoading, setAdjustLoading] = useState(false);
    const [adjustMessage, setAdjustMessage] = useState(null); // { text, ok }

    // ── Transaction History state ──
    const [transactions, setTransactions]     = useState([]);
    const [txLoading, setTxLoading]           = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const employeeData = localStorage.getItem('employee');
        if (!employeeData) {
            navigate('/');
            return;
        }
        const parsedEmployee = JSON.parse(employeeData);
        setEmployee(parsedEmployee);
        fetchWarehouseData(parsedEmployee.warehouse_id);
    }, [navigate]);

    const fetchWarehouseData = async (warehouseId) => {
        try {
            setLoading(true);
            const headers = authHeaders();
            const [warehouseRes, stocksRes] = await Promise.all([
                fetch(`${API}/api/warehouse/${warehouseId}`, { headers }),
                fetch(`${API}/api/stocks/${warehouseId}`, { headers })
            ]);

            if (warehouseRes.status === 401 || stocksRes.status === 401) {
                handleUnauthorized(navigate, 'employee');
                return;
            }

            setWarehouse(await warehouseRes.json());
            setStocks(await stocksRes.json());
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingOrders = useCallback(async (warehouseId) => {
        try {
            setOrdersLoading(true);
            const res = await fetch(
                `${API}/api/orders/warehouse/${warehouseId}/pending`,
                { headers: authHeaders() }
            );

            if (res.status === 401) {
                handleUnauthorized(navigate, 'employee');
                return;
            }

            const data = await res.json();
            setPendingItems(data);
        } catch (err) {
            console.error('Error fetching pending orders:', err);
        } finally {
            setOrdersLoading(false);
        }
    }, [navigate]);

    const fetchTransactions = useCallback(async (warehouseId) => {
        try {
            setTxLoading(true);
            const res = await fetch(
                `${API}/api/stocks/${warehouseId}/transactions`,
                { headers: authHeaders() }
            );
            if (res.status === 401) { handleUnauthorized(navigate, 'employee'); return; }
            setTransactions(await res.json());
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setTxLoading(false);
        }
    }, [navigate]);

    // Load data when tabs are switched
    useEffect(() => {
        if (activeTab === 'orders' && employee) {
            fetchPendingOrders(employee.warehouse_id);
        }
        if (activeTab === 'history' && employee) {
            fetchTransactions(employee.warehouse_id);
        }
        if (activeTab === 'adjust') {
            setAdjustMessage(null);
        }
    }, [activeTab, employee, fetchPendingOrders, fetchTransactions]);

    const handleAction = async (itemId, action) => {
        setActionLoading(itemId);
        try {
            const res = await fetch(`${API}/api/orders/items/${itemId}/${action}`, {
                method: 'PATCH',
                headers: authHeaders()
                // employee_warehouse_id no longer sent — the backend reads it from the JWT
            });

            if (res.status === 401) {
                handleUnauthorized(navigate, 'employee');
                return;
            }

            const data = await res.json();
            if (res.ok) {
                // Remove the acted item from the list and refresh stock
                setPendingItems(prev => prev.filter(i => i.item_id !== itemId));
                fetchWarehouseData(employee.warehouse_id);
            } else {
                alert(data.message || 'Action failed');
            }
        } catch (err) {
            alert('Connection error. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAdjustSubmit = async (e) => {
        e.preventDefault();
        setAdjustLoading(true);
        setAdjustMessage(null);
        try {
            const res = await fetch(
                `${API}/api/stocks/${employee.warehouse_id}/adjust`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        product_id: parseInt(adjustForm.product_id, 10),
                        quantity:   parseInt(adjustForm.quantity, 10),
                        type:       adjustForm.type
                    })
                }
            );
            if (res.status === 401) { handleUnauthorized(navigate, 'employee'); return; }
            const data = await res.json();
            if (res.ok) {
                setAdjustMessage({ text: `✓ ${data.message} — new quantity: ${data.new_quantity}`, ok: true });
                setAdjustForm({ product_id: '', quantity: '', type: 'IN' });
                // Refresh stock table in background
                fetchWarehouseData(employee.warehouse_id);
            } else {
                setAdjustMessage({ text: `✗ ${data.message}`, ok: false });
            }
        } catch (err) {
            setAdjustMessage({ text: '✗ Connection error. Please try again.', ok: false });
        } finally {
            setAdjustLoading(false);
        }
    };

    const handleLogout = () => logout(navigate, 'employee');

    if (!employee || loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>Inventory Dashboard</h1>
                <div className="user-info">
                    <span>{employee.name} ({employee.position})</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </header>

            <div className="dashboard-content">
                {/* Warehouse info */}
                {warehouse && (
                    <div className="warehouse-info">
                        <h2>Warehouse Information</h2>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Name:</span>
                                <span className="value">{warehouse.name}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Location:</span>
                                <span className="value">{warehouse.location}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Warehouse ID:</span>
                                <span className="value">{warehouse.warehouse_id}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="tab-bar">
                    <button
                        className={`tab-btn ${activeTab === 'stock' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('stock')}
                    >
                        Stock Inventory
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'orders' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        Pending Orders
                        {pendingItems.length > 0 && (
                            <span className="badge">{pendingItems.length}</span>
                        )}
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'adjust' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('adjust')}
                    >
                        Adjust Stock
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        Transaction History
                    </button>
                </div>

                {/* Stock Inventory tab */}
                {activeTab === 'stock' && (
                    <div className="stock-section">
                        <div className="stock-table-container">
                            <table className="stock-table">
                                <thead>
                                    <tr>
                                        <th>Product ID</th>
                                        <th>Product Name</th>
                                        <th>Unit Price</th>
                                        <th>Quantity</th>
                                        <th>Reserved</th>
                                        <th>Available</th>
                                        <th>Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stocks.length > 0 ? (
                                        stocks.map((stock) => (
                                            <tr key={stock.stock_id}>
                                                <td>{stock.product_id}</td>
                                                <td>{stock.product_name}</td>
                                                <td>${stock.unit_price}</td>
                                                <td>{stock.quantity.toLocaleString()}</td>
                                                <td>{stock.reserved_quantity.toLocaleString()}</td>
                                                <td>{(stock.quantity - stock.reserved_quantity).toLocaleString()}</td>
                                                <td>${(stock.quantity * stock.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="no-data">No stock data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pending Orders tab */}
                {activeTab === 'orders' && (
                    <div className="stock-section">
                        {ordersLoading ? (
                            <p className="no-data">Loading orders...</p>
                        ) : (
                            <div className="stock-table-container">
                                <table className="stock-table">
                                    <thead>
                                        <tr>
                                            <th>Order #</th>
                                            <th>Customer</th>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Unit Price</th>
                                            <th>Total</th>
                                            <th>Ordered At</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingItems.length > 0 ? (
                                            pendingItems.map((item) => (
                                                <tr key={item.item_id}>
                                                    <td>#{item.order_id}</td>
                                                    <td>{item.customer_name}</td>
                                                    <td>{item.product_name}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>${item.unit_price}</td>
                                                    <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
                                                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                                                    <td className="action-cell">
                                                        <button
                                                            className="fulfill-btn"
                                                            onClick={() => handleAction(item.item_id, 'fulfill')}
                                                            disabled={actionLoading === item.item_id}
                                                        >
                                                            {actionLoading === item.item_id ? '…' : 'Fulfill'}
                                                        </button>
                                                        <button
                                                            className="reject-btn"
                                                            onClick={() => handleAction(item.item_id, 'reject')}
                                                            disabled={actionLoading === item.item_id}
                                                        >
                                                            {actionLoading === item.item_id ? '…' : 'Reject'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="no-data">No pending orders for this warehouse</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Adjust Stock tab */}
                {activeTab === 'adjust' && (
                    <div className="stock-section">
                        <h2>Adjust Stock</h2>
                        <form className="adjust-form" onSubmit={handleAdjustSubmit}>
                            <div className="adjust-row">
                                <label className="adjust-label" htmlFor="adjust-product">Product</label>
                                <select
                                    id="adjust-product"
                                    className="adjust-select"
                                    value={adjustForm.product_id}
                                    onChange={e => setAdjustForm(f => ({ ...f, product_id: e.target.value }))}
                                    required
                                >
                                    <option value="">— Select a product —</option>
                                    {stocks.map(s => (
                                        <option key={s.stock_id} value={s.product_id}>
                                            {s.product_name} (Stock: {s.quantity - s.reserved_quantity} available)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="adjust-row">
                                <label className="adjust-label" htmlFor="adjust-type">Type</label>
                                <div className="adjust-type-group">
                                    <label className={`type-option ${adjustForm.type === 'IN' ? 'type-in-active' : ''}`}>
                                        <input
                                            type="radio" name="type" value="IN"
                                            checked={adjustForm.type === 'IN'}
                                            onChange={e => setAdjustForm(f => ({ ...f, type: e.target.value }))}
                                        />
                                        IN — Restock
                                    </label>
                                    <label className={`type-option ${adjustForm.type === 'OUT' ? 'type-out-active' : ''}`}>
                                        <input
                                            type="radio" name="type" value="OUT"
                                            checked={adjustForm.type === 'OUT'}
                                            onChange={e => setAdjustForm(f => ({ ...f, type: e.target.value }))}
                                        />
                                        OUT — Write-off
                                    </label>
                                </div>
                            </div>

                            <div className="adjust-row">
                                <label className="adjust-label" htmlFor="adjust-qty">Quantity</label>
                                <input
                                    id="adjust-qty"
                                    type="number"
                                    min="1"
                                    className="adjust-input"
                                    placeholder="Enter units..."
                                    value={adjustForm.quantity}
                                    onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))}
                                    required
                                />
                            </div>

                            {adjustMessage && (
                                <div className={`adjust-message ${adjustMessage.ok ? 'adjust-ok' : 'adjust-err'}`}>
                                    {adjustMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="adjust-submit-btn"
                                disabled={adjustLoading}
                            >
                                {adjustLoading ? 'Saving…' : `Confirm ${adjustForm.type === 'IN' ? 'Restock' : 'Write-off'}`}
                            </button>
                        </form>
                    </div>
                )}

                {/* Transaction History tab */}
                {activeTab === 'history' && (
                    <div className="stock-section">
                        <div className="history-header">
                            <h2>Transaction History</h2>
                            <button
                                className="refresh-btn"
                                onClick={() => fetchTransactions(employee.warehouse_id)}
                                disabled={txLoading}
                            >
                                {txLoading ? 'Refreshing…' : '↻ Refresh'}
                            </button>
                        </div>
                        {txLoading ? (
                            <p className="no-data">Loading transactions...</p>
                        ) : (
                            <div className="stock-table-container">
                                <table className="stock-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Type</th>
                                            <th>Product</th>
                                            <th>Unit Price</th>
                                            <th>Qty Changed</th>
                                            <th>By</th>
                                            <th>Position</th>
                                            <th>Date &amp; Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.length > 0 ? (
                                            transactions.map(tx => (
                                                <tr key={tx.transaction_id}>
                                                    <td>{tx.transaction_id}</td>
                                                    <td>
                                                        <span className={`tx-badge ${tx.type === 'IN' ? 'tx-in' : 'tx-out'}`}>
                                                            {tx.type}
                                                        </span>
                                                    </td>
                                                    <td>{tx.product_name}</td>
                                                    <td>${Number(tx.unit_price).toFixed(2)}</td>
                                                    <td className={tx.type === 'IN' ? 'qty-in' : 'qty-out'}>
                                                        {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                                                    </td>
                                                    <td>{tx.created_by_name}</td>
                                                    <td>{tx.created_by_position}</td>
                                                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="no-data">No transactions recorded yet</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;