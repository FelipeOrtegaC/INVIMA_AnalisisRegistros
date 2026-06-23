# Regulatory Intelligence OneView – Colombia

**Proyecto académico — Bases de Datos Avanzadas**
**Cliente simulado:** XY Pharma
**Autor:** Felipe Ortega
**Versión del plan:** 1.0
**Fecha:** 2026-05-26

---

## 1. Visión general y objetivos

### 1.1 Descripción del proyecto

**Regulatory Intelligence OneView – Colombia** es un tablero web one-page construido en Python que consolida, en una sola vista, el estado regulatorio, comercial y operativo (inventario, costos, demanda) del portafolio de medicamentos aprobados por **INVIMA** para el mercado colombiano. La aplicación se apoya en un modelo relacional normalizado de **8 entidades** sobre **PostgreSQL** y se alimenta de un dataset enriquecido (`CO_medicamentos_aprobados.xlsx`) con 1.100 registros y 53 columnas (12 campos fuente + 15 campos derivados/simulados + columnas auxiliares).

El sistema está dirigido a un **usuario administrativo/operativo general** (no experto farmacéutico). Toda la terminología, etiquetas y visualizaciones deben ser interpretables sin formación regulatoria previa.

### 1.2 Objetivos funcionales

1. **Consolidar** datos regulatorios, de inventario, costos y simulación de mercado en un modelo relacional normalizado.
2. **Visualizar** KPIs clave (salud regulatoria, simulación económica, demanda vs stock) en una sola página web.
3. **Permitir filtrado reactivo** por categoría ATC, titular, tipo de producto, estado regulatorio, vía de administración y segmento de mercado.
4. **Habilitar operaciones CRUD** y consultas parametrizadas sobre las 8 entidades a través de una consola embebida (para el profesor/evaluador).
5. **Identificar de forma inmediata** productos en riesgo regulatorio, situaciones de sobrestock/desabasto y oportunidades de margen.

### 1.3 Objetivos no funcionales

- **Rendimiento:** carga inicial < 3 s; respuesta a filtros < 500 ms.
- **Idempotencia ETL:** re-ejecutable sin duplicar registros.
- **Integridad referencial:** todas las FKs declaradas con `ON UPDATE CASCADE` / `ON DELETE RESTRICT`.
- **UX:** densidad visual baja, jerarquía clara, sin saturación de bordes ni grid.
- **Mantenibilidad:** separación estricta de capas (ETL / DB / queries / componentes UI / callbacks).
- **Reproducibilidad:** entorno declarado en `requirements.txt` + `.env.example`.

### 1.4 Alcance fuera del proyecto

- Autenticación multiusuario / roles (más allá de la consola CRUD libre para evaluación).
- Despliegue en producción (se entrega ejecutable local + instrucciones).
- Integración en vivo con APIs de INVIMA (se trabaja sobre el snapshot Excel).

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión sugerida | Justificación |
|---|---|---|---|
| Lenguaje | Python | 3.11+ | Compatibilidad con Dash 2.x y pandas 2.x |
| Base de datos | PostgreSQL | 15+ | Soporte robusto a integridad referencial e índices compuestos |
| Driver DB | psycopg2-binary | 2.9+ | Estándar de facto para PostgreSQL en Python |
| ORM ligero / SQL builder | SQLAlchemy (Core) | 2.0+ | Conexiones, transacciones, queries parametrizadas |
| ETL | pandas + openpyxl | 2.2+ / 3.1+ | Lectura de Excel y transformaciones tabulares |
| Frontend dashboard | **Plotly Dash** | 2.17+ | One-page reactivo, componentes ricos, integración nativa con Plotly |
| Gráficos | Plotly | 5.22+ | Interactividad nativa, paleta personalizable |
| Tablas interactivas | dash-ag-grid o dash_table | 31+ / 5+ | Tablas con sort/filter/export |
| Estilos | CSS custom + dash-bootstrap-components | 1.6+ | Grid responsivo y sistema de cards |
| Variables de entorno | python-dotenv | 1.0+ | Gestión de credenciales DB |
| Testing | pytest | 8+ | Estándar de Python |
| Linting | ruff | 0.4+ | Rápido y suficiente para el alcance académico |

