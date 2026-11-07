CREATE OR REPLACE PACKAGE pkg_orders AUTHID DEFINER AS
  /* Public API for orders */
  c_version CONSTANT VARCHAR2(10) := '1.4.0';
  e_not_found EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_not_found, -20404);

  TYPE t_order_rec IS RECORD (id orders.id%TYPE, total NUMBER(12, 2));
  TYPE t_order_tab IS TABLE OF t_order_rec;

  FUNCTION order_total(p_order_id IN orders.id%TYPE) RETURN NUMBER RESULT_CACHE;
  PROCEDURE close_old_orders(p_days IN PLS_INTEGER DEFAULT 30);
  PROCEDURE sync_customers;
  PROCEDURE purge(p_table IN VARCHAR2);
  FUNCTION big_orders(p_min IN NUMBER) RETURN t_order_tab PIPELINED;
END pkg_orders;
/
