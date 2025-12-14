import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        try {
            const response = await fetch("http://localhost:8000/api/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();
            
            if (response.ok) {
                // Store employee data in localStorage
                localStorage.setItem('employee', JSON.stringify(data.employee));
                
                alert('Login successful!');
                navigate('/dashboard');

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
                <h1>Employee Login</h1>
                
                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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

export default Login;