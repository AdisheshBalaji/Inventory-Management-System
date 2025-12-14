import { useState } from 'react';
import './login.css';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch("http://localhost:8000/api/", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if(!response.ok && response.status === 404){
                setError("Backend server not found");
                return;
            }

            const data = await response.json();
            
            if (response.ok) {
                alert('Login successful!');
                setUsername('');
                setPassword('');
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error: ' + err.message);
            console.log(err);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>Login</h1>
                
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
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