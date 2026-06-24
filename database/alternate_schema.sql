-- ============================================================
-- Inventory Management System — Database Schema
-- ============================================================

-- Create warehouse table
CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) UNIQUE NOT NULL,
    location     VARCHAR(100) NOT NULL
);

-- Create employee table
CREATE TABLE IF NOT EXISTS employee (
    employee_id   INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    warehouse_id  INT NOT NULL,
    position      VARCHAR(50)  NOT NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id)
);

-- Create customer table
CREATE TABLE IF NOT EXISTS customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(50)  UNIQUE NOT NULL
);

-- Create product table
CREATE TABLE IF NOT EXISTS product (
    product_id   INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(50)     NOT NULL,
    unit_price   DECIMAL(10, 2)  NOT NULL,
    warehouse_id INT             NOT NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    CONSTRAINT chk_unit_price_positive CHECK (unit_price > 0)
);

-- Create stock table
CREATE TABLE IF NOT EXISTS stock (
    stock_id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id        INT NOT NULL,
    warehouse_id      INT NOT NULL,
    quantity          INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    FOREIGN KEY (product_id)   REFERENCES product(product_id),
    CONSTRAINT chk_quantity_non_negative          CHECK (quantity >= 0),
    CONSTRAINT chk_reserved_quantity_non_negative CHECK (reserved_quantity >= 0),
    CONSTRAINT chk_reserved_not_exceed_quantity   CHECK (reserved_quantity <= quantity)
);

-- Create stock_transactions table (audit log for employee stock movements)
CREATE TABLE IF NOT EXISTS stock_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id     INT NOT NULL,
    created_by     INT NOT NULL,
    warehouse_id   INT NOT NULL,
    quantity       INT NOT NULL,
    type           ENUM('IN', 'OUT') NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    FOREIGN KEY (product_id)   REFERENCES product(product_id),
    FOREIGN KEY (created_by)   REFERENCES employee(employee_id),
    CONSTRAINT chk_transaction_quantity_positive CHECK (quantity > 0)
);

-- Create sales_orders table (customer orders)
--   overall status is derived from sales_order_items.status — not written directly.
--   Derivation: all PENDING → PENDING | all FULFILLED → FULFILLED |
--               all REJECTED → REJECTED | mix → PARTIALLY_FULFILLED
CREATE TABLE IF NOT EXISTS sales_orders (
    order_id    INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT            NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    status      VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);

-- Create sales_order_items table (line items for each order)
--   status lifecycle per item: PENDING → FULFILLED | PENDING → REJECTED
--   FULFILLED: stock.quantity and stock.reserved_quantity both decrease
--   REJECTED:  stock.reserved_quantity decreases; stock.quantity unchanged
CREATE TABLE IF NOT EXISTS sales_order_items (
    item_id      INT AUTO_INCREMENT PRIMARY KEY,
    order_id     INT            NOT NULL,
    product_id   INT            NOT NULL,
    quantity     INT            NOT NULL,
    unit_price   DECIMAL(10, 2) NOT NULL,
    warehouse_id INT            NOT NULL,
    status       VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (order_id)     REFERENCES sales_orders(order_id),
    FOREIGN KEY (product_id)   REFERENCES product(product_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id)
);