import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, handleUnauthorized, logout } from '../utils/auth';
import './customer-products.css';

function CustomerProducts() {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if customer is logged in
        const customerData = localStorage.getItem('customer');
        if (!customerData) {
            navigate('/customer-login');
            return;
        }
        setCustomer(JSON.parse(customerData));

        // Fetch products
        fetchAvailableProducts();

        // Load cart from localStorage
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            setCart(JSON.parse(savedCart));
        }
    }, [navigate]);

    const fetchAvailableProducts = async () => {
        try {
            // Products endpoint is public — no auth header required
            const response = await fetch('http://localhost:8000/api/products/available');
            const data = await response.json();
            setProducts(data);
            setFilteredProducts(data);
        } catch (err) {
            console.error('Error fetching products:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter products based on search term
    useEffect(() => {
        let filtered = products;

        if (searchTerm) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredProducts(filtered);
    }, [searchTerm, products]);

    const addToCart = (product) => {
        const existingItem = cart.find(
            item => item.product_id === product.product_id
        );

        if (existingItem) {
            // Check if adding more won't exceed available quantity
            if (existingItem.quantity < product.available_quantity) {
                const updatedCart = cart.map(item =>
                    item.product_id === product.product_id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
                setCart(updatedCart);
                localStorage.setItem('cart', JSON.stringify(updatedCart));
            } else {
                alert('Cannot exceed available quantity');
            }
        } else {
            const newItem = {
                product_id: product.product_id,
                name: product.name,
                unit_price: product.unit_price,
                quantity: 1,
                available_quantity: product.available_quantity
            };
            const updatedCart = [...cart, newItem];
            setCart(updatedCart);
            localStorage.setItem('cart', JSON.stringify(updatedCart));
        }
    };

    const removeFromCart = (productId) => {
        const updatedCart = cart.filter(item => item.product_id !== productId);
        setCart(updatedCart);
        localStorage.setItem('cart', JSON.stringify(updatedCart));
    };

    const updateCartQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }

        const product = products.find(p => p.product_id === productId);
        if (quantity > product.available_quantity) {
            alert('Cannot exceed available quantity');
            return;
        }

        const updatedCart = cart.map(item =>
            item.product_id === productId
                ? { ...item, quantity: quantity }
                : item
        );
        setCart(updatedCart);
        localStorage.setItem('cart', JSON.stringify(updatedCart));
    };

    const handleCheckout = () => {
        if (cart.length === 0) {
            alert('Your cart is empty');
            return;
        }
        navigate('/customer/checkout');
    };

    const handleLogout = () => logout(navigate, 'customer');

    const getTotalPrice = () => {
        return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0).toFixed(2);
    };

    return (
        <div className="customer-dashboard">
            {/* Header */}
            <header className="header">
                <div className="header-left">
                    <h1>Store</h1>
                </div>
                <div className="header-right">
                    {customer && <span className="welcome-text">Welcome, <strong>{customer.name}</strong></span>}
                    <button onClick={() => navigate('/customer-orders')} className="my-orders-btn">My Orders</button>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </header>

            {/* Search Bar */}
            <div className="search-filter">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="main-content">
                {/* Products Section */}
                <div className="products-section">
                    <h2>Available Products</h2>
                    
                    {loading ? (
                        <p className="loading">Loading products...</p>
                    ) : filteredProducts.length > 0 ? (
                        <div className="products-grid">
                            {filteredProducts.map(product => (
                                <div key={product.product_id} className="product-card">
                                    <h3>{product.name}</h3>
                                    <div className="product-info">
                                        <p className="price">${product.unit_price}</p>
                                        <p className="availability">
                                            Available: <span className="qty">{product.available_quantity}</span>
                                        </p>
                                    </div>
                                    <button
                                        className="add-to-cart-btn"
                                        onClick={() => addToCart(product)}
                                        disabled={product.available_quantity === 0}
                                    >
                                        {product.available_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-products">
                            {searchTerm ? 'No products found matching your search' : 'No products available'}
                        </p>
                    )}
                </div>

                {/* Cart Section */}
                <aside className="cart-section">
                    <h2>Cart</h2>
                    
                    {cart.length > 0 ? (
                        <>
                            <div className="cart-items">
                                {cart.map(item => (
                                    <div key={item.product_id} className="cart-item">
                                        <div className="item-details">
                                            <h4>{item.name}</h4>
                                            <p className="item-price">${item.unit_price}</p>
                                        </div>
                                        <div className="item-quantity">
                                            <button 
                                                className="qty-btn"
                                                onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateCartQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                                min="1"
                                                max={item.available_quantity}
                                            />
                                            <button 
                                                className="qty-btn"
                                                onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="item-total">
                                            <p>${(item.unit_price * item.quantity).toFixed(2)}</p>
                                            <button 
                                                className="remove-btn"
                                                onClick={() => removeFromCart(item.product_id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="cart-summary">
                                <div className="summary-row">
                                    <span>Items:</span>
                                    <span>{cart.length}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Total Qty:</span>
                                    <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                </div>
                                <div className="summary-row total">
                                    <span>Total:</span>
                                    <span>${getTotalPrice()}</span>
                                </div>
                            </div>

                            <button 
                                className="checkout-btn"
                                onClick={handleCheckout}
                            >
                                Proceed to Checkout
                            </button>
                        </>
                    ) : (
                        <p className="empty-cart">Your cart is empty</p>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default CustomerProducts;