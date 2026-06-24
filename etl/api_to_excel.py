"""
api_to_excel.py — Extracción EN VIVO del CUM (INVIMA) → Excel de consumo.

Reemplaza el snapshot estático (que mezclaba campos reales con campos
SIMULADOS de stock/costos/demanda) por datos **100% reales** consumidos de la
API de Datos Abiertos de Colombia, consolidados a nivel de **registro
sanitario** (la unidad de "aprobación").

Fuente (igual que extractors/co_approvals.py del proyecto RPI):
    GET https://www.datos.gov.co/resource/i7cb-raxc.json   (dataset base CUM)

El dataset trae una fila por CUM (presentación) y la repite por cada rol
(FABRICANTE / IMPORTADOR). Aquí se agrupa por `registrosanitario` —tal como lo
hace co_approvals.py— colapsando presentaciones y roles en un único registro
con solo columnas reales. NO se generan stock, costos, demanda ni riesgo.

Salida: data/CO_medicamentos_aprobados.xlsx  (el "excel de consumo" del ETL).
        Hace una copia de respaldo del Excel simulado previo la primera vez.

Uso:
    python -m etl.api_to_excel              # extrae y reescribe el Excel
    python -m etl.api_to_excel --max-rows 5000   # prueba rápida
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE

# ── Fuente ─────────────────────────────────────────────────────────────────────
DATASET_ID = "i7cb-raxc"
BASE_URL = f"https://www.datos.gov.co/resource/{DATASET_ID}.json"
PAGE = 1000
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}

# Solo las columnas reales que necesitamos de la API (reduce el payload).
API_FIELDS = [
    "registrosanitario", "producto", "principioactivo", "titular",
    "nombrerol", "tiporol", "formafarmaceutica", "viaadministracion",
    "concentracion", "atc", "descripcionatc", "fechaexpedicion",
    "fechavencimiento", "estadoregistro", "modalidad", "muestramedica",
    "consecutivocum", "expediente",
]

# ── Esquema final consolidado (la "referencia final" — solo columnas reales) ────
COLUMNS = [
    "registrosanitario", "producto", "principio_activo", "titular",
    "fabricante", "importador", "segmento_mercado",
    "formafarmaceutica", "viaadministracion", "concentracion",
    "atc", "descripcionatc", "categoria_atc",
    "fechaexpedicion", "fechavencimiento",
    "estado_regulatorio_final", "es_vigente", "dias_para_vencer",
    "num_presentaciones", "modalidad", "muestramedica", "expediente",
]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_XLSX = PROJECT_ROOT / "data" / "CO_medicamentos_aprobados.xlsx"
BACKUP_XLSX = PROJECT_ROOT / "data" / "CO_medicamentos_aprobados_SIMULADO.bak.xlsx"

# Grupo anatómico principal ATC (primer carácter del código).
ATC_L1 = {
    "A": "Tracto alimentario y metabolismo",
    "B": "Sangre y órganos hematopoyéticos",
    "C": "Sistema cardiovascular",
    "D": "Dermatológicos",
    "G": "Genitourinario y hormonas sexuales",
    "H": "Hormonas sistémicas (excl. sexuales)",
    "J": "Antiinfecciosos para uso sistémico",
    "L": "Antineoplásicos e inmunomoduladores",
    "M": "Sistema musculoesquelético",
    "N": "Sistema nervioso",
    "P": "Antiparasitarios e insecticidas",
    "R": "Sistema respiratorio",
    "S": "Órganos de los sentidos",
    "V": "Varios",
}


# ── HTTP con reintentos (urllib, equivalente a config.build_session) ───────────
def _get(url: str, retries: int = 3, backoff: float = 1.0):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(backoff * (2 ** attempt)); continue
            raise
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            if attempt < retries:
                time.sleep(backoff * (2 ** attempt)); continue
            raise
    if last:
        raise last


def fetch_all(max_rows: int | None = None) -> list[dict]:
    """Pagina la API y devuelve todas las filas CUM (solo API_FIELDS)."""
    select = ",".join(API_FIELDS)
    rows: list[dict] = []
    offset = 0
    t0 = time.time()
    while True:
        size = PAGE if max_rows is None else min(PAGE, max_rows - len(rows))
        if size <= 0:
            break
        params = {"$select": select, "$order": ":id", "$limit": size, "$offset": offset}
        url = BASE_URL + "?" + urllib.parse.urlencode(params)
        page = _get(url)
        if not isinstance(page, list) or not page:
            break
        rows.extend(page)
        offset += len(page)
        print(f"  …{len(rows):,} filas CUM descargadas".replace(",", "."),
              end="\r", flush=True)
        if len(page) < size:
            break
    print(f"\n  Descarga completa: {len(rows):,} filas en {time.time()-t0:.0f}s"
          .replace(",", "."))
    return rows


# ── Consolidación a nivel de registro sanitario ────────────────────────────────
def _clean(s) -> str:
    if s is None:
        return ""
    return ILLEGAL_CHARACTERS_RE.sub("", str(s)).strip()


def _date(s) -> str | None:
    s = _clean(s)
    if not s:
        return None
    # La API entrega ISO ("1999-12-20T00:00:00.000").
    return s[:10]


def _most_common(values) -> str:
    vals = [v for v in values if v]
    return Counter(vals).most_common(1)[0][0] if vals else ""


def consolidate(rows: list[dict]) -> list[dict]:
    """Agrupa filas CUM por registrosanitario -> un registro real por aprobación."""
    groups: dict[str, list[dict]] = {}
    for r in rows:
        reg = _clean(r.get("registrosanitario"))
        if not reg:
            continue
        groups.setdefault(reg, []).append(r)

    today = date.today()
    out: list[dict] = []
    for reg, items in groups.items():
        pas = sorted({_clean(i.get("principioactivo")).upper()
                      for i in items if _clean(i.get("principioactivo"))})
        roles = {_clean(i.get("tiporol")).upper() for i in items}
        fab = next((_clean(i.get("nombrerol")) for i in items
                    if _clean(i.get("tiporol")).upper() == "FABRICANTE"), "")
        imp = next((_clean(i.get("nombrerol")) for i in items
                    if _clean(i.get("tiporol")).upper() == "IMPORTADOR"), "")
        atc = _most_common([_clean(i.get("atc")) for i in items])
        fechas_exp = sorted(d for d in (_date(i.get("fechaexpedicion")) for i in items) if d)
        fechas_ven = sorted(d for d in (_date(i.get("fechavencimiento")) for i in items) if d)
        fexp = fechas_exp[0] if fechas_exp else None
        fven = fechas_ven[-1] if fechas_ven else None

        dias = None
        if fven:
            try:
                dias = (datetime.strptime(fven, "%Y-%m-%d").date() - today).days
            except ValueError:
                dias = None

        presentaciones = len({_clean(i.get("consecutivocum")) for i in items
                              if _clean(i.get("consecutivocum"))})

        out.append({
            "registrosanitario": reg,
            "producto": _most_common([_clean(i.get("producto")) for i in items]),
            "principio_activo": " + ".join(pas) if pas else "",
            "titular": _most_common([_clean(i.get("titular")).upper() for i in items]),
            "fabricante": fab,
            "importador": imp,
            "segmento_mercado": "IMPORTADO" if "IMPORTADOR" in roles else "NACIONAL",
            "formafarmaceutica": _most_common([_clean(i.get("formafarmaceutica")) for i in items]),
            "viaadministracion": _most_common([_clean(i.get("viaadministracion")) for i in items]),
            "concentracion": _most_common([_clean(i.get("concentracion")) for i in items]),
            "atc": atc,
            "descripcionatc": _most_common([_clean(i.get("descripcionatc")) for i in items]),
            "categoria_atc": ATC_L1.get(atc[:1].upper(), "Sin clasificar") if atc else "Sin clasificar",
            "fechaexpedicion": fexp,
            "fechavencimiento": fven,
            "estado_regulatorio_final": "VIGENTE",  # el feed i7cb-raxc es solo vigentes
            "es_vigente": True,
            "dias_para_vencer": dias,
            "num_presentaciones": presentaciones,
            "modalidad": _most_common([_clean(i.get("modalidad")) for i in items]),
            "muestramedica": "Si" if any(_clean(i.get("muestramedica")).lower() == "si"
                                         for i in items) else "No",
            "expediente": _clean(items[0].get("expediente")),
        })

    out.sort(key=lambda r: (r["fechaexpedicion"] or "", r["registrosanitario"]), reverse=True)
    print(f"  Consolidados: {len(out):,} registros sanitarios".replace(",", "."))
    return out


# ── Escritura del Excel de consumo ─────────────────────────────────────────────
def write_excel(records: list[dict], path: Path = OUT_XLSX) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Respaldo único del Excel simulado previo (no destruimos el original).
    if path.exists() and not BACKUP_XLSX.exists():
        shutil.copy2(path, BACKUP_XLSX)
        print(f"  Respaldo del Excel previo -> {BACKUP_XLSX.name}")

    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet("medicamentos")
    ws.freeze_panes = "A2"
    ws.append(COLUMNS)
    for r in records:
        ws.append([r.get(c) for c in COLUMNS])
    wb.save(path)
    print(f"  Excel escrito -> {path}  ({path.stat().st_size/1024:.0f} KB)")


def refresh(max_rows: int | None = None) -> int:
    print("=" * 70)
    print("API -> Excel de consumo · CUM/INVIMA (solo columnas reales)")
    print("=" * 70)
    rows = fetch_all(max_rows)
    records = consolidate(rows)
    write_excel(records)
    return len(records)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Extrae el CUM de la API y reescribe el Excel de consumo.")
    ap.add_argument("--max-rows", type=int, default=None, help="Tope de filas CUM (prueba).")
    args = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        n = refresh(args.max_rows)
    except Exception as exc:  # noqa: BLE001
        print(f"\n[ERROR] {exc}", file=sys.stderr)
        return 1
    print(f"  OK · {n} registros sanitarios consolidados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
