import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, handleUnauthorized } from '../utils/auth';
import './customer-orders.css';

const STATUS_LABEL = {
    PENDING:              'Pending',
    FULFILLED:            'Fulfilled',
    REJECTED:             'Rejected',
    PARTIALLY_FULFILLED:  'Partially Fulfilled',
};

function CustomerOrders() {
    const [orders, setOrders]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const customerData = localStorage.getItem('customer');
        if (!customerData) {
            navigate('/customer-login');
            return;
        }
        const parsed = JSON.parse(customerData);
        setCustomer(parsed);
        fetchOrders(parsed.id);
    }, [navigate]);

    const fetchOrders = async (customerId) => {
        try {
            const res = await fetch(
                `http://localhost:8000/api/customers/${customerId}/orders`,
                { headers: authHeaders() }
            );

            if (res.status === 401) {
                handleUnauthorized(navigate, 'customer');
                return;
            }

            const data = await res.json();
            setOrders(data);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('customer');
        localStorage.removeItem('token');
        localStorage.removeItem('cart');
        navigate('/customer-login');
    };

    return (
        <div className="orders-page">
            <header className="orders-header">
                <div className="orders-header-left">
                    <button className="back-btn" onClick={() => navigate('/customer-products')}>
                        ← Back to Products
                    </button>
                    <h1>My Orders</h1>
                </div>
                <div className="orders-header-right">
                    {customer && <span className="welcome-text">Welcome, <strong>{customer.name}</strong></span>}
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <div className="orders-content">
                {loading ? (
                    <p className="orders-empty">Loading orders...</p>
                ) : orders.length === 0 ? (
                    <div className="orders-empty-box">
                        <p>You have not placed any orders yet.</p>
                        <button className="shop-btn" onClick={() => navigate('/customer-products')}>
                            Browse Products
                        </button>
                    </div>
                ) : (
                    <div className="orders-list">
                        {orders.map(order => (
                            <div key={order.order_id} className="order-card">
                                <div className="order-card-header">
                                    <div className="order-meta">
                                        <span className="order-id">Order #{order.order_id}</span>
                                        <span className="order-date">
                                            {new Date(order.created_at).toLocaleDateString('en-US', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <div className="order-summary-right">
                                        <span className="order-total">${Number(order.total_price).toFixed(2)}</span>
                                        <span className={`status-pill status-${order.overall_status.toLowerCase()}`}>
                                            {STATUS_LABEL[order.overall_status] || order.overall_status}
                                        </span>
                                    </div>
                                </div>

                                <table className="order-items-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Unit Price</th>
                                            <th>Subtotal</th>
                                            <th>Warehouse</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items.map(item => (
                                            <tr key={item.item_id}>
                                                <td>{item.product_name}</td>
                                                <td>{item.quantity}</td>
                                                <td>${item.unit_price}</td>
                                                <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
                                                <td>
                                                    <span className="warehouse-name">{item.warehouse_name}</span>
                                                    <span className="warehouse-location">{item.warehouse_location}</span>
                                                </td>
                                                <td>
                                                    <span className={`item-status-pill status-${item.item_status.toLowerCase()}`}>
                                                        {STATUS_LABEL[item.item_status] || item.item_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default CustomerOrders;
