SET SERVEROUTPUT ON SIZE UNLIMITED
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
PROMPT Creating objects for &&app_schema

CREATE TABLE audit_events (
  id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type VARCHAR2(30) NOT NULL,
  payload CLOB CHECK (payload IS JSON),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX audit_events_type_ix ON audit_events (event_type, created_at);

CREATE OR REPLACE TYPE address_t AS OBJECT (street VARCHAR2(100), city VARCHAR2(50), zip VARCHAR2(10));
/

CREATE OR REPLACE TRIGGER audit_events_bi
BEFORE INSERT ON audit_events FOR EACH ROW
WHEN (new.event_type IS NOT NULL)
BEGIN
  :new.event_type := UPPER(:new.event_type);
  IF :new.created_at IS NULL THEN :new.created_at := SYSTIMESTAMP; END IF;
END;
/

DECLARE
  l_count PLS_INTEGER;
BEGIN
  SELECT COUNT(*) INTO l_count FROM user_tables WHERE table_name = 'AUDIT_EVENTS';
  DBMS_OUTPUT.PUT_LINE('Tables: ' || l_count);
  FOR r IN (SELECT event_type, COUNT(*) cnt FROM audit_events GROUP BY event_type ORDER BY cnt DESC) LOOP
    DBMS_OUTPUT.PUT_LINE(RPAD(r.event_type, 30) || r.cnt);
  END LOOP;
  WHILE l_count > 0 LOOP
    l_count := l_count - 1;
    EXIT WHEN l_count < 5;
  END LOOP;
  EXECUTE IMMEDIATE 'ANALYZE TABLE audit_events COMPUTE STATISTICS';
END;
/

INSERT INTO audit_events (event_type, payload) VALUES ('deploy', '{"version": "1.4.0", "user": "it''s me"}');
COMMIT;

SELECT e.event_type, TO_CHAR(e.created_at, 'YYYY-MM-DD HH24:MI') AS created, x.version
FROM audit_events e, JSON_TABLE(e.payload, '$' COLUMNS (version VARCHAR2(20) PATH '$.version')) x
WHERE e.created_at > SYSDATE - INTERVAL '1' DAY
ORDER BY e.created_at DESC
FETCH FIRST 10 ROWS ONLY;

SPOOL OFF
EXIT
