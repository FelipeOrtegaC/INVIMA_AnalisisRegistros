
DROP TABLE IF EXISTS simulacion_mercado CASCADE;
DROP TABLE IF EXISTS costos_precios     CASCADE;
DROP TABLE IF EXISTS inventario         CASCADE;
DROP TABLE IF EXISTS medicamento        CASCADE;
DROP TABLE IF EXISTS tiempo             CASCADE;
DROP TABLE IF EXISTS clasificacion_atc  CASCADE;
DROP TABLE IF EXISTS titular            CASCADE;
DROP TABLE IF EXISTS principio_activo   CASCADE;


CREATE TABLE principio_activo (
  principioactivo_id   SERIAL PRIMARY KEY,
  principio_activo_normalizado VARCHAR(255) NOT NULL UNIQUE,
  es_combinacion_pa    BOOLEAN DEFAULT FALSE
);


CREATE TABLE titular (
  titular_id           SERIAL PRIMARY KEY,
  titular_normalizado  VARCHAR(255) NOT NULL UNIQUE,
  tipo_titular         VARCHAR(50) CHECK (tipo_titular IN ('FABRICANTE','IMPORTADOR','OTRO'))
);


CREATE TABLE clasificacion_atc (
  atc_code             VARCHAR(20) PRIMARY KEY,
  descripcion_atc      TEXT,
  categoria_atc        VARCHAR(80)
);


CREATE TABLE tiempo (
  fecha_id             SERIAL PRIMARY KEY,
  fechaexpedicion      DATE,
  fechainactivo        DATE,
  fechavencimiento     DATE,
  UNIQUE (fechaexpedicion, fechainactivo, fechavencimiento)
);


CREATE TABLE medicamento (
  consecutivocum               BIGINT PRIMARY KEY,
  registrosanitario            VARCHAR(80),
  producto                     VARCHAR(255) NOT NULL,
  estadoregistro               VARCHAR(30),
  formafarmaceutica            VARCHAR(120),
  viaadministracion            VARCHAR(80),
  cantidad                     NUMERIC(12,3),
  unidadmedida                 VARCHAR(20),
  estado_regulatorio_final     VARCHAR(30),
  segmento_mercado             VARCHAR(30),
  tipo_producto_estimado       VARCHAR(30),
  titular_id                   INT NOT NULL
      REFERENCES titular(titular_id)         ON UPDATE CASCADE ON DELETE RESTRICT,
  principioactivo_id           INT NOT NULL
      REFERENCES principio_activo(principioactivo_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  atc_code                     VARCHAR(20)
      REFERENCES clasificacion_atc(atc_code) ON UPDATE CASCADE ON DELETE SET NULL,
  fecha_id                     INT
      REFERENCES tiempo(fecha_id)            ON UPDATE CASCADE ON DELETE SET NULL
);


CREATE TABLE inventario (
  inventario_id        SERIAL PRIMARY KEY,
  consecutivocum       BIGINT NOT NULL UNIQUE
      REFERENCES medicamento(consecutivocum) ON UPDATE CASCADE ON DELETE CASCADE,
  stock_actual         INT CHECK (stock_actual >= 0),
  stock_minimo         INT CHECK (stock_minimo >= 0),
  stock_maximo         INT CHECK (stock_maximo >= 0)
);


CREATE TABLE costos_precios (
  costo_id                  SERIAL PRIMARY KEY,
  consecutivocum            BIGINT NOT NULL UNIQUE
      REFERENCES medicamento(consecutivocum) ON UPDATE CASCADE ON DELETE CASCADE,
  precio_referencia_cop     NUMERIC(14,2),
  costo_produccion_estimado NUMERIC(14,2),
  precio_proyectado         NUMERIC(14,2)
);


CREATE TABLE simulacion_mercado (
  simulacion_id              SERIAL PRIMARY KEY,
  consecutivocum             BIGINT NOT NULL UNIQUE
      REFERENCES medicamento(consecutivocum) ON UPDATE CASCADE ON DELETE CASCADE,
  demanda_mensual_estimada   INT CHECK (demanda_mensual_estimada >= 0),
  participacion_mercado      NUMERIC(6,3),
  riesgo_regulatorio         VARCHAR(10) CHECK (riesgo_regulatorio IN ('BAJO','MEDIO','ALTO'))
);
