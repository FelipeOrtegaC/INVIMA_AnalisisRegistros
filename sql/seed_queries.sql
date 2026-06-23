CREATE OR REPLACE VIEW vw_medicamento_full AS
SELECT
  m.consecutivocum, m.registrosanitario, m.producto,
  m.estadoregistro, m.formafarmaceutica, m.viaadministracion,
  m.cantidad, m.unidadmedida,
  m.estado_regulatorio_final, m.segmento_mercado, m.tipo_producto_estimado,
  pa.principio_activo_normalizado,
  t.titular_normalizado, t.tipo_titular,
  c.atc_code AS atc, c.descripcion_atc, c.categoria_atc,
  ti.fechaexpedicion, ti.fechainactivo, ti.fechavencimiento,
  inv.stock_actual, inv.stock_minimo, inv.stock_maximo,
  cp.precio_referencia_cop, cp.costo_produccion_estimado, cp.precio_proyectado,
  sm.demanda_mensual_estimada, sm.participacion_mercado, sm.riesgo_regulatorio
FROM medicamento m
JOIN principio_activo  pa  ON pa.principioactivo_id = m.principioactivo_id
JOIN titular           t   ON t.titular_id          = m.titular_id
LEFT JOIN clasificacion_atc c ON c.atc_code = m.atc_code
LEFT JOIN tiempo       ti  ON ti.fecha_id = m.fecha_id
LEFT JOIN inventario   inv ON inv.consecutivocum = m.consecutivocum
LEFT JOIN costos_precios cp ON cp.consecutivocum = m.consecutivocum
LEFT JOIN simulacion_mercado sm ON sm.consecutivocum = m.consecutivocum;

