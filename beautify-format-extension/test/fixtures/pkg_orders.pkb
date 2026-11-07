CREATE OR REPLACE PACKAGE BODY pkg_orders AS
  -- Package state
  g_batch_size CONSTANT PLS_INTEGER := 500;
  TYPE t_id_tab IS TABLE OF orders.id%TYPE INDEX BY PLS_INTEGER;

  PROCEDURE log_msg(p_msg IN VARCHAR2, p_level IN VARCHAR2 DEFAULT 'INFO') IS
    PRAGMA AUTONOMOUS_TRANSACTION;
  BEGIN
    INSERT INTO app_log (ts, lvl, msg) VALUES (SYSTIMESTAMP, p_level, SUBSTR(p_msg, 1, 4000));
    COMMIT;
  END log_msg;

  FUNCTION order_total(p_order_id IN orders.id%TYPE) RETURN NUMBER
    RESULT_CACHE
  IS
    l_total NUMBER := 0;
  BEGIN
    SELECT NVL(SUM(oi.qty * oi.price), 0)
      INTO l_total
      FROM order_items oi
     WHERE oi.order_id = p_order_id;
    RETURN l_total;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN 0;
  END order_total;

  PROCEDURE close_old_orders(p_days IN PLS_INTEGER DEFAULT 30) IS
    l_ids t_id_tab;
    CURSOR c_old IS
      SELECT id FROM orders WHERE status = 'OPEN' AND created_at < SYSDATE - p_days FOR UPDATE SKIP LOCKED;
  BEGIN
    OPEN c_old;
    LOOP
      FETCH c_old BULK COLLECT INTO l_ids LIMIT g_batch_size;
      EXIT WHEN l_ids.COUNT = 0;
      FORALL i IN 1 .. l_ids.COUNT
        UPDATE orders SET status = 'CLOSED', closed_at = SYSDATE WHERE id = l_ids(i);
      log_msg('Closed ' || l_ids.COUNT || ' orders');
    END LOOP;
    CLOSE c_old;
  EXCEPTION
    WHEN OTHERS THEN
      IF c_old%ISOPEN THEN
        CLOSE c_old;
      END IF;
      log_msg(SQLERRM, 'ERROR');
      RAISE;
  END close_old_orders;

  PROCEDURE sync_customers IS
  BEGIN
    MERGE INTO customers c
    USING (SELECT id, name, email FROM staging_customers) s
    ON (c.id = s.id)
    WHEN MATCHED THEN UPDATE SET c.name = s.name, c.email = s.email
    WHEN NOT MATCHED THEN INSERT (id, name, email) VALUES (s.id, s.name, s.email);
  END;

  PROCEDURE purge(p_table IN VARCHAR2) IS
    l_sql VARCHAR2(400);
  BEGIN
    l_sql := q'[DELETE FROM ]' || DBMS_ASSERT.SQL_OBJECT_NAME(p_table) || q'[ WHERE created_at < :d]';
    EXECUTE IMMEDIATE l_sql USING ADD_MONTHS(SYSDATE, -12);
    <<retry>>
    FOR attempt IN 1 .. 3 LOOP
      BEGIN
        DBMS_STATS.GATHER_TABLE_STATS(ownname => USER, tabname => p_table, estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE, cascade => TRUE);
        EXIT retry;
      EXCEPTION
        WHEN OTHERS THEN
          CASE
            WHEN attempt < 3 THEN DBMS_SESSION.SLEEP(1);
            ELSE RAISE;
          END CASE;
      END;
    END LOOP;
  END purge;
END pkg_orders;
/
SHOW ERRORS
