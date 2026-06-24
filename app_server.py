"""
app_server.py — Servidor Flask para Regulatory Intelligence OneView
Sirve el frontend estático de web/ y expone endpoints de autenticación.

Arranque: python app_server.py
Requiere: .env con PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD, SECRET_KEY
"""

import os
import re
import secrets
from datetime import datetime

import bcrypt as _bcrypt
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, session
from sqlalchemy import text


class pw:
    @staticmethod
    def hash(password: str) -> str:
        return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

    @staticmethod
    def verify(password: str, hashed: str) -> bool:
        return _bcrypt.checkpw(password.encode(), hashed.encode())

load_dotenv()

# ── Flask ────────────────────────────────────────────────────────────────────
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
app = Flask(__name__, static_folder=WEB_DIR, static_url_path="")
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# ── Database ─────────────────────────────────────────────────────────────────
from etl.loader import get_engine  # reuse existing engine factory

_engine = None


def engine():
    global _engine
    if _engine is None:
        _engine = get_engine()
    return _engine


# ── Validation helpers ────────────────────────────────────────────────────────
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_USER_RE  = re.compile(r"^[a-zA-Z0-9_]{3,50}$")


def validate_register(data: dict) -> list[str]:
    errors = []
    username = (data.get("username") or "").strip()
    email    = (data.get("email")    or "").strip()
    password = data.get("password", "")
    nombre   = (data.get("nombre")   or "").strip()
    edad_raw = data.get("edad")
    rol      = (data.get("rol")      or "").strip()

    if not _USER_RE.match(username):
        errors.append("username: debe tener 3–50 caracteres alfanuméricos o guión bajo.")

    if not _EMAIL_RE.match(email):
        errors.append("email: formato inválido.")

    if len(password) < 8:
        errors.append("password: mínimo 8 caracteres.")
    elif not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        errors.append("password: debe contener al menos una letra y un número.")

    if len(nombre) < 2 or len(nombre) > 100:
        errors.append("nombre: debe tener entre 2 y 100 caracteres.")

    try:
        edad = int(edad_raw)
        if not (1 <= edad <= 120):
            raise ValueError
    except (TypeError, ValueError):
        errors.append("edad: debe ser un número entero entre 1 y 120.")

    if rol not in ("admin", "viewer"):
        errors.append("rol: debe ser 'admin' o 'viewer'.")

    return errors


