import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

function CustomerLogin() {
    const [email, setEmail] = useState('');
    // const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        try {
            const response = await fetch("http://localhost:8000/api/customer-login", {
                method: "POST",
                body: JSON.stringify({ email }),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                // Store customer data and JWT token in localStorage
                localStorage.setItem('customer', JSON.stringify(data.customer));
                localStorage.setItem('token', data.token);
                
                alert('Login successful!');
                navigate('/customer-products')

                

            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Connection error. Please try again.');
            console.error(err);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>Customer Login</h1>
                
                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit">Login</button>
                </form>

                <p>Don't have an account? <a href="/register">Register</a></p>
            </div>
        </div>
    );
}

export default CustomerLogin;