---

## 3. Capa de datos: esquema relacional

### 3.1 Modelo entidad-relación (resumen narrativo)

El modelo gira en torno a la entidad central **`medicamento`** (PK = `consecutivocum`), que referencia a cuatro catálogos:

- **`principio_activo`** (1:N) — un principio activo puede estar en muchos medicamentos.
- **`titular`** (1:N) — un titular comercializa muchos medicamentos.
- **`clasificacion_atc`** (1:N) — un código ATC clasifica muchos medicamentos.
- **`tiempo`** (1:N) — denormaliza fechas (expedición, inactivación, vencimiento) para análisis temporal.

Y tres entidades satélite en relación **1:1** con `medicamento`:

- **`inventario`** — niveles de stock.
- **`costos_precios`** — economía del producto.
- **`simulacion_mercado`** — demanda, participación y riesgo simulados.

```
            ┌──────────────────┐  ┌──────────────────┐
            │ principio_activo │  │     titular      │
            └────────┬─────────┘  └────────┬─────────┘
                     │                     │
                     │                     │
┌──────────────────┐ │ ┌─────────────────┐ │ ┌──────────────────┐
│ clasificacion_atc├─┼─┤   medicamento   ├─┼─┤      tiempo      │
└──────────────────┘ │ │  (consecutivo   │ │ └──────────────────┘
                     └─┤      cum)       ├─┘
                       └────┬────────────┘
              ┌─────────────┼──────────────┐
              │             │              │
       ┌──────┴──────┐ ┌────┴─────┐ ┌──────┴──────────┐
       │ inventario  │ │ costos_  │ │ simulacion_     │
       │             │ │ precios  │ │ mercado         │
       └─────────────┘ └──────────┘ └─────────────────┘
```

### 3.2 DDL resumen (lo escribe `sql/ddl.sql`)

```sql
-- principio_activo
CREATE TABLE principio_activo (
  principioactivo_id SERIAL PRIMARY KEY,
  principio_activo_normalizado VARCHAR(255) NOT NULL UNIQUE,
  es_combinacion_pa BOOLEAN DEFAULT FALSE
);

-- titular
CREATE TABLE titular (
  titular_id SERIAL PRIMARY KEY,
  titular_normalizado VARCHAR(255) NOT NULL UNIQUE,
  tipo_titular VARCHAR(50) CHECK (tipo_titular IN ('FABRICANTE','IMPORTADOR','OTRO'))
);

-- clasificacion_atc
CREATE TABLE clasificacion_atc (
  atc_code VARCHAR(20) PRIMARY KEY,
  descripcion_atc TEXT,
  categoria_atc VARCHAR(80)
);

-- tiempo
CREATE TABLE tiempo (
  fecha_id SERIAL PRIMARY KEY,
  fechaexpedicion DATE,
  fechainactivo DATE,
  fechavencimiento DATE,
  UNIQUE (fechaexpedicion, fechainactivo, fechavencimiento)
);

-- medicamento (entidad central)
CREATE TABLE medicamento (
  consecutivocum BIGINT PRIMARY KEY,
  registrosanitario VARCHAR(80),
  producto VARCHAR(255) NOT NULL,
  estadoregistro VARCHAR(30),
  formafarmaceutica VARCHAR(120),
  viaadministracion VARCHAR(80),
  cantidad NUMERIC(12,3),
  unidadmedida VARCHAR(20),
  estado_regulatorio_final VARCHAR(30),
  segmento_mercado VARCHAR(30),
  tipo_producto_estimado VARCHAR(30),
  titular_id INT NOT NULL REFERENCES titular(titular_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  principioactivo_id INT NOT NULL REFERENCES principio_activo(principioactivo_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  atc_code VARCHAR(20) REFERENCES clasificacion_atc(atc_code)
      ON UPDATE CASCADE ON DELETE SET NULL,
  fecha_id INT REFERENCES tiempo(fecha_id)
      ON UPDATE CASCADE ON DELETE SET NULL
);

-- inventario (1:1 con medicamento)
CREATE TABLE inventario (
  inventario_id SERIAL PRIMARY KEY,
  consecutivocum BIGINT NOT NULL UNIQUE REFERENCES medicamento(consecutivocum)
      ON UPDATE CASCADE ON DELETE CASCADE,
  stock_actual INT CHECK (stock_actual >= 0),
  stock_minimo INT CHECK (stock_minimo >= 0),
  stock_maximo INT CHECK (stock_maximo >= 0)
);

-- costos_precios (1:1 con medicamento)
CREATE TABLE costos_precios (
  costo_id SERIAL PRIMARY KEY,
  consecutivocum BIGINT NOT NULL UNIQUE REFERENCES medicamento(consecutivocum)
      ON UPDATE CASCADE ON DELETE CASCADE,
  precio_referencia_cop NUMERIC(14,2),
  costo_produccion_estimado NUMERIC(14,2),
  precio_proyectado NUMERIC(14,2)
);

-- simulacion_mercado (1:1 con medicamento)
CREATE TABLE simulacion_mercado (
  simulacion_id SERIAL PRIMARY KEY,
  consecutivocum BIGINT NOT NULL UNIQUE REFERENCES medicamento(consecutivocum)
      ON UPDATE CASCADE ON DELETE CASCADE,
  demanda_mensual_estimada INT CHECK (demanda_mensual_estimada >= 0),
  participacion_mercado NUMERIC(6,3),
  riesgo_regulatorio VARCHAR(10) CHECK (riesgo_regulatorio IN ('BAJO','MEDIO','ALTO'))
);
```

