import { useState, useEffect } from 'react';
import './register.css';




function Register() {
    const [username, setUsername] = useState('');
    const [email, setUserEmail] = useState('')
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const roles = [
        {id: 1, name: 'Admin'},
        {id: 2, name: 'User'}
    ]

    const handleSignUp = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        

        // post the response to backend
        try{
            const response = await fetch("http://localhost:8000/api/register", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    email,
                    password
                }),
                headers : {
                    "Content-Type" : "application/json"
                }
            });
            const data = await response.json();
            
            // clear the fields after registration
            if(response.ok){
                alert('Registration successful!');
                setUsername('');
                setUserEmail('');
                setPassword('');
                setConfirmPassword('');
            }else{
                setError(data.message);
            }
        }catch(err){
            setError('Error' + err.message);
            console.log(err);
        }
    };

    return (
        <div className="register-container">
            <div className="register-box">
                <h1>Register</h1>
                
                <form onSubmit={handleSignUp}>

                    

                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />

                    <input
                       type="text"
                       placeholder="Email ID"
                       value={email}
                       onChange={(e) => setUserEmail(e.target.value)}
                       required
                    />

                    

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

                    

                    <button type="submit">Sign Up</button>
                </form>

                <p>Already have an account? <a href="/">Login</a></p>
            </div>
        </div>
    );

    

}

export default Register;