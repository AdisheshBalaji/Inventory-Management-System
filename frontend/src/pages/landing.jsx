import { useNavigate } from 'react-router-dom';
import './landing.css';

function Landing() {
    const navigate = useNavigate();

    return (
        <div className="landing-container">
            <div className="landing-hero">
                <h1>Inventory Management System</h1>
                <p>Multi-warehouse grain inventory platform</p>
            </div>

            <div className="landing-cards">
                <div className="landing-card" onClick={() => navigate('/login')}>
                    <div className="card-icon">🏭</div>
                    <h2>Employee</h2>
                    <p>Manage warehouse stock, track inventory levels, and process orders for your assigned warehouse.</p>
                    <button className="card-btn">Employee Login</button>
                </div>

                <div className="landing-card" onClick={() => navigate('/customer-login')}>
                    <div className="card-icon">🛒</div>
                    <h2>Customer</h2>
                    <p>Browse available grain products across all warehouses, manage your cart, and place orders.</p>
                    <button className="card-btn">Customer Login</button>
                </div>
            </div>


        </div>
    );
}

export default Landing;
