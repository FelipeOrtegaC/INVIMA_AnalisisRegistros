-- ============================================================
-- Modelo relacional · solo datos REALES del CUM (INVIMA)
-- 5 entidades: 4 catálogos + medicamento (PK = registrosanitario)
-- Ejecutar: psql -d xy_pharma -f sql/ddl.sql
-- ============================================================

DROP TABLE IF EXISTS medicamento        CASCADE;
DROP TABLE IF EXISTS tiempo             CASCADE;
DROP TABLE IF EXISTS clasificacion_atc  CASCADE;
DROP TABLE IF EXISTS titular            CASCADE;
DROP TABLE IF EXISTS principio_activo   CASCADE;


CREATE TABLE principio_activo (
  principioactivo_id   SERIAL PRIMARY KEY,
  principio_activo_normalizado VARCHAR(500) NOT NULL UNIQUE,
  es_combinacion_pa    BOOLEAN DEFAULT FALSE
);


CREATE TABLE titular (
  titular_id           SERIAL PRIMARY KEY,
  titular_normalizado  VARCHAR(255) NOT NULL UNIQUE
);


CREATE TABLE clasificacion_atc (
  atc_code             VARCHAR(20) PRIMARY KEY,
  descripcion_atc      TEXT,
  categoria_atc        VARCHAR(80)
);


CREATE TABLE tiempo (
  fecha_id             SERIAL PRIMARY KEY,
  fechaexpedicion      DATE,
  fechavencimiento     DATE,
  UNIQUE (fechaexpedicion, fechavencimiento)
);


CREATE TABLE medicamento (
  registrosanitario            VARCHAR(80) PRIMARY KEY,
  producto                     VARCHAR(300) NOT NULL,
  formafarmaceutica            VARCHAR(160),
  viaadministracion            VARCHAR(120),
  concentracion                VARCHAR(40),
  segmento_mercado             VARCHAR(20) CHECK (segmento_mercado IN ('NACIONAL','IMPORTADO')),
  fabricante                   VARCHAR(255),
  importador                   VARCHAR(255),
  num_presentaciones           INT CHECK (num_presentaciones >= 0),
  modalidad                    VARCHAR(120),
  estado_regulatorio_final     VARCHAR(30),
  titular_id                   INT NOT NULL
      REFERENCES titular(titular_id)                  ON UPDATE CASCADE ON DELETE RESTRICT,
  principioactivo_id           INT NOT NULL
      REFERENCES principio_activo(principioactivo_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  atc_code                     VARCHAR(20)
      REFERENCES clasificacion_atc(atc_code)          ON UPDATE CASCADE ON DELETE SET NULL,
  fecha_id                     INT
      REFERENCES tiempo(fecha_id)                     ON UPDATE CASCADE ON DELETE SET NULL
);
