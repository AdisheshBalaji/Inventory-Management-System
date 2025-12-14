import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './dashboard.css';

function Dashboard() {
    const [employee, setEmployee] = useState(null);
    const [warehouse, setWarehouse] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Get employee data from localStorage
        const employeeData = localStorage.getItem('employee');
        
        if (!employeeData) {
            navigate('/');
            return;
        }

        const parsedEmployee = JSON.parse(employeeData);
        setEmployee(parsedEmployee);

        // Fetch warehouse and stock data
        fetchWarehouseData(parsedEmployee.warehouse_id);
    }, [navigate]);

    const fetchWarehouseData = async (warehouseId) => {
        try {
            setLoading(true);

            // Fetch warehouse details
            const warehouseRes = await fetch(`http://localhost:8000/api/warehouse/${warehouseId}`);
            if (!warehouseRes.ok) {
                throw new Error('Failed to fetch warehouse');
            }
            const warehouseData = await warehouseRes.json();
            setWarehouse(warehouseData);

            // Fetch stocks for this warehouse
            const stocksRes = await fetch(`http://localhost:8000/api/stocks/${warehouseId}`);
            if (!stocksRes.ok) {
                throw new Error('Failed to fetch stocks');
            }
            const stocksData = await stocksRes.json();

            console.log('Stocks data:', stocksData)
            setStocks(stocksData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('employee');
        navigate('/');
    };

    if (!employee) {
        return <div className="loading">Loading...</div>;
    }

    if (loading) {
        return <div className="loading">Loading warehouse data...</div>;
    }

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>Inventory Dashboard</h1>
                <div className="user-info">
                    <span>{employee.name} ({employee.position})</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </header>

            <div className="dashboard-content">
                {warehouse && (
                    <div className="warehouse-info">
                        <h2>Warehouse Information</h2>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Name:</span>
                                <span className="value">{warehouse.name}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Location:</span>
                                <span className="value">{warehouse.location}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Warehouse ID:</span>
                                <span className="value">{warehouse.warehouse_id}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="stock-section">
                    <h2>Stock Inventory</h2>
                    <div className="stock-table-container">
                        <table className="stock-table">
                            <thead>
                                <tr>
                                    <th>Product ID</th>
                                    <th>Product Name</th>
                                    <th>Unit Price</th>
                                    <th>Available Quantity</th>
                                    <th>Reserved Quantity</th>
                                    <th>Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.length > 0 ? (
                                    stocks.map((stock) => (
                                        <tr key={stock.stock_id}>
                                            <td>{stock.product_id}</td>
                                            <td>{stock.product_name}</td>
                                            <td>${stock.unit_price}</td>
                                            <td>{stock.quantity? stock.quantity.toLocaleString() : '0'}</td>
                                            <td>{stock.reserved_quantity}</td>
                                            <td>${(stock.quantity * stock.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="no-data">No stock data available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;