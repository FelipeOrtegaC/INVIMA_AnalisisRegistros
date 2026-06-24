"""Smoke tests para la capa de transformación del ETL (datos reales del CUM)."""
import pandas as pd
from etl.transformers import clean, split_entities


def _sample():
    return pd.DataFrame([
        {
            "registrosanitario": "INVIMA 2023M-001", "producto": "TEST DRUG",
            "principio_activo": "PARACETAMOL", "titular": "ACME LAB",
            "fabricante": "ACME LAB", "importador": "", "segmento_mercado": "NACIONAL",
            "formafarmaceutica": "TABLETA", "viaadministracion": "ORAL",
            "concentracion": "A", "atc": "N02BE01", "descripcionatc": "PARACETAMOL",
            "categoria_atc": "Sistema nervioso",
            "fechaexpedicion": "2020-05-01", "fechavencimiento": "2030-05-01",
            "estado_regulatorio_final": "VIGENTE", "num_presentaciones": 3,
            "modalidad": "FABRICAR Y VENDER",
        },
        # Duplicado por registrosanitario — debe descartarse
        {
            "registrosanitario": "INVIMA 2023M-001", "producto": "DUP",
            "principio_activo": "PARACETAMOL", "titular": "ACME LAB",
            "atc": "N02BE01", "segmento_mercado": "NACIONAL", "num_presentaciones": 1,
        },
        # Sin registro sanitario — debe descartarse
        {"registrosanitario": None, "producto": "ORPHAN"},
        # Combinación de principios activos + importado
        {
            "registrosanitario": "INVIMA 2024M-002", "producto": "COMBO",
            "principio_activo": "IBUPROFENO + CAFEINA", "titular": "OTRO LAB",
            "importador": "IMPORTADORA SA", "segmento_mercado": "IMPORTADO",
            "atc": "M01AE01", "categoria_atc": "Sistema musculoesquelético",
            "fechaexpedicion": "2024-01-15", "num_presentaciones": 2,
        },
    ])


def test_clean_drops_duplicates_and_missing_pk():
    df = clean(_sample())
    assert len(df) == 2
    assert set(df["registrosanitario"]) == {"INVIMA 2023M-001", "INVIMA 2024M-002"}


def test_clean_parses_dates_and_ints():
    df = clean(_sample())
    row = df[df["registrosanitario"] == "INVIMA 2023M-001"].iloc[0]
    assert int(row["num_presentaciones"]) == 3
    assert pd.notna(row["fechaexpedicion"])


def test_split_entities_produces_five_tables():
    df = clean(_sample())
    out = split_entities(df)
    assert set(out.keys()) == {
        "principio_activo", "titular", "clasificacion_atc", "tiempo", "medicamento",
    }
    assert len(out["medicamento"]) == 2
    assert "titular_id" in out["medicamento"].columns
    # La combinación debe marcarse como es_combinacion_pa
    combo = out["principio_activo"]
    assert combo[combo["principio_activo_normalizado"] == "IBUPROFENO + CAFEINA"]["es_combinacion_pa"].iloc[0]
