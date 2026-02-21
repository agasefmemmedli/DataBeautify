-- Complex SQL Test for Deep Formatting

-- CTE and Window Functions
WITH regional_sales AS (
    SELECT
        region,
        SUM(amount) AS total_sales
    FROM orders
    WHERE order_date BETWEEN '2023-01-01' AND '2023-12-31'
    GROUP BY region
), top_regions AS (
    SELECT
        region
    FROM regional_sales
    WHERE total_sales > (SELECT AVG(total_sales) FROM regional_sales)
)
SELECT
    r.region,
    r.total_sales,
    RANK() OVER (ORDER BY r.total_sales DESC) as sales_rank
FROM regional_sales r
JOIN top_regions tr ON r.region = tr.region;

-- Create Table with constraints
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'banned')),
    metadata JSONB
);

-- Complex Select with Case, Joins and Subqueries
SELECT
    u.id,
    u.username,
    COUNT(o.id) AS order_count,
    CASE
        WHEN COUNT(o.id) > 10 THEN 'VIP'
        WHEN COUNT(o.id) > 5 THEN 'Regular'
        ELSE 'New'
    END AS customer_segment,
    COALESCE(SUM(o.amount), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'completed'
WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
AND EXISTS (
    SELECT 1
    FROM log_logins l
    WHERE l.user_id = u.id
    AND l.login_date > '2024-01-01'
)
GROUP BY u.id, u.username
HAVING total_spent > 100
ORDER BY total_spent DESC, order_count DESC
LIMIT 50;

-- Insert into
INSERT INTO audit_logs (
    user_id,
    action,
    details
)
VALUES
    (1, 'login', '{"ip": "127.0.0.1"}'),
    (2, 'logout', NULL);

-- Nested set operations
SELECT id FROM current_users
UNION ALL
(SELECT id FROM archived_users WHERE archive_date > '2023-01-01'
 INTERSECT
 SELECT id FROM temporary_users);

-- New Test Case for Alignment
SELECT
    user_id as uid,
    first_name as fname,
    last_name as lname,
    email_address as email
FROM users
WHERE
    status = 'active'
    AND
    created_at > '2023-01-01';
