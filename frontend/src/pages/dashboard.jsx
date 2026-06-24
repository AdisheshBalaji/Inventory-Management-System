import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './dashboard.css';

function Dashboard() {
    const [employee, setEmployee]         = useState(null);
    const [warehouse, setWarehouse]       = useState(null);
    const [stocks, setStocks]             = useState([]);
    const [pendingItems, setPendingItems] = useState([]);
    const [activeTab, setActiveTab]       = useState('stock');   // 'stock' | 'orders'
    const [loading, setLoading]           = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);    // itemId being acted on
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
            const [warehouseRes, stocksRes] = await Promise.all([
                fetch(`http://localhost:8000/api/warehouse/${warehouseId}`),
                fetch(`http://localhost:8000/api/stocks/${warehouseId}`)
            ]);
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
            const res = await fetch(`http://localhost:8000/api/orders/warehouse/${warehouseId}/pending`);
            const data = await res.json();
            setPendingItems(data);
        } catch (err) {
            console.error('Error fetching pending orders:', err);
        } finally {
            setOrdersLoading(false);
        }
    }, []);

    // Load pending orders when tab is switched to 'orders'
    useEffect(() => {
        if (activeTab === 'orders' && employee) {
            fetchPendingOrders(employee.warehouse_id);
        }
    }, [activeTab, employee, fetchPendingOrders]);

    const handleAction = async (itemId, action) => {
        setActionLoading(itemId);
        try {
            const res = await fetch(`http://localhost:8000/api/orders/items/${itemId}/${action}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_warehouse_id: employee.warehouse_id })
            });
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

    const handleLogout = () => {
        localStorage.removeItem('employee');
        navigate('/');
    };

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
            </div>
        </div>
    );
}

export default Dashboard;