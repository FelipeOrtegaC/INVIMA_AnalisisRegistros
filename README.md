# Regulatory Intelligence OneView · Colombia

**XY Pharma · Proyecto académico — Bases de Datos Avanzadas**
**Autor:** Felipe Ortega

Tablero web one-page que consolida en una sola vista el estado regulatorio, comercial y operativo del portafolio de medicamentos aprobados por **INVIMA** para el mercado colombiano. Construido sobre un modelo relacional normalizado de 8 entidades en PostgreSQL, alimentado por un dataset enriquecido de 1.100 registros.

---

## 🧱 Arquitectura

```
┌────────────────┐    ┌────────────────┐    ┌──────────────────────────┐
│  Excel (raw)   │───►│  ETL (Python)  │───►│  PostgreSQL              │
└────────────────┘    └────────────────┘    │  ├─ 8 tablas farmacéuticas│
                              │             │  ├─ usuario               │
                              ▼             │  └─ audit_log             │
                      ┌──────────────┐     └──────────────┬───────────┘
                      │  data.json   │                     │
                      │  (snapshot)  │                     │
                      └──────┬───────┘                     │
                             │                             │
                             ▼                             ▼
                  ┌─────────────────────────────────────────────────┐
                  │  Flask (app_server.py)                          │
                  │  ├─ Sirve web/ como archivos estáticos          │
                  │  └─ /api/auth (register, login, logout, me)     │
                  └───────────────────────┬─────────────────────────┘
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │  Dashboard HTML + JS   │
                             │  (Plotly · vanilla)    │
                             │  + Modal de login      │
                             └────────────────────────┘
```

- **Frontend:** `web/` → HTML + CSS + JS + Plotly (CDN). Sin build, sin Node.
- **Backend:** `app_server.py` (Flask) → autenticación con sesiones + sirve archivos estáticos.
- **Datos farmacéuticos:** `sql/` (DDL, índices, vistas) + `etl/` (pobla PostgreSQL).
- **Usuarios:** tabla `usuario` + `audit_log` en PostgreSQL; contraseñas en bcrypt.
- **Consola CRUD:** embebida en el dashboard, opera sobre el snapshot en memoria.

---

## 🚀 Quickstart — Visual Studio Code

### Opción A — Servidor Flask completo (recomendado, incluye autenticación)

```bash
# 1. Crear entorno virtual e instalar dependencias
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux
pip install -r requirements.txt

# 2. Configurar credenciales
cp .env.example .env            # edita .env con tus datos de PostgreSQL

# 3. Crear base de datos y tablas
createdb xy_pharma
psql -d xy_pharma -f sql/ddl.sql
psql -d xy_pharma -f sql/indexes.sql
psql -d xy_pharma -f sql/seed_queries.sql
psql -d xy_pharma -f sql/ddl_users.sql   # tablas de usuarios y auditoría

# 4. Cargar datos
python -m etl.loader --truncate-and-load

# 5. Arrancar el servidor
python app_server.py
# abre http://localhost:8050
```

### Opción B — Solo dashboard (sin PostgreSQL, sin autenticación)

> La consola CRUD sigue funcionando (sobre datos en memoria); la autenticación se omite automáticamente cuando el servidor Flask no está disponible.

1. Abre la carpeta del proyecto en VS Code.
2. Instala la extensión **Live Server** de Ritwick Dey.
3. Click derecho sobre `web/index.html` → **Open with Live Server**.

Alternativa sin extensión:

```bash
cd web
python -m http.server 8000
# abre http://localhost:8000
```

> ⚠️ No abras `index.html` directamente con doble clic — `fetch('data.json')` requiere protocolo http.

### Opción C — Solo regenerar el JSON

```bash
python -m etl.excel_to_json
```

---

## 🗂️ Estructura del proyecto

