# Regulatory Intelligence OneView · Colombia

**XY Pharma · Proyecto académico — Bases de Datos Avanzadas**
**Autor:** Felipe Ortega

Tablero web one-page que consolida en una sola vista la **inteligencia regulatoria** del portafolio de medicamentos aprobados por **INVIMA** para el mercado colombiano. Los datos se consumen **en vivo desde la API de Datos Abiertos** (dataset CUM `i7cb-raxc` en datos.gov.co), se consolidan por registro sanitario (~9.655 aprobaciones reales) y alimentan un modelo relacional normalizado de 5 entidades en PostgreSQL.

> **Solo datos reales.** Se eliminaron los campos simulados de stock / costos / demanda / riesgo que existían en el snapshot de prueba; el dashboard ahora analiza únicamente las columnas que entrega la API (titulares, principios activos, ATC, formas, vías, fechas de expedición/vencimiento, nacional vs importado).

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

# 2. (opcional) Configurar credenciales de PostgreSQL
cp .env.example .env            # edita .env con tus datos de PostgreSQL

# 3. Extraer los datos REALES desde la API del CUM (INVIMA)
python -m etl.api_to_excel      # API -> data/CO_medicamentos_aprobados.xlsx
python -m etl.excel_to_json     # Excel -> web/data.json (alimenta el dashboard)

# 4. (opcional · solo si usas PostgreSQL) Crear BD, tablas y cargar
createdb xy_pharma
psql -d xy_pharma -f sql/ddl.sql
psql -d xy_pharma -f sql/indexes.sql
psql -d xy_pharma -f sql/seed_queries.sql
psql -d xy_pharma -f sql/ddl_users.sql   # tablas de usuarios y auditoría
python -m etl.loader --truncate-and-load

# 5. Arrancar el servidor
python app_server.py
# abre http://localhost:8050
```

> 🔄 **Refresco automático:** `app_server.py` ejecuta el paso 3 **antes de servir** la web
> si `web/data.json` no existe o tiene más de 24 h (configurable con `REFRESH_ON_START`
> y `REFRESH_MAX_AGE_HOURS`). Así el dashboard siempre parte de datos frescos de la API.

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

## 🧬 Modelo de datos (5 entidades)

| Tabla | PK | Tipo | Relación |
|---|---|---|---|
| `principio_activo` | `principioactivo_id` | Catálogo | 1:N con medicamento |
| `titular` | `titular_id` | Catálogo | 1:N con medicamento |
| `clasificacion_atc` | `atc_code` | Catálogo | 1:N con medicamento |
| `tiempo` | `fecha_id` | Catálogo | 1:N con medicamento |
| `medicamento` | `registrosanitario` | Hecho central | — |

> Las 3 tablas satélite (`inventario`, `costos_precios`, `simulacion_mercado`) se **eliminaron**: contenían únicamente datos simulados de prueba.

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

- Fuente: **INVIMA** — Código Único de Medicamentos (CUM), API Socrata `i7cb-raxc` en datos.gov.co (en vivo).
- Volumen bruto: ~157.000 filas CUM → consolidadas a **~9.655 registros sanitarios** (una fila por aprobación).
- **Solo columnas reales** de la API (sin stock/costos/demanda/riesgo simulados). Campos derivados de forma fiable: `segmento_mercado` (rol FABRICANTE→Nacional / IMPORTADOR→Importado), `categoria_atc` (nivel 1 del ATC), `num_presentaciones` (CUM por registro), `dias_para_vencer`.
- El snapshot simulado previo se conserva como respaldo en `data/CO_medicamentos_aprobados_SIMULADO.bak.xlsx`.

---

## 👤 Crédito

**Felipe Ortega** — Operational Specialist · Bayer
Proyecto académico · Maestría en Bases de Datos Avanzadas · 2026
