"""ETL loader: reads Excel, transforms, and idempotently upserts into PostgreSQL.

Usage:
    python -m etl.loader --excel data/CO_medicamentos_aprobados.xlsx
    python -m etl.loader --truncate-and-load
    python -m etl.loader --validate-only
"""
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from etl.transformers import clean, split_entities

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_EXCEL = PROJECT_ROOT / "data" / "CO_medicamentos_aprobados.xlsx"

INSERT_ORDER = [
    "principio_activo", "titular", "clasificacion_atc", "tiempo", "medicamento",
]

PK_COLUMNS = {
    "principio_activo":   "principioactivo_id",
    "titular":            "titular_id",
    "clasificacion_atc":  "atc_code",
    "tiempo":             "fecha_id",
    "medicamento":        "registrosanitario",
}


def get_engine():
    url = (
        f"postgresql+psycopg2://{os.getenv('PG_USER')}:{os.getenv('PG_PASSWORD')}"
        f"@{os.getenv('PG_HOST', 'localhost')}:{os.getenv('PG_PORT', '5432')}"
        f"/{os.getenv('PG_DB')}"
    )
    return create_engine(url, future=True)


def read_excel(path: Path) -> pd.DataFrame:
    print(f"[ETL] Reading {path}...")
    df = pd.read_excel(path, sheet_name=0)
    print(f"[ETL] {len(df)} rows x {len(df.columns)} cols read.")
    return df


def upsert(engine, table: str, df: pd.DataFrame, pk: str) -> int:
    """Idempotent insert: ON CONFLICT DO NOTHING (catalogs) or DO UPDATE (medicamento/satellites)."""
    if df.empty:
        return 0
    df = df.where(pd.notna(df), None)
    cols = list(df.columns)
    placeholders = ", ".join(f":{c}" for c in cols)
    col_list = ", ".join(cols)
    update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != pk)
    sql = (
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ({pk}) DO UPDATE SET {update_clause}"
        if update_clause else
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ({pk}) DO NOTHING"
    )
    n = 0
    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(text(sql), row.to_dict())
            n += 1
    print(f"[ETL] {table}: upserted {n} rows")
    return n


def truncate_all(engine):
    print("[ETL] Truncating all tables...")
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE medicamento, tiempo, clasificacion_atc, titular, principio_activo "
            "RESTART IDENTITY CASCADE"
        ))


def validate(engine):
    print("\n[ETL] Validating counts:")
    with engine.connect() as conn:
        for t in INSERT_ORDER:
            n = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar_one()
            print(f"  {t:<22} {n:>6}")


def run(excel_path: Path, truncate: bool = False, validate_only: bool = False):
    engine = get_engine()
    if validate_only:
        validate(engine)
        return

    if truncate:
        truncate_all(engine)

    raw = read_excel(excel_path)
    df = clean(raw)
    print(f"[ETL] After clean: {len(df)} rows kept.")
    entities = split_entities(df)

    for table in INSERT_ORDER:
        upsert(engine, table, entities[table], PK_COLUMNS[table])

    validate(engine)
    print("\n[ETL] Done.")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--excel", type=Path, default=DEFAULT_EXCEL)
    p.add_argument("--truncate-and-load", action="store_true")
    p.add_argument("--validate-only", action="store_true")
    args = p.parse_args()

    try:
        run(args.excel, truncate=args.truncate_and_load, validate_only=args.validate_only)
    except Exception as e:
        print(f"[ETL] ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
