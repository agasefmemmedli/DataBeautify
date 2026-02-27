SELECT
    id AS uid,
    first_name AS fname,
    last_name AS lname,
    email AS email
FROM users;

UPDATE users
SET
    status = 'active',
    last_login = NOW(),
    login_count = login_count + 1
WHERE id = 123;

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Broken SQL (should still format partially)
SELECT * FROM orders WHERE id = ;
