-- Monthly revenue report
WITH monthly AS (
  SELECT date_trunc('month', o.created_at) AS month, c.region, SUM(oi.qty * oi.price) AS revenue
  FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN customers c ON c.id = o.customer_id
  WHERE o.status <> 'CANCELLED' AND o.created_at >= DATE '2026-01-01'
  GROUP BY 1, 2
)
SELECT month, region, revenue,
       revenue - LAG(revenue) OVER (PARTITION BY region ORDER BY month) AS delta,
       CASE WHEN revenue > 100000 THEN 'high' WHEN revenue > 10000 THEN 'mid' ELSE 'low' END AS bucket
FROM monthly
ORDER BY month, region;

/* Customers without orders */
SELECT c.id, c.name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
  AND c.email LIKE '%@example.com';

UPDATE customers SET name = TRIM(name), email = LOWER(email) WHERE email <> LOWER(email);

DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;

INSERT INTO tags (name, color) VALUES ('urgent', '#ff0000'), ('later', '#cccccc');
