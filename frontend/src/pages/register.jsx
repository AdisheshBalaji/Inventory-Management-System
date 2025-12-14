
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './register.css';

function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [position, setPosition] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const positions = ['Warehouse Manager', 'Supervisor', 'Inventory Clerk'];

    // Fetch warehouses on component mount
    useEffect(() => {
        fetch('http://localhost:8000/api/warehouses')
            .then(res => res.json())
            .then(data => setWarehouses(data))
            .catch(err => console.error('Error fetching warehouses:', err));
    }, []);

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!warehouseId || !position) {
            setError('Please select warehouse and position');
            return;
        }

        try {
            const response = await fetch("http://localhost:8000/api/register", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    warehouse_id: parseInt(warehouseId),
                    position
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Registration successful!');
                navigate('/');
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Registration failed. Please try again.');
            console.error(err);
        }
    };

    return (
        <div className="register-container">
            <div className="register-box">
                <h1>Employee Registration</h1>
                
                <form onSubmit={handleSignUp}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <select
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        required
                    >
                        <option value="">Select Warehouse</option>
                        {warehouses.map(warehouse => (
                            <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                                {warehouse.name} - {warehouse.location}
                            </option>
                        ))}
                    </select>

                    <select
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        required
                    >
                        <option value="">Select Position</option>
                        {positions.map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))}
                    </select>

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit">Sign Up</button>
                </form>

                <p>Already have an account? <a href="/login">Login</a></p>
            </div>
        </div>
    );
}

export default Register;