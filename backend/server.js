import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Register Route
app.post("/api/register", async (req, res) => {
    try {
        let {username, email, password} = req.body;
        password = await bcrypt.hash(password, 10);

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, password]
        );

        res.status(201).json({
            message: "User created successfully"
        });
        
    } catch (err) {
        console.error("DB Error: ", err);
        console.error("SQL Message: ", err.sqlMessage)
        res.status(500).json({ message: err.sqlMessage });
    }
});

// login route
app.post("/api/", async (req, res) => {
    try {
        const {username, password} = req.body;
        
        if (!username || !password){
            return res.status(400).json({message: "Username and password required"})
        }

        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if(rows.length == 0){
            return res.status(401).json({message : "Invalid username or password"})
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if(!isPasswordValid){
            return res.status(401).json({message : "Invalid username or password"})
        }

        res.status(200).json({
            message: "Login successful",
            user : {username: user.username, email: user.email}
        })
    }catch(err){
        console.log("Database error: ", err);
        res.status(500).json({message: err.sqlMessage})
    }
})

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users');
        console.log('Fetched users successfully');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message }); 
    }
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});