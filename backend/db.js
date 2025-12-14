import mysql2 from 'mysql2/promise'; 
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(connection => {
        console.log('Database connection established');
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to the database:', err);
    });

export default pool;