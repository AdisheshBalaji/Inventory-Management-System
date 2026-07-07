import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, handleUnauthorized } from '../utils/auth';
import './checkout.css';

function Checkout() {
    const [cart, setCart] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(false);
    const [orderConfirmed, setOrderConfirmed] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const customerData = localStorage.getItem('customer');
        const cartData = localStorage.getItem('cart');

        if (!customerData) {
            navigate('/customer-login');
            return;
        }

        setCustomer(JSON.parse(customerData));

        if (cartData) {
            const parsed = JSON.parse(cartData);
            if (parsed.length === 0) {
                navigate('/customer-products');
                return;
            }
            setCart(parsed);
        } else {
            navigate('/customer-products');
        }
    }, [navigate]);

    const getTotalPrice = () =>
        cart.reduce((total, item) => total + item.unit_price * item.quantity, 0).toFixed(2);

    const handlePlaceOrder = async () => {
        if (cart.length === 0 || loading) return;
        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:8000/api/orders', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    customer_id: customer.id,
                    items: cart.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                    })),
                }),
            });

            if (response.status === 401) {
                handleUnauthorized(navigate, 'customer');
                return;
            }

            const data = await response.json();

            if (response.ok) {
                localStorage.removeItem('cart');
                setOrderConfirmed(data);
            } else {
                setError(data.message || 'Order failed. Please try again.');
            }
        } catch (err) {
            setError('Connection error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    // ── Order confirmation screen ───────────────────────────────────────
    if (orderConfirmed) {
        return (
            <div className="confirmation-container">
                <div className="confirmation-box">
                    <div className="check-circle">✓</div>
                    <h2>Order Placed!</h2>
                    <p className="confirm-sub">
                        Your order has been received and stock has been reserved.
                    </p>
                    <div className="confirm-details">
                        <div className="confirm-row">
                            <span>Order ID</span>
                            <span className="confirm-value">#{orderConfirmed.orderId}</span>
                        </div>
                        <div className="confirm-row">
                            <span>Total Paid</span>
                            <span className="confirm-value">
                                ${Number(orderConfirmed.totalPrice).toFixed(2)}
                            </span>
                        </div>
                        <div className="confirm-row">
                            <span>Status</span>
                            <span className="status-badge">PENDING</span>
                        </div>
                    </div>
                    <button className="continue-btn" onClick={() => navigate('/customer-products')}>
                        Continue Shopping
                    </button>
                </div>
            </div>
        );
    }

    // ── Checkout form ───────────────────────────────────────────────────
    return (
        <div className="checkout-page">
            <div className="checkout-header">
                <button className="back-btn" onClick={() => navigate('/customer-products')}>
                    ← Back to Products
                </button>
                <h1>Checkout</h1>
            </div>

            <div className="checkout-body">
                {/* Order summary */}
                <div className="summary-section">
                    <h2>Order Summary</h2>
                    <div className="summary-items">
                        {cart.map(item => (
                            <div key={item.product_id} className="summary-item">
                                <div className="summary-item-info">
                                    <span className="summary-item-name">{item.name}</span>
                                    <span className="summary-item-price">
                                        ${item.unit_price} × {item.quantity}
                                    </span>
                                </div>
                                <span className="summary-item-total">
                                    ${(item.unit_price * item.quantity).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="summary-total">
                        <span>Total</span>
                        <span className="total-amount">${getTotalPrice()}</span>
                    </div>
                </div>

                {/* Customer info + place order */}
                <div className="customer-section">
                    <h2>Placing Order As</h2>
                    {customer && (
                        <div className="customer-card">
                            <div className="customer-avatar">
                                {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="customer-details">
                                <span className="customer-name">{customer.name}</span>
                                <span className="customer-email">{customer.email}</span>
                            </div>
                        </div>
                    )}

                    {error && <p className="checkout-error">{error}</p>}

                    <button
                        className="place-order-btn"
                        onClick={handlePlaceOrder}
                        disabled={loading || cart.length === 0}
                    >
                        {loading ? 'Placing Order…' : `Place Order — $${getTotalPrice()}`}
                    </button>
                    <p className="order-note">
                        Stock is reserved instantly. Orders are fulfilled by warehouse staff.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Checkout;
