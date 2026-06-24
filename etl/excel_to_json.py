"""Convierte el Excel de consumo (real, API) a web/data.json para el dashboard.

El Excel lo produce `etl.api_to_excel` a partir de la API del CUM (INVIMA),
consolidado por registro sanitario y SOLO con columnas reales (sin stock,
costos, demanda ni riesgo simulados).

Uso: python -m etl.excel_to_json
"""
from __future__ import annotations
import json
from datetime import datetime, date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "CO_medicamentos_aprobados.xlsx"
OUT = ROOT / "web" / "data.json"

# Esquema final (idéntico a etl.api_to_excel.COLUMNS).
STR_COLS = {
    "registrosanitario", "producto", "principio_activo", "titular",
    "fabricante", "importador", "segmento_mercado", "formafarmaceutica",
    "viaadministracion", "concentracion", "atc", "descripcionatc",
    "categoria_atc", "estado_regulatorio_final", "modalidad", "muestramedica",
    "expediente",
}
DATE_COLS = {"fechaexpedicion", "fechavencimiento"}
INT_COLS = {"dias_para_vencer", "num_presentaciones"}
BOOL_COLS = {"es_vigente"}


def _s(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    return s or None


def _i(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    headers = list(next(rows))
    idx = {h: i for i, h in enumerate(headers)}

    records = []
    for r in rows:
        if not r:
            continue
        rec = {}
        for col, i in idx.items():
            val = r[i]
            if col in DATE_COLS:
                rec[col] = _s(val)
            elif col in INT_COLS:
                rec[col] = _i(val)
            elif col in BOOL_COLS:
                rec[col] = bool(val) if val not in (None, "") else None
            else:
                rec[col] = _s(val)
        if not rec.get("registrosanitario") or not rec.get("producto"):
            continue
        records.append(rec)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"Escritos {len(records)} registros en {OUT} ({OUT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
