-- Vista que reconstruye el registro completo uniendo las 5 entidades reales.
CREATE OR REPLACE VIEW vw_medicamento_full AS
SELECT
  m.registrosanitario, m.producto,
  m.formafarmaceutica, m.viaadministracion, m.concentracion,
  m.segmento_mercado, m.fabricante, m.importador,
  m.num_presentaciones, m.modalidad, m.estado_regulatorio_final,
  pa.principio_activo_normalizado,
  t.titular_normalizado,
  c.atc_code AS atc, c.descripcion_atc, c.categoria_atc,
  ti.fechaexpedicion, ti.fechavencimiento
FROM medicamento m
JOIN principio_activo  pa  ON pa.principioactivo_id = m.principioactivo_id
JOIN titular           t   ON t.titular_id          = m.titular_id
LEFT JOIN clasificacion_atc c ON c.atc_code = m.atc_code
LEFT JOIN tiempo       ti  ON ti.fecha_id = m.fecha_id;