```
xy_pharma_dashboard/
├── plan.md                       # Plan de implementación detallado
├── README.md                     # Este archivo
├── requirements.txt
├── .env.example
├── app_server.py                 # Servidor Flask (auth + estáticos)
├── .vscode/
│   ├── settings.json
│   └── launch.json
├── sql/
│   ├── ddl.sql                   # 8 tablas farmacéuticas + FKs
│   ├── ddl_users.sql             # Tablas usuario + audit_log
│   ├── indexes.sql
│   └── seed_queries.sql          # vw_medicamento_full + queries de referencia
├── etl/
│   ├── transformers.py           # Funciones puras (clean, normalize, split)
│   ├── loader.py                 # ETL Excel → PostgreSQL (idempotente)
│   └── excel_to_json.py          # Excel → data.json para la web
├── data/
│   └── CO_medicamentos_aprobados.xlsx
└── web/
    ├── index.html                # Layout one-page + modal de login + CRUD console
    ├── data.json                 # Snapshot del dataset farmacéutico
    └── assets/
        ├── styles.css            # Sistema de diseño + estilos modal auth
        └── app.js                # Plotly + filtros + CRUD + auth flow
```

---

## 📊 Componentes del dashboard

| Bloque | Descripción |
|---|---|
| **Header / KPI Strip** | Total medicamentos, % Vigentes, Riesgo Alto, Avg Precio, Stock total, Demanda mensual |
| **Filtros (sidebar)** | ATC, Titular, Tipo Producto, Estado, Vía, Segmento — reactivos |
| **Regulatory Health** | Matriz horizontal: % Activo, % Inactivo, % Alto Riesgo |
| **Economic Simulation** | 4 tarjetas: precio, costo, proyectado, margen — con Δ vs media |
| **Demanda vs Stock** | Combinado barras + línea (top 20 productos) |
| **Top Productos** | Tabla compacta con 🔴🟡🟢 de riesgo |
| **Top Titulares** | Barras horizontales (top 10) |
| **Demanda Temporal** | Columnas agrupadas por año + línea de precio |
| **Inventory Efficiency** | Días de inventario (`stock / (demanda/30)`) |
| **Scatter Riesgo** ⭐ | Stock × Demanda · Size = market share · Color = riesgo |
| **Consola CRUD** | Tab dedicado: SELECT / INSERT / UPDATE / DELETE con SQL visible |

---

## 🧬 Modelo de datos (8 entidades)

| Tabla | PK | Tipo | Relación |
|---|---|---|---|
| `principio_activo` | `principioactivo_id` | Catálogo | 1:N con medicamento |
| `titular` | `titular_id` | Catálogo | 1:N con medicamento |
| `clasificacion_atc` | `atc_code` | Catálogo | 1:N con medicamento |
| `tiempo` | `fecha_id` | Catálogo | 1:N con medicamento |
| `medicamento` | `consecutivocum` | Hecho central | — |
| `inventario` | `inventario_id` | Satélite | 1:1 con medicamento |
| `costos_precios` | `costo_id` | Satélite | 1:1 con medicamento |
| `simulacion_mercado` | `simulacion_id` | Satélite | 1:1 con medicamento |

Ver `sql/ddl.sql` para el DDL completo con CHECK, FK y políticas `ON UPDATE/DELETE`.

---

## 🎨 Sistema de diseño

| Token | Valor |
|---|---|
| Pharma Blue | `#1E5AA8` |
| Positive | `#3FB57F` |
| Risk | `#D64545` |
| Warning | `#E8B547` |
| Background | `#F5F7FA` |
| Surface | `#FFFFFF` |
| Font | Inter / system-ui |
| Radius | 12 px |

---

## 🧪 Pruebas

```bash
pytest tests/
```

(Casos cubiertos: ETL idempotente, integridad referencial CRUD, KPIs vs `COUNT(*)`.)

---

## 📦 Dataset

- Fuente: **INVIMA** — Registros Sanitarios CUM (open data).
- Volumen: 1.100 medicamentos aprobados en Colombia.
- 12 columnas originales + 15 columnas derivadas/simuladas (stock, costos, demanda, riesgo).

---

## 👤 Crédito

**Felipe Ortega** — Operational Specialist · Bayer
Proyecto académico · Maestría en Bases de Datos Avanzadas · 2026
