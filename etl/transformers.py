from __future__ import annotations
import pandas as pd

# Columnas reales del Excel de consumo (producido por etl.api_to_excel desde la
# API del CUM). Ya NO hay stock/costos/demanda/riesgo simulados.
WANTED_COLUMNS = [
    "registrosanitario", "producto", "principio_activo", "titular",
    "fabricante", "importador", "segmento_mercado",
    "formafarmaceutica", "viaadministracion", "concentracion",
    "atc", "descripcionatc", "categoria_atc",
    "fechaexpedicion", "fechavencimiento",
    "estado_regulatorio_final", "num_presentaciones", "modalidad",
]


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Limpia el Excel real: strip de strings, nulos, fechas y enteros."""
    df = df.copy()
    cols = [c for c in WANTED_COLUMNS if c in df.columns]
    df = df[cols].copy()

    df = df.replace({"null": pd.NA, "NaN": pd.NA, "": pd.NA, None: pd.NA})

    str_cols = ["registrosanitario", "producto", "principio_activo", "titular",
                "fabricante", "importador", "segmento_mercado", "formafarmaceutica",
                "viaadministracion", "concentracion", "atc", "descripcionatc",
                "categoria_atc", "estado_regulatorio_final", "modalidad"]
    for c in str_cols:
        if c in df.columns:
            df[c] = df[c].astype("string").str.strip()

    for c in ("fechaexpedicion", "fechavencimiento"):
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce")

    if "num_presentaciones" in df.columns:
        df["num_presentaciones"] = pd.to_numeric(df["num_presentaciones"], errors="coerce").astype("Int64")

    # registro sanitario es la clave natural; sin él no hay registro.
    df = df.dropna(subset=["registrosanitario", "producto"])
    df = df.drop_duplicates(subset=["registrosanitario"], keep="first")
    return df.reset_index(drop=True)


def split_entities(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Divide el dataframe limpio en 5 entidades normalizadas con FKs.

    Modelo (solo datos reales):
        principio_activo, titular, clasificacion_atc, tiempo  (catálogos)
        medicamento (hecho central, PK = registrosanitario)
    """
    pa = df[["principio_activo"]].dropna().drop_duplicates().reset_index(drop=True)
    pa.insert(0, "principioactivo_id", pa.index + 1)
    pa = pa.rename(columns={"principio_activo": "principio_activo_normalizado"})
    pa["es_combinacion_pa"] = pa["principio_activo_normalizado"].str.contains(r"\+", regex=True, na=False)

    tit = df[["titular"]].dropna().drop_duplicates().reset_index(drop=True)
    tit.insert(0, "titular_id", tit.index + 1)
    tit = tit.rename(columns={"titular": "titular_normalizado"})

    atc = df[["atc", "descripcionatc", "categoria_atc"]].dropna(subset=["atc"]) \
            .drop_duplicates(subset=["atc"]).reset_index(drop=True)
    atc = atc.rename(columns={"atc": "atc_code", "descripcionatc": "descripcion_atc"})

    tiempo = df[["fechaexpedicion", "fechavencimiento"]].drop_duplicates().reset_index(drop=True)
    tiempo.insert(0, "fecha_id", tiempo.index + 1)

    # Mapear FKs sobre medicamento
    m = df.merge(pa.rename(columns={"principio_activo_normalizado": "principio_activo"})
                   [["principioactivo_id", "principio_activo"]], on="principio_activo", how="left")
    m = m.merge(tit.rename(columns={"titular_normalizado": "titular"})[["titular_id", "titular"]],
                on="titular", how="left")
    m = m.merge(atc[["atc_code"]].rename(columns={"atc_code": "atc"}), on="atc", how="left")
    m = m.merge(tiempo, on=["fechaexpedicion", "fechavencimiento"], how="left")

    medicamento = m[[
        "registrosanitario", "producto", "formafarmaceutica", "viaadministracion",
        "concentracion", "segmento_mercado", "fabricante", "importador",
        "num_presentaciones", "modalidad", "estado_regulatorio_final",
        "titular_id", "principioactivo_id", "atc", "fecha_id",
    ]].rename(columns={"atc": "atc_code"})

    return {
        "principio_activo":  pa,
        "titular":           tit,
        "clasificacion_atc": atc,
        "tiempo":            tiempo,
        "medicamento":       medicamento,
    }
