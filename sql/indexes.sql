
CREATE INDEX IF NOT EXISTS idx_medicamento_titular     ON medicamento(titular_id);
CREATE INDEX IF NOT EXISTS idx_medicamento_principio   ON medicamento(principioactivo_id);
CREATE INDEX IF NOT EXISTS idx_medicamento_atc         ON medicamento(atc_code);
CREATE INDEX IF NOT EXISTS idx_medicamento_estado      ON medicamento(estado_regulatorio_final);
CREATE INDEX IF NOT EXISTS idx_medicamento_segmento    ON medicamento(segmento_mercado);
CREATE INDEX IF NOT EXISTS idx_simulacion_riesgo       ON simulacion_mercado(riesgo_regulatorio);
CREATE INDEX IF NOT EXISTS idx_tiempo_expedicion       ON tiempo(fechaexpedicion);
CREATE INDEX IF NOT EXISTS idx_clasificacion_categoria ON clasificacion_atc(categoria_atc);