# ── Auth endpoints ────────────────────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    errors = validate_register(data)
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    username = data["username"].strip()
    email    = data["email"].strip().lower()
    nombre   = data["nombre"].strip()
    edad     = int(data["edad"])
    rol      = data["rol"].strip()
    pw_hash  = pw.hash(data["password"])

    try:
        with engine().begin() as conn:
            # ── Transaction: INSERT usuario + INSERT audit_log ──────────────
            result = conn.execute(
                text("""
                    INSERT INTO usuario (username, email, password_hash, nombre, edad, rol)
                    VALUES (:u, :e, :ph, :n, :edad, :rol)
                    RETURNING usuario_id, created_at
                """),
                dict(u=username, e=email, ph=pw_hash, n=nombre, edad=edad, rol=rol),
            )
            row = result.fetchone()
            conn.execute(
                text("""
                    INSERT INTO audit_log (usuario_id, accion, detalle)
                    VALUES (:uid, 'REGISTER', :det)
                """),
                dict(uid=row.usuario_id, det=f"Nuevo usuario '{username}' registrado."),
            )
            # ── End transaction ─────────────────────────────────────────────
        session["usuario_id"] = row.usuario_id
        session["username"]   = username
        session["nombre"]     = nombre
        session["rol"]        = rol
        return jsonify({"ok": True, "username": username, "nombre": nombre, "rol": rol}), 201

    except Exception as exc:
        msg = str(exc)
        if "username" in msg:
            return jsonify({"ok": False, "errors": ["username: ese nombre de usuario ya existe."]}), 409
        if "email" in msg:
            return jsonify({"ok": False, "errors": ["email: ese correo ya está registrado."]}), 409
        return jsonify({"ok": False, "errors": ["Error interno. Intenta de nuevo."]}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"ok": False, "errors": ["Usuario y contraseña son requeridos."]}), 400

    try:
        with engine().connect() as conn:
            result = conn.execute(
                text("SELECT usuario_id, username, nombre, rol, password_hash, activo FROM usuario WHERE username = :u"),
                dict(u=username),
            )
            row = result.fetchone()
    except Exception:
        return jsonify({"ok": False, "errors": ["Error de conexión con la base de datos."]}), 500

    if row is None or not pw.verify(password, row.password_hash):
        return jsonify({"ok": False, "errors": ["Usuario o contraseña incorrectos."]}), 401

    if not row.activo:
        return jsonify({"ok": False, "errors": ["Cuenta desactivada. Contacta al administrador."]}), 403

    with engine().begin() as conn:
        conn.execute(
            text("INSERT INTO audit_log (usuario_id, accion, detalle) VALUES (:uid, 'LOGIN', :det)"),
            dict(uid=row.usuario_id, det=f"Inicio de sesión."),
        )

    session["usuario_id"] = row.usuario_id
    session["username"]   = row.username
    session["nombre"]     = row.nombre
    session["rol"]        = row.rol
    return jsonify({"ok": True, "username": row.username, "nombre": row.nombre, "rol": row.rol})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    uid = session.get("usuario_id")
    if uid:
        try:
            with engine().begin() as conn:
                conn.execute(
                    text("INSERT INTO audit_log (usuario_id, accion) VALUES (:uid, 'LOGOUT')"),
                    dict(uid=uid),
                )
        except Exception:
            pass
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/auth/me", methods=["GET"])
def me():
    if "usuario_id" not in session:
        return jsonify({"ok": False}), 401
    return jsonify({
        "ok":       True,
        "username": session["username"],
        "nombre":   session["nombre"],
        "rol":      session["rol"],
    })


# ── Static frontend ───────────────────────────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_static(path):
    if path and os.path.exists(os.path.join(WEB_DIR, path)):
        return send_from_directory(WEB_DIR, path)
    return send_from_directory(WEB_DIR, "index.html")


# ── Refresco de datos desde la API (PREVIO a servir la web) ───────────────────
def ensure_data_fresh():
    """Antes de servir el dashboard, extrae el CUM desde la API y consolida
    web/data.json (la ruta que alimenta el dashboard). Usa una caché de frescura
    para no re-descargar en cada arranque.

    Controles por entorno:
        REFRESH_ON_START=false      -> nunca refresca, sirve lo que exista.
        REFRESH_MAX_AGE_HOURS=24    -> refresca si data.json es más viejo que esto
                                       (0 = forzar siempre).
    """
    import time
    data_json = os.path.join(WEB_DIR, "data.json")

    if os.getenv("REFRESH_ON_START", "true").lower() != "true":
        print("  [datos] REFRESH_ON_START=false -> sirvo data.json existente.")
        return

    max_age_h = float(os.getenv("REFRESH_MAX_AGE_HOURS", "24"))
    if os.path.exists(data_json):
        age_h = (time.time() - os.path.getmtime(data_json)) / 3600
        if age_h < max_age_h:
            print(f"  [datos] data.json fresco ({age_h:.1f} h) -> omito extracción "
                  f"(forzar: REFRESH_MAX_AGE_HOURS=0 o borra web/data.json).")
            return

    try:
        from etl import api_to_excel, excel_to_json
        print("  [datos] Extrayendo CUM desde la API (previo a servir la web)…")
        api_to_excel.refresh()      # API -> data/CO_medicamentos_aprobados.xlsx
        excel_to_json.main()        # Excel -> web/data.json
    except Exception as exc:  # noqa: BLE001
        print(f"  [datos] Aviso: no se pudo refrescar desde la API ({exc}). "
              f"Sirvo el data.json que haya.")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Evita ejecutar la extracción dos veces bajo el auto-reloader de Flask debug.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        ensure_data_fresh()

    port = int(os.getenv("PORT", 8050))
    debug = os.getenv("DASH_DEBUG", "true").lower() == "true"
    print(f"  Servidor corriendo en http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)