### 3.3 Índices (`sql/indexes.sql`)

```sql
CREATE INDEX idx_medicamento_titular         ON medicamento(titular_id);
CREATE INDEX idx_medicamento_principio       ON medicamento(principioactivo_id);
CREATE INDEX idx_medicamento_atc             ON medicamento(atc_code);
CREATE INDEX idx_medicamento_estado          ON medicamento(estado_regulatorio_final);
CREATE INDEX idx_medicamento_segmento        ON medicamento(segmento_mercado);
CREATE INDEX idx_simulacion_riesgo           ON simulacion_mercado(riesgo_regulatorio);
CREATE INDEX idx_tiempo_expedicion           ON tiempo(fechaexpedicion);
CREATE INDEX idx_clasificacion_categoria     ON clasificacion_atc(categoria_atc);
```

### 3.4 Consultas semilla (`sql/seed_queries.sql`)

Vistas y queries reutilizables que la capa `app/queries.py` envuelve:

- `vw_medicamento_full` — JOIN de las 8 tablas (base de los gráficos).
- `q_kpi_header` — agregaciones del header.
- `q_top_productos` — ranking por demanda × precio.
- `q_top_titulares` — conteo y participación por titular.
- `q_demanda_vs_stock` — serie para el gráfico combinado.
- `q_scatter_riesgo` — dataset para el scatter diferenciador.

---

## 4. Pipeline ETL

### 4.1 Flujo (`etl/loader.py` + `etl/transformers.py`)

```
[ Excel ] → [ Read ] → [ Clean ] → [ Normalize ] → [ Split ] → [ Bulk Insert ] → [ Validate ]
```

### 4.2 Pasos detallados

1. **Read** (`loader.read_excel`) — `pandas.read_excel` sobre la hoja activa; selección de las 27 columnas relevantes ignorando columnas auxiliares de fórmula del Excel.
2. **Clean** (`transformers.clean`):
   - Strip de strings, `UPPER` selectivo en titulares y principios activos.
   - Reemplazo de literales `"null"`, `""`, `None` → `NaN`.
   - Parseo de fechas con `pd.to_datetime(errors='coerce')` para `fechaexpedicion`, `fechainactivo`, `fechavencimiento`.
   - Conversión numérica robusta de `cantidad`, `stock_*`, `precio_*`, `costo_*`, `demanda_*`.
   - Normalización de `participacion_mercado` (quitar `%`, dividir por 100, `float`).
