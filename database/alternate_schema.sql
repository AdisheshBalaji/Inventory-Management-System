-- Create warehouse table
CREATE TABLE warehouse (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(100) NOT NULL
);

-- Create employee table
CREATE TABLE employee (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    warehouse_id INT NOT NULL,
    position VARCHAR(50) NOT NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id)
);

-- Create customer table
CREATE TABLE customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(50) UNIQUE NOT NULL
);


-- Create products table
CREATE TABLE product (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    warehouse_id INT NOT NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id)
);

-- Create stocks table
CREATE TABLE stock (
    stock_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT,
    reserved_quantity INT NOT NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    FOREIGN KEY (product_id) REFERENCES product(product_id)
);

-- Create stock transactions table
CREATE TABLE stock_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY, 
    product_id INT NOT NULL,
    created_by INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT NOT NULL,
    type ENUM('IN', 'OUT') NOT NULL,   
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    FOREIGN KEY (product_id) REFERENCES product(product_id),
    FOREIGN KEY (created_by) REFERENCES employee(employee_id)
);

-- Create sales orders table(for customers)
CREATE TABLE sales_orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    FOREIGN KEY (product_id) REFERENCES product(product_id)
);

-- Constraints to ensure data integrity

-- Stock table constraints
ALTER TABLE stock
ADD CONSTRAINT chk_quantity_non_negative CHECK (quantity >= 0),
ADD CONSTRAINT chk_reserved_quantity_non_negative CHECK (reserved_quantity >= 0);
ADD CONSTRAINT chk_reserved_not_exceed_quantity CHECK (reserved_quantity <= quantity);

-- Stock transactions constraints
ALTER TABLE stock_transactions
ADD CONSTRAINT chk_transaction_quantity_positive CHECK (quantity > 0);

-- Products table constraints
ALTER TABLE products
ADD CONSTRAINT chk_unit_price_positive CHECK (unit_price > 0);