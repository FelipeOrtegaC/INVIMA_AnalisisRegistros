from __future__ import annotations
import re
import pandas as pd

WANTED_COLUMNS = [
    "consecutivocum", "registrosanitario", "producto",
    "estadoregistro", "formafarmaceutica", "viaadministracion",
    "cantidad", "unidadmedida",
    "fechaexpedicion", "fechainactivo", "fechavencimiento",
    "principio_activo_normalizado", "titular_normalizado", "tipo_titular",
    "atc", "categoria_atc", "descripcionatc",
    "estado_regulatorio_final", "segmento_mercado", "tipo_producto_estimado",
    "stock_actual", "stock_minimo", "stock_maximo",
    "precio_referencia_cop", "costo_produccion_estimado",
    "demanda_mensual_estimada", "precio_proyectado",
    "participacion_mercado", "riesgo_regulatorio",
]


def _strip_formula(v):
    """Drop unevaluated Excel formulas."""
    if isinstance(v, str) and v.startswith("="):
        return None
    return v


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw Excel input: strip strings, normalize nulls, parse dates and numbers."""
    df = df.copy()
    cols = [c for c in WANTED_COLUMNS if c in df.columns]
    df = df[cols].copy()

    for c in df.select_dtypes(include="object").columns:
        df[c] = df[c].map(_strip_formula)

    df = df.replace({"null": pd.NA, "NaN": pd.NA, "": pd.NA, None: pd.NA})

    str_cols = ["producto", "registrosanitario", "estadoregistro", "formafarmaceutica",
                "viaadministracion", "unidadmedida", "principio_activo_normalizado",
                "titular_normalizado", "tipo_titular", "atc", "categoria_atc",
                "descripcionatc", "estado_regulatorio_final", "segmento_mercado",
                "tipo_producto_estimado", "riesgo_regulatorio"]
    for c in str_cols:
        if c in df.columns:
            df[c] = df[c].astype("string").str.strip()

    # Dates
    for c in ("fechaexpedicion", "fechainactivo", "fechavencimiento"):
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce")

    # Numerics
    num_cols = ["cantidad", "precio_referencia_cop", "costo_produccion_estimado",
                "precio_proyectado", "participacion_mercado"]
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c].astype("string").str.replace("%", "", regex=False)
                                  .str.replace(",", ".", regex=False), errors="coerce")

    int_cols = ["consecutivocum", "stock_actual", "stock_minimo", "stock_maximo",
                "demanda_mensual_estimada"]
    for c in int_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")

    # Domain normalization
    if "riesgo_regulatorio" in df.columns:
        df["riesgo_regulatorio"] = df["riesgo_regulatorio"].str.upper()
        df.loc[~df["riesgo_regulatorio"].isin(["BAJO", "MEDIO", "ALTO"]), "riesgo_regulatorio"] = "MEDIO"

    if "estado_regulatorio_final" in df.columns:
        df["estado_regulatorio_final"] = df["estado_regulatorio_final"].str.upper()
        df.loc[~df["estado_regulatorio_final"].isin(["ACTIVO", "INACTIVO", "REVISAR"]),
               "estado_regulatorio_final"] = "REVISAR"

    # Drop rows without PK
    df = df.dropna(subset=["consecutivocum", "producto"])
    df = df.drop_duplicates(subset=["consecutivocum"], keep="first")
    return df.reset_index(drop=True)


def split_entities(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Split the cleaned wide dataframe into 8 entity-aligned dataframes with FKs."""
    # Catalogs with surrogate PKs assigned via factorize
    pa = df[["principio_activo_normalizado"]].dropna().drop_duplicates().reset_index(drop=True)
    pa.insert(0, "principioactivo_id", pa.index + 1)
    pa["es_combinacion_pa"] = pa["principio_activo_normalizado"].str.contains(r"[+.]", regex=True, na=False)

    tit = df[["titular_normalizado", "tipo_titular"]].dropna(subset=["titular_normalizado"]).drop_duplicates(subset=["titular_normalizado"]).reset_index(drop=True)
    tit.insert(0, "titular_id", tit.index + 1)

    atc = df[["atc", "descripcionatc", "categoria_atc"]].dropna(subset=["atc"]).drop_duplicates(subset=["atc"]).reset_index(drop=True)
    atc = atc.rename(columns={"atc": "atc_code", "descripcionatc": "descripcion_atc"})

    tiempo = df[["fechaexpedicion", "fechainactivo", "fechavencimiento"]].drop_duplicates().reset_index(drop=True)
    tiempo.insert(0, "fecha_id", tiempo.index + 1)

    # Map FKs onto medicamento
    df = df.merge(pa[["principioactivo_id", "principio_activo_normalizado"]], on="principio_activo_normalizado", how="left")
    df = df.merge(tit[["titular_id", "titular_normalizado"]], on="titular_normalizado", how="left")
    df = df.merge(atc[["atc_code"]].rename(columns={"atc_code": "atc"}), on="atc", how="left")
    df = df.merge(tiempo, on=["fechaexpedicion", "fechainactivo", "fechavencimiento"], how="left")

    medicamento = df[[
        "consecutivocum", "registrosanitario", "producto", "estadoregistro",
        "formafarmaceutica", "viaadministracion", "cantidad", "unidadmedida",
        "estado_regulatorio_final", "segmento_mercado", "tipo_producto_estimado",
        "titular_id", "principioactivo_id", "atc", "fecha_id",
    ]].rename(columns={"atc": "atc_code"})

    inventario = df[["consecutivocum", "stock_actual", "stock_minimo", "stock_maximo"]].copy()
    costos    = df[["consecutivocum", "precio_referencia_cop",
                     "costo_produccion_estimado", "precio_proyectado"]].copy()
    sim       = df[["consecutivocum", "demanda_mensual_estimada",
                     "participacion_mercado", "riesgo_regulatorio"]].copy()

    return {
        "principio_activo":   pa,
        "titular":            tit,
        "clasificacion_atc":  atc,
        "tiempo":             tiempo,
        "medicamento":        medicamento,
        "inventario":         inventario,
        "costos_precios":     costos,
        "simulacion_mercado": sim,
    }