3. **Normalize** (`transformers.normalize`):
   - Generar tablas catálogo `principio_activo`, `titular`, `clasificacion_atc`, `tiempo` con `drop_duplicates` sobre la clave natural.
   - Asignar PKs surrogate.
   - Mapear FKs en el DataFrame de `medicamento`.
4. **Split** (`transformers.split_entities`) — separar en 8 DataFrames alineados con las tablas destino.
5. **Bulk Insert** (`loader.bulk_insert`):
   - `INSERT ... ON CONFLICT (pk) DO UPDATE SET ...` (upsert) → idempotencia.
   - Orden de inserción respetando FKs: catálogos → `medicamento` → satélites.
   - Una sola transacción por entidad; rollback total ante error.
6. **Validate** (`loader.validate`):
   - Conteo por tabla vs conteo esperado.
   - Verificación de huérfanos (FK nulas no permitidas).
   - Log de filas descartadas con motivo.

### 4.3 Manejo de casos especiales

| Caso | Tratamiento |
|---|---|
| `fechainactivo = 'null'` o vacía | NaT en DataFrame, `NULL` en DB |
| `fechavencimiento` ausente y registro `Vigente` | NULL; el flag `vigencia_registro` ya viene resuelto |
| Titular con/sin sufijo `S.A.S.`, `LTDA.` | Se confía en `titular_normalizado` (ya normalizado en Excel) |
| Duplicados funcionales en `consecutivocum` | `drop_duplicates(keep='first')` con log de descartes |
| `precio_proyectado` o `participacion_mercado` faltantes | Imputar con mediana del `categoria_atc` correspondiente |
| `riesgo_regulatorio` fuera de {BAJO, MEDIO, ALTO} | Reclasificar a `MEDIO` con warning |

### 4.4 CLI del ETL

```bash
python -m etl.loader --excel data/CO_medicamentos_aprobados.xlsx --mode upsert
python -m etl.loader --validate-only
python -m etl.loader --truncate-and-load  # reset total (uso del evaluador)
```

---

## 5. Especificación del dashboard

### 5.1 Layout one-page (grid)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER · KPI Strip · fecha actualización · contexto              │
├───────────────┬───────────────────────────────────┬──────────────┤
│ FILTER PANEL  │      CORE ANALYTICS (Center)      │   RANKINGS   │
│ (izquierda    │  ┌─────────────────────────────┐  │ (derecha)    │
│  colapsable)  │  │ 1. Regulatory Health        │  │ ┌──────────┐ │
│               │  ├─────────────────────────────┤  │ │Top Prod. │ │
│               │  │ 2. Economic Simulation      │  │ └──────────┘ │
│               │  ├─────────────────────────────┤  │ ┌──────────┐ │
│               │  │ 3. Demanda vs Stock         │  │ │Top Titul.│ │
│               │  └─────────────────────────────┘  │ └──────────┘ │
├───────────────┴───────────────────────────────────┴──────────────┤
│ TRENDS & ADVANCED ANALYTICS (full-width)                         │
│   Demanda Temporal  │  Inventory Efficiency  │  Scatter Riesgo   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Header — KPI Strip

Fondo blanco, sin bordes pesados, micro-iconos a la izquierda de cada KPI.

| KPI | Cálculo | Formato |
|---|---|---|
| Total medicamentos | `COUNT(*)` filtrado | Entero |
| % Vigentes | `vigentes / total * 100` | `XX.X %` |
| Riesgo Alto | `COUNT(riesgo='ALTO')` | Entero con badge rojo |
| Avg Precio (COP) | `AVG(precio_referencia_cop)` | `$ XX.XXX` |
| Stock Total | `SUM(stock_actual)` | Entero abreviado (K/M) |
| Demanda mensual total | `SUM(demanda_mensual_estimada)` | Entero abreviado |

### 5.3 Filter Panel (sidebar izquierdo)

- Componente: `dbc.Offcanvas` colapsable o columna fija de 240 px.
- Filtros (todos `dcc.Dropdown` multi=True salvo el último):
  - Categoría ATC
  - Titular (con search)
  - Tipo de Producto (MARCA/INNOVADOR, GENERICO)
  - Estado Regulatorio (ACTIVO, INACTIVO, REVISAR)
  - Vía de Administración
  - Segmento de Mercado (IMPORTADO, LOCAL, MIXTO)
- Botón **Reset Filters** que limpia todos los `value` y dispara recálculo.
- Filtrado reactivo (un único `dcc.Store` con el dataset filtrado, consumido por todos los gráficos).

### 5.4 Core Analytics (centro)

#### Bloque 1 — Regulatory Health

- **Tipo:** matriz de barras horizontales (3 filas).
- **Métricas:** `% Activo`, `% Inactivo`, `% Alto Riesgo`.
- **Diseño:** sin ejes pesados, valor numérico al final de la barra, colores semánticos (verde / gris / rojo).

#### Bloque 2 — Economic Simulation

- **Tipo:** card row de 4 tarjetas.
- **Tarjetas:** Precio Referencia (avg), Costo Producción (avg), Precio Proyectado (avg), Margen Estimado (`(precio_proyectado - costo) / precio_proyectado`).
- **Variación:** delta vs media histórica con flecha ↑/↓ y color verde/rojo.

#### Bloque 3 — Demanda vs Stock

- **Tipo:** gráfico combinado (barras + línea) sobre eje categórico (top 20 medicamentos por demanda).
- **Series:** barras = `demanda_mensual_estimada`, línea = `stock_actual`.
- **Insight:** cruce entre series resalta sobrestock o desabasto.

### 5.5 Rankings (panel derecho)

#### Top Productos

- Tabla compacta (`dash_table.DataTable`) con columnas:
  - Producto, ATC, Precio (COP), Demanda, Market Share %, Riesgo (🔴 ALTO / 🟡 MEDIO / 🟢 BAJO).
- Ordenable por columna; paginación oculta (top 10 por defecto).

#### Top Titulares

- Bar chart horizontal: titular vs `# productos`, color secundario codifica `% participación promedio`.
- Limitado a top 10; tooltip muestra desglose ATC.

### 5.6 Trends & Advanced Analytics (full-width inferior)

#### Demanda Temporal

- Columnas agrupadas por mes (eje X = mes de `fechaexpedicion`).
- Series: Demanda, Stock, Precio (eje secundario para precio).

#### Inventory Efficiency

- Línea: `días de inventario = stock_actual / (demanda_mensual_estimada / 30)`.
- Línea de referencia horizontal en 30 días (umbral saludable).

#### Scatter Riesgo (DIFERENCIADOR)

- X = `stock_actual`, Y = `demanda_mensual_estimada`.
- Size = `participacion_mercado`.
- Color = `riesgo_regulatorio` (BAJO=verde, MEDIO=amarillo, ALTO=rojo).
- Hover label = `producto + titular + atc`.
- Cuadrantes ideales/críticos marcados con líneas discontinuas.

### 5.7 Sistema de diseño (UX/UI)

| Token | Valor |
|---|---|
| Primary (Pharma Blue) | `#1E5AA8` |
| Positive (Soft Green) | `#3FB57F` |
| Warning | `#E8B547` |
| Risk (Red) | `#D64545` |
| Background | `#F5F7FA` |
| Surface (cards) | `#FFFFFF` |
| Text Primary | `#1F2937` |
| Text Secondary | `#6B7280` |
| Font family | `Inter, system-ui, sans-serif` |
| KPI font-size | `28 px` / `weight 700` |
| Labels | `13 px` / `weight 500` |
| Body / tablas | `13 px` / `weight 400` |
| Card radius | `12 px` |
| Card shadow | `0 1px 3px rgba(0,0,0,0.06)` |
| Espaciado base | `8 px` (multiplos: 8, 16, 24, 32) |

Reglas:
- Sin bordes gruesos: separación por espacio y sombra ligera.
- Sin grid saturado en gráficos (líneas guía cada 25% del rango).
- Responsive desktop-first; breakpoint mínimo 1280 px (en < 1280 px las columnas colapsan a stack vertical).

---

## 6. Especificación de la consola CRUD

### 6.1 Acceso

- Tab/sección separada accesible desde el header (`/console` o tab `dcc.Tabs`).
- Sin autenticación (proyecto académico).

### 6.2 Funcionalidades por entidad

Para cada una de las 8 entidades (`medicamento`, `principio_activo`, `titular`, `clasificacion_atc`, `tiempo`, `inventario`, `costos_precios`, `simulacion_mercado`):

| Operación | Implementación |
|---|---|
| **CREATE** | Form dinámico generado a partir del esquema (input por columna, validación tipo/required) |
| **READ** | DataTable paginada con búsqueda global y filtro por columna |
| **UPDATE** | Selección de fila → modal con form prellenado → submit con `UPDATE ... WHERE pk = ...` |
| **DELETE** | Selección + botón con confirmación; bloquea si rompe FK (mensaje claro al usuario) |

### 6.3 Query Builder parametrizado

- Selector de tabla (8 opciones).
- Selector de columnas a proyectar (multi-select).
- Builder de cláusula `WHERE`: filas dinámicas con (columna · operador · valor). Operadores: `=`, `!=`, `>`, `>=`, `<`, `<=`, `LIKE`, `IN`, `IS NULL`, `IS NOT NULL`.
- `ORDER BY` y `LIMIT`.
- Render del SQL generado en read-only (educativo) antes de ejecutar.
- Resultados en DataTable con botón **Export CSV**.
- Todas las queries van vía `psycopg2` con bind parameters (no concatenación) para prevenir SQL injection incluso en contexto académico.

### 6.4 Validaciones

- Tipos coherentes con DDL (cast antes de submit).
- Required fields según `NOT NULL`.
- FK exists check antes de INSERT/UPDATE.
- CHECK constraints reflejados en el form (e.g., `riesgo_regulatorio` como dropdown {BAJO, MEDIO, ALTO}).

---

## 7. Plan de implementación archivo por archivo

### 7.1 Estructura del proyecto

```
xy_pharma_dashboard/
├── plan.md
├── requirements.txt
├── .env.example
├── README.md
├── sql/
│   ├── ddl.sql
│   ├── indexes.sql
│   └── seed_queries.sql
├── etl/
│   ├── __init__.py
│   ├── loader.py
│   └── transformers.py
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── layout.py
│   ├── callbacks.py
│   ├── crud.py
│   ├── queries.py
│   └── components/
│       ├── __init__.py
│       ├── header.py
│       ├── filters.py
│       ├── core_analytics.py
│       ├── rankings.py
│       ├── trends.py
│       └── crud_console.py
├── assets/
│   └── styles.css
├── data/
│   └── CO_medicamentos_aprobados.xlsx
└── tests/
    ├── test_etl.py
    ├── test_crud.py
    └── test_queries.py
```

### 7.2 Tareas archivo por archivo

#### Raíz

- **`requirements.txt`** — Fijar versiones del stack (sección 2). Incluir `dash`, `dash-bootstrap-components`, `plotly`, `pandas`, `openpyxl`, `psycopg2-binary`, `sqlalchemy`, `python-dotenv`, `pytest`, `ruff`.
- **`.env.example`** — `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASSWORD`, `EXCEL_PATH`, `DASH_DEBUG`.
- **`README.md`** — Quickstart en 5 pasos: crear DB → cargar DDL → correr ETL → `python -m app.main` → abrir `http://localhost:8050`. Incluir screenshot del dashboard y diagrama ER.

#### `sql/`

- **`ddl.sql`** — Implementar las 8 tablas exactas de la sección 3.2.
- **`indexes.sql`** — Implementar los índices de la sección 3.3.
- **`seed_queries.sql`** — Vistas y queries reutilizables (sección 3.4).

