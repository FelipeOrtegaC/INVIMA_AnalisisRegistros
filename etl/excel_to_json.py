"""Convert the Excel dataset to web/data.json (used by the static dashboard).

Usage: python -m etl.excel_to_json
"""
from __future__ import annotations
import json
import math
import re
from datetime import datetime, date
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "data" / "CO_medicamentos_aprobados.xlsx"
OUT  = ROOT / "web"  / "data.json"

WANTED = [
    "consecutivocum", "registrosanitario", "producto",
    "estadoregistro", "formafarmaceutica", "viaadministracion",
    "cantidad", "unidadmedida", "fechaexpedicion", "fechainactivo", "fechavencimiento",
    "principio_activo_normalizado", "titular_normalizado", "tipo_titular",
    "atc", "categoria_atc",
    "estado_regulatorio_final", "vigencia_registro", "es_vigente",
    "segmento_mercado", "tipo_producto_estimado",
    "stock_actual", "stock_minimo", "stock_maximo",
    "precio_referencia_cop", "costo_produccion_estimado",
    "demanda_mensual_estimada", "precio_proyectado",
    "participacion_mercado", "riesgo_regulatorio",
]


def is_formula(v): return isinstance(v, str) and v.startswith("=")


def parse_num(v):
    if v is None: return None
    if isinstance(v, (int, float)):
        return float(v) if not (isinstance(v, float) and math.isnan(v)) else None
    s = str(v).strip()
    if s in ("", "null") or is_formula(s): return None
    try: return float(s.replace(",", "."))
    except ValueError: return None


def parse_int(v):
    n = parse_num(v)
    return int(n) if n is not None else None


def parse_pct(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if s in ("", "null") or is_formula(s): return None
    try: return float(s.replace("%", "").strip())
    except ValueError: return None


def parse_str(v):
    if v is None: return None
    if isinstance(v, (datetime, date)): return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if s in ("", "null") or is_formula(s): return None
    return s


def parse_date(v):
    if v is None: return None
    if isinstance(v, (datetime, date)): return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if s in ("", "null") or is_formula(s): return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError: continue
    return None


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = list(rows[0])
    idx = {h: headers.index(h) for h in WANTED if h in headers}

    records = []
    for r in rows[1:]:
        if not r: continue
        rec = {}
        for col in WANTED:
            if col not in idx:
                rec[col] = None
                continue
            val = r[idx[col]]
            if col in ("fechaexpedicion", "fechainactivo", "fechavencimiento"):
                rec[col] = parse_date(val)
            elif col in ("cantidad", "precio_referencia_cop", "costo_produccion_estimado", "precio_proyectado"):
                rec[col] = parse_num(val)
            elif col in ("stock_actual", "stock_minimo", "stock_maximo",
                         "demanda_mensual_estimada", "consecutivocum"):
                rec[col] = parse_int(val)
            elif col == "participacion_mercado":
                rec[col] = parse_pct(val)
            else:
                rec[col] = parse_str(val)

        if rec.get("consecutivocum") is None or rec.get("producto") is None:
            continue

        rr = (rec.get("riesgo_regulatorio") or "").upper()
        rec["riesgo_regulatorio"] = rr if rr in ("BAJO", "MEDIO", "ALTO") else "MEDIO"
        erf = (rec.get("estado_regulatorio_final") or "").upper()
        rec["estado_regulatorio_final"] = erf if erf in ("ACTIVO", "INACTIVO", "REVISAR") else "REVISAR"
        records.append(rec)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(records)} records to {OUT} ({OUT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
