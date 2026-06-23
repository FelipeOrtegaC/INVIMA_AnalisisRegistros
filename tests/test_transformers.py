"""Smoke tests for the ETL transformation layer."""
import pandas as pd
from etl.transformers import clean, split_entities


def _sample():
    return pd.DataFrame([
        {
            "consecutivocum": 1, "registrosanitario": "INVIMA 2023M-001",
            "producto": "TEST DRUG", "estadoregistro": "Vigente",
            "formafarmaceutica": "TABLETA", "viaadministracion": "ORAL",
            "cantidad": "10,5", "unidadmedida": "mg",
            "fechaexpedicion": "2020-05-01", "fechainactivo": "null", "fechavencimiento": None,
            "principio_activo_normalizado": "PARACETAMOL", "titular_normalizado": "ACME LAB",
            "tipo_titular": "FABRICANTE", "atc": "N02BE01", "categoria_atc": "Sistema nervioso",
            "descripcionatc": "Paracetamol",
            "estado_regulatorio_final": "activo", "segmento_mercado": "LOCAL",
            "tipo_producto_estimado": "GENERICO",
            "stock_actual": 500, "stock_minimo": 50, "stock_maximo": 1000,
            "precio_referencia_cop": 25000, "costo_produccion_estimado": 8000,
            "demanda_mensual_estimada": 200, "precio_proyectado": 30000,
            "participacion_mercado": "5,5%", "riesgo_regulatorio": "bajo",
        },
        # Duplicate PK — should be dropped
        {
            "consecutivocum": 1, "registrosanitario": "DUP", "producto": "DUP",
            "principio_activo_normalizado": "PARACETAMOL", "titular_normalizado": "ACME LAB",
            "atc": "N02BE01", "estado_regulatorio_final": "ACTIVO", "riesgo_regulatorio": "BAJO",
        },
        # No PK — should be dropped
        {"consecutivocum": None, "producto": "ORPHAN"},
        # Invalid riesgo — should fall back to MEDIO
        {
            "consecutivocum": 2, "producto": "ANOTHER",
            "principio_activo_normalizado": "IBUPROFENO", "titular_normalizado": "OTRO LAB",
            "atc": "M01AE01", "estado_regulatorio_final": "FOO", "riesgo_regulatorio": "WRONG",
        },
    ])


def test_clean_drops_duplicates_and_missing_pk():
    df = clean(_sample())
    assert len(df) == 2
    assert set(df["consecutivocum"]) == {1, 2}


def test_clean_normalizes_domain_values():
    df = clean(_sample())
    row2 = df[df["consecutivocum"] == 2].iloc[0]
    assert row2["riesgo_regulatorio"] == "MEDIO"
    assert row2["estado_regulatorio_final"] == "REVISAR"


def test_clean_parses_numbers_and_percent():
    df = clean(_sample())
    row1 = df[df["consecutivocum"] == 1].iloc[0]
    assert row1["cantidad"] == 10.5
    assert row1["participacion_mercado"] == 5.5


def test_split_entities_produces_eight_tables():
    df = clean(_sample())
    out = split_entities(df)
    assert set(out.keys()) == {
        "principio_activo", "titular", "clasificacion_atc", "tiempo",
        "medicamento", "inventario", "costos_precios", "simulacion_mercado",
    }
    assert len(out["medicamento"]) == 2
    assert "titular_id" in out["medicamento"].columns