#### `etl/`

- **`transformers.py`** — Funciones puras `clean(df)`, `normalize(df)`, `split_entities(df) -> dict[str, DataFrame]`. Sin efectos secundarios; 100 % cubiertos por tests.
- **`loader.py`** — Conexión SQLAlchemy, `read_excel`, `bulk_insert(table, df)`, `validate()`, CLI con `argparse`. Modo `upsert` por defecto.

#### `app/`

- **`queries.py`** — Funciones tipadas que devuelven DataFrames a partir de SQL parametrizado (`get_kpi_header(filters)`, `get_top_productos(filters)`, etc.). Toda interacción con DB pasa por aquí.
- **`crud.py`** — Capa CRUD genérica (`insert(table, row)`, `update(table, pk_col, pk_val, row)`, `delete(table, pk_col, pk_val)`, `query_builder(table, projection, where, order, limit)`). Bind parameters obligatorio.
- **`layout.py`** — Composición del layout global: header + sidebar + grid central + rankings + bottom row + tab CRUD. Importa los componentes.
- **`callbacks.py`** — Todos los `@callback` del dashboard: filtros → store filtrado → callbacks de cada gráfico/tabla. CRUD callbacks separados (formularios → `crud.*`).
- **`main.py`** — Punto de entrada: crea `dash.Dash`, registra `layout`, importa `callbacks`, levanta `app.run_server`.

#### `app/components/`

- **`header.py`** — KPI strip; recibe dict de KPIs y renderiza 6 tarjetas planas.
- **`filters.py`** — Sidebar de filtros con dropdowns + reset button.
- **`core_analytics.py`** — Tres bloques: `regulatory_health()`, `economic_simulation()`, `demanda_vs_stock()`. Cada uno expone `figure()` y `component()`.
- **`rankings.py`** — `top_productos_table()` y `top_titulares_chart()`.
- **`trends.py`** — `demanda_temporal()`, `inventory_efficiency()`, `scatter_riesgo()`.
- **`crud_console.py`** — UI de la consola: selector de tabla, forms dinámicos, query builder, DataTable de resultados.

#### `assets/`

- **`styles.css`** — Tokens de diseño (sección 5.7) como variables CSS + clases de cards, KPIs, sidebar, tabs.

#### `tests/`

- **`test_etl.py`** — Casos: normalización de titular, parseo de fechas inválidas, idempotencia del upsert (correr 2 veces y verificar conteos).
- **`test_crud.py`** — Insert válido, insert con FK rota (debe fallar), update, delete con FK dependiente (debe fallar), delete cascade en satélites.
- **`test_queries.py`** — Cada función de `queries.py` retorna DataFrame con las columnas esperadas y sin nulos en KPIs.

---

## 8. Orden de dependencias (qué construir primero)

```
1. requirements.txt + .env.example         ← entorno
2. sql/ddl.sql + sql/indexes.sql           ← esquema en DB
3. etl/transformers.py                     ← lógica pura testeable
4. etl/loader.py + test_etl.py             ← carga validada
5. app/queries.py + sql/seed_queries.sql   ← capa de lectura
6. app/crud.py + test_crud.py              ← capa de escritura
7. assets/styles.css                       ← tokens de diseño
8. app/components/header.py                ← KPI strip (smoke test visual)
9. app/components/filters.py               ← sidebar reactivo
10. app/components/core_analytics.py       ← 3 bloques centrales
11. app/components/rankings.py             ← panel derecho
12. app/components/trends.py               ← fila inferior (incl. scatter)
13. app/components/crud_console.py         ← consola CRUD
14. app/layout.py + app/callbacks.py       ← composición + reactividad
15. app/main.py                            ← entry point
16. README.md + screenshots                ← entrega
```

**Regla de oro:** ningún componente del dashboard se construye antes de que el ETL haya poblado la DB y `app/queries.py` esté probado. Esto evita gastar tiempo maquetando con datos mock que luego no coincidan con el esquema final.

