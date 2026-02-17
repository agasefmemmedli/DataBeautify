select id, name, email from users where id > 10 and status = 'active' order by created_at desc;

insert into orders (user_id, product_id, quantity) values (1, 101, 2);

update products set price = 99.99 where id = 101;

delete from log_table where created_at < '2023-01-01';

create table if not exists items (
id int primary key,
name varchar(255) not null,
description text,
price decimal(10,2) default 0.00
);

select u.name, o.order_date
from users u
join orders o on u.id = o.user_id
where o.status = 'shipped'
and o.order_date > (
select max(order_date) from archive_orders
);
