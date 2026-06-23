-- ============================================================
-- Tablas de autenticación y auditoría
-- Ejecutar: psql -d xy_pharma -f sql/ddl_users.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario (
  usuario_id    SERIAL       PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  edad          SMALLINT     NOT NULL CHECK (edad BETWEEN 1 AND 120),
  rol           VARCHAR(20)  NOT NULL DEFAULT 'viewer'
                             CHECK (rol IN ('admin', 'viewer')),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id     SERIAL      PRIMARY KEY,
  usuario_id INT         REFERENCES usuario(usuario_id) ON DELETE CASCADE,
  accion     VARCHAR(50) NOT NULL,
  detalle    TEXT,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts      ON audit_log(ts);