---

## 9. Estrategia de pruebas

### 9.1 Tipos de prueba

| Nivel | Herramienta | Cobertura objetivo |
|---|---|---|
| Unitarias (ETL puro) | pytest | 90 % de `transformers.py` |
| Integración (DB) | pytest + DB de prueba (`xy_pharma_test`) | Funciones de `crud.py` y `queries.py` |
| Smoke visual | Captura manual + checklist | Cada componente renderiza sin error |
| Regresión de carga | Conteo post-ETL vs baseline | Diferencia 0 entre ejecuciones idempotentes |

### 9.2 Casos críticos a cubrir

- ETL: cargar dos veces seguidas → mismos conteos por tabla.
- ETL: archivo con 5 % de fechas inválidas → no rompe, deja `NULL` y loggea.
- CRUD: borrar un `titular` con medicamentos asociados → falla con error claro.
- CRUD: insertar `medicamento` con `titular_id` inexistente → falla.
- Queries: KPI header con filtros vacíos → coincide con `SELECT COUNT(*)` directo en `medicamento`.
- Dashboard: aplicar filtro de `Categoria ATC = Cardiovascular` → los 9 gráficos reaccionan en < 500 ms.
- Scatter: producto sin `participacion_mercado` → no rompe (size mínimo por defecto).

### 9.3 Datos de prueba

- Fixture de 50 filas representativas extraída del Excel real (`tests/fixtures/sample_50.xlsx`).
- DB de prueba creada y dropeada en `conftest.py` por sesión.

---

## 10. Hitos y estimación de esfuerzo

| # | Hito | Entregable | Esfuerzo (h) |
|---|---|---|---|
| M0 | Setup y esquema | Repo + `requirements.txt` + `ddl.sql` ejecutado en PostgreSQL local | 3 |
| M1 | ETL funcional | `etl/` completo + DB poblada con 1.100 filas + tests verdes | 8 |
| M2 | Capa de queries | `app/queries.py` con 6 funciones + tests | 5 |
| M3 | CRUD backend | `app/crud.py` + tests de integridad referencial | 6 |
| M4 | Sistema de diseño | `assets/styles.css` + componente `header` funcionando | 4 |
| M5 | Dashboard core | Filtros + 3 bloques centrales reactivos | 10 |
| M6 | Rankings y trends | Panel derecho + fila inferior (incluye scatter) | 8 |
| M7 | Consola CRUD UI | `crud_console.py` con forms dinámicos y query builder | 9 |
| M8 | Pulido y QA | Smoke tests, ajustes UX, README + screenshots | 5 |
| | **Total** | | **~58 h** |

**Ruta crítica:** M0 → M1 → M2 → M5 (dashboard core es el desbloqueo principal de la presentación visual).
**Trabajo paralelizable:** M3 (CRUD) puede avanzar en paralelo a M5/M6 una vez M2 esté listo.

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Fórmulas Excel sin evaluar al leer con pandas | Media | Alto | Forzar evaluación en Excel antes de exportar; en último caso, recalcular en `transformers.py` |
| Volumetría crece (>10k filas) y filtros se ralentizan | Baja | Medio | Índices ya previstos + `dcc.Store` cacheando dataset filtrado |
| Dependencia de PostgreSQL local en máquina del evaluador | Media | Medio | Documentar fallback a `docker run postgres:15` en README |
| Tiempo limitado para QA visual | Media | Medio | Checklist de smoke test en M8 con captura por bloque |

---

## 12. Definición de "hecho" (Definition of Done)

Un componente se considera **terminado** cuando:

1. Su código pasa `ruff check` sin warnings.
2. Tiene al menos un test asociado (si aplica) y todos pasan.
3. Se renderiza correctamente con el dataset real (no mock).
4. Reacciona a los filtros globales en < 500 ms.
5. Su documentación inline (`docstring`) describe entradas, salidas y queries SQL involucradas.
6. Se ha validado manualmente con dos combinaciones de filtros distintas.

---

**Fin del plan.**
