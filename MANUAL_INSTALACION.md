# Bayer Market & Competitor Intelligence — Manual de Instalación

> **Versión:** 1.0 · **Fecha:** Junio 2026  
> Aplicación web Flask + PostgreSQL que consume en tiempo real el dataset CUM/INVIMA
> publicado por el gobierno colombiano vía la API Socrata de datos.gov.co.

---

## Tabla de contenidos

1. [Requisitos previos](#1-requisitos-previos)
2. [Instalación en Windows](#2-instalación-en-windows)
3. [Instalación en Ubuntu](#3-instalación-en-ubuntu-2204-lts)
4. [Configuración de la base de datos](#4-configuración-de-la-base-de-datos)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Primer arranque y carga de datos](#6-primer-arranque-y-carga-de-datos)
7. [Acceso a la aplicación](#7-acceso-a-la-aplicación)
8. [Solución de problemas comunes](#8-solución-de-problemas-comunes)

---

## 1. Requisitos previos

| Componente | Versión mínima | Notas |
|---|---|---|
| Python | 3.11+ | Se recomienda 3.14 (estable) |
| PostgreSQL | 14+ | Se recomienda 16 |
| Git | 2.40+ | Para clonar el repositorio |
| Conexión a internet | — | Para consumir la API CUM/INVIMA |

El sistema no requiere Docker. No requiere Node.js. El frontend es HTML/CSS/JS puro.

---

## 2. Instalación en Windows

### 2.1 Instalar Python

1. Descarga el instalador desde [python.org/downloads](https://www.python.org/downloads/).
2. Ejecuta el instalador. En la primera pantalla **marca la casilla "Add Python to PATH"** antes de hacer clic en *Install Now*.
3. Verifica la instalación:

```powershell
python --version
# Resultado esperado: Python 3.14.x  (o 3.11.x+)
```

### 2.2 Instalar PostgreSQL

1. Descarga desde [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).
2. Ejecuta el instalador Stack Builder y sigue el asistente con las opciones predeterminadas.
3. Durante la instalación elige un **puerto** (predeterminado: `5432`) y una **contraseña para el usuario `postgres`**. Anótalos.
4. Verifica que el servicio esté activo:

```powershell
# Desde PowerShell como administrador
Get-Service postgresql*
# Debe aparecer con Status = Running
```

### 2.3 Clonar el repositorio

```powershell
git clone https://github.com/FelipeOrtegaC/Bayer_AnalisisVentas.git
cd Bayer_AnalisisVentas
```

> La raíz del repositorio clonado **ya es** la carpeta del proyecto: contiene `app_server.py`, `etl/`, `sql/`, `web/` y `data/` directamente. No hay subcarpeta anidada. Verifica con `dir` (debes ver `app_server.py`).
>
> Si no tienes acceso al repositorio, descomprime el ZIP del proyecto y navega a la carpeta que contenga `app_server.py`.

### 2.4 Crear el entorno virtual e instalar dependencias

```powershell
# Crear el entorno virtual
python -m venv .venv

# Activar el entorno virtual
.venv\Scripts\Activate.ps1

# Si PowerShell bloquea la ejecución de scripts, ejecuta primero:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Instalar dependencias
pip install -r requirements.txt
```

### 2.5 Verificar la instalación de paquetes

```powershell
pip list | Select-String "flask|pandas|psycopg2|openpyxl|passlib|bcrypt"
```

Deben aparecer todos los paquetes listados.

---

## 3. Instalación en Ubuntu (22.04 LTS)

### 3.1 Actualizar el sistema e instalar dependencias del SO

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git curl
```

Verifica las versiones:

```bash
python3 --version   # Python 3.10+ (Ubuntu 22.04 trae 3.10; instala 3.11+ si se requiere)
git --version
```

**Instalar Python 3.11+ en Ubuntu 22.04 (opcional pero recomendado):**

```bash
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev
python3.11 --version
```

### 3.2 Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Iniciar y habilitar el servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar estado
sudo systemctl status postgresql
```

### 3.3 Configurar el usuario de base de datos

```bash
# Cambiar a superusuario de postgres
sudo -u postgres psql

# Dentro de psql, establece una contraseña para el usuario postgres:
ALTER USER postgres PASSWORD 'tu_contraseña';
\q
```

### 3.4 Clonar el repositorio

```bash
git clone https://github.com/FelipeOrtegaC/Bayer_AnalisisVentas.git
cd Bayer_AnalisisVentas
```

> La raíz del repositorio clonado **ya es** la carpeta del proyecto: contiene `app_server.py`, `etl/`, `sql/`, `web/` y `data/` directamente. No hay subcarpeta anidada. Verifica con `ls` (debes ver `app_server.py`).

### 3.5 Crear el entorno virtual e instalar dependencias

```bash
# Con Python 3.11 si lo instalaste desde deadsnakes
python3.11 -m venv .venv

# O con la versión del sistema
python3 -m venv .venv

# Activar
source .venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.6 Verificar la instalación

```bash
pip list | grep -E "flask|pandas|psycopg2|openpyxl|passlib|bcrypt"
```

---

## 4. Configuración de la base de datos

Este paso es **idéntico en Windows y Ubuntu**. Todos los comandos se ejecutan desde la carpeta raíz del proyecto con el entorno virtual activado.

### 4.1 Crear la base de datos

**Windows (PowerShell):**

```powershell
# psql debe estar en el PATH; si no, agrega C:\Program Files\PostgreSQL\16\bin
psql -U postgres -c "CREATE DATABASE xy_pharma;"
```

**Ubuntu (Bash):**

```bash
sudo -u postgres psql -c "CREATE DATABASE xy_pharma;"
```

### 4.2 Crear las tablas

```bash
# Windows
psql -U postgres -d xy_pharma -f sql\ddl.sql

# Ubuntu
psql -U postgres -d xy_pharma -f sql/ddl.sql
```

### 4.3 Crear las tablas de autenticación (REQUERIDO para el login)

Este paso es **obligatorio** para poder registrarse e iniciar sesión en la aplicación. Crea las tablas `usuario` y `audit_log`. Si lo omites, el login y el registro fallarán con un error de tabla inexistente.

```bash
# Windows
psql -U postgres -d xy_pharma -f sql\ddl_users.sql

# Ubuntu
psql -U postgres -d xy_pharma -f sql/ddl_users.sql
```

### 4.4 Crear los índices

```bash
# Windows
psql -U postgres -d xy_pharma -f sql\indexes.sql

# Ubuntu
psql -U postgres -d xy_pharma -f sql/indexes.sql
```

### 4.5 Crear las vistas analíticas (opcional)

```bash
# Windows
psql -U postgres -d xy_pharma -f sql\seed_queries.sql

# Ubuntu
psql -U postgres -d xy_pharma -f sql/seed_queries.sql
```

Verifica que las tablas se crearon correctamente:

```bash
psql -U postgres -d xy_pharma -c "\dt"
```

Debes ver **7 tablas**: las 5 del CUM (`principio_activo`, `titular`, `clasificacion_atc`, `tiempo`, `medicamento`) más las 2 de autenticación (`usuario`, `audit_log`).

---

## 5. Variables de entorno

El archivo `.env` contiene las credenciales de conexión y la configuración del servidor.

### 5.1 Crear el archivo `.env`

Copia la plantilla incluida:

```bash
# Windows
copy .env.example .env

# Ubuntu
cp .env.example .env
```

### 5.2 Editar `.env`

Abre `.env` con cualquier editor de texto y ajusta los valores:

```dotenv
# Conexión a PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DB=xy_pharma
PG_USER=postgres
PG_PASSWORD=tu_contraseña_aqui   # <- reemplaza esto

# Ruta al archivo Excel de datos (relativa a la carpeta del proyecto)
EXCEL_PATH=data/CO_medicamentos_aprobados.xlsx

# Flask — genera una clave segura con el comando de abajo
SECRET_KEY=REEMPLAZA_ESTO_CON_CLAVE_GENERADA
PORT=8050
DASH_DEBUG=false                  # en producción usar false
```

**Generar una SECRET\_KEY segura:**

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copia el resultado y pégalo en `SECRET_KEY=`.

### 5.3 Variables opcionales de refresco de datos

```dotenv
# Forzar descarga de la API al iniciar (true/false)
REFRESH_ON_START=false

# Horas máximas antes de refrescar datos automáticamente (por defecto 24)
REFRESH_MAX_AGE_HOURS=24
```

---

## 6. Primer arranque y carga de datos

### 6.1 Descargar los datos desde la API CUM/INVIMA

La primera carga descarga ~157 000 filas del dataset `i7cb-raxc` de datos.gov.co y las consolida a nivel de registro sanitario. Tarda entre 3 y 8 minutos dependiendo de la conexión.

```bash
# Con el entorno virtual activado, desde la raíz del proyecto.
# El extractor se ejecuta como MÓDULO de Python (-m), no como archivo suelto.
python -m etl.api_to_excel
```

Esto crea/reescribe `data/CO_medicamentos_aprobados.xlsx` (solo columnas reales del CUM) y respalda el Excel previo como `CO_medicamentos_aprobados_SIMULADO.bak.xlsx`.

**Opción disponible:**

```bash
# Limitar las filas descargadas para una prueba rápida
python -m etl.api_to_excel --max-rows 5000
```

> El extractor vive en `etl/api_to_excel.py` y es el mismo que `app_server.py` usa internamente cuando `REFRESH_ON_START=true`. Debe ejecutarse con `-m etl.api_to_excel` (sintaxis de módulo) desde la raíz del proyecto; `python etl/api_to_excel.py` también funciona, pero `-m` es lo recomendado.

### 6.2 Cargar datos en PostgreSQL (opcional)

Si deseas poblar la base de datos relacional:

```bash
python -c "from etl.loader import load_all; load_all()"
```

### 6.3 Iniciar el servidor web

```bash
python app_server.py
```

La salida esperada es:

```
 * Running on http://127.0.0.1:8050
 * Restarting with stat
 * Debugger is active!
```

### 6.4 Iniciar con refresco automático de datos

Para que el servidor descargue datos frescos al arrancar:

```bash
# Windows
set REFRESH_ON_START=true && python app_server.py

# Ubuntu
REFRESH_ON_START=true python app_server.py
```

---

## 7. Acceso a la aplicación

Abre un navegador y navega a:

```
http://localhost:8050
```

### Vistas disponibles

| Vista | Descripción |
|---|---|
| **Login / Registro** | Autenticación de usuarios con validación de roles |
| **Dashboard** | KPIs, 8 gráficos interactivos Plotly, filtros reactivos |
| **Competidores** | Búsqueda por molécula o producto, análisis de competencia ® vs INN |
| **Consola CRUD** | Consultas SELECT / INSERT / UPDATE / DELETE con generador de payloads JSON |

### Crear el primer usuario e iniciar sesión

No existe un usuario semilla: el primer acceso se crea desde la propia aplicación.

1. En la pantalla de Login, haz clic en **Registrarse**.
2. Completa el formulario respetando las validaciones del servidor:
   - **username**: 3 a 50 caracteres alfanuméricos o guión bajo (`_`).
   - **email**: formato válido (`usuario@dominio.com`).
   - **password**: mínimo 8 caracteres, con al menos una letra y un número.
   - **nombre**: entre 2 y 100 caracteres.
   - **edad**: número entero entre 1 y 120.
   - **rol**: debe ser exactamente `admin` o `viewer` (no se aceptan otros valores).
3. Al registrarte quedas autenticado automáticamente. En adelante, usa **Iniciar sesión** con tu username y contraseña.

> Las tablas `usuario` y `audit_log` deben existir previamente (paso 4.3). Cada registro, login y logout queda asentado en `audit_log`.

---

## 8. Solución de problemas comunes

### Error: `ModuleNotFoundError: No module named 'bcrypt'`

El paquete `passlib[bcrypt]` en el requirements.txt instala passlib pero a veces no instala bcrypt directamente.

```bash
pip install bcrypt
```

### Error: `psycopg2.OperationalError: FATAL: password authentication failed`

Verifica que la contraseña en `.env` (variable `PG_PASSWORD`) coincida exactamente con la del usuario `postgres` en PostgreSQL.

```bash
psql -U postgres -h localhost -d xy_pharma
```

Si pide contraseña y falla, resetéala:

```bash
# Ubuntu
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nueva_contraseña';"
```

### Error: `FATAL: database "xy_pharma" does not exist`

La base de datos no fue creada. Ejecuta:

```bash
psql -U postgres -c "CREATE DATABASE xy_pharma;"
```

### Error al registrarse o iniciar sesión: `relation "usuario" does not exist`

No se ejecutaron las tablas de autenticación (paso 4.3). Créalas:

```bash
# Windows
psql -U postgres -d xy_pharma -f sql\ddl_users.sql

# Ubuntu
psql -U postgres -d xy_pharma -f sql/ddl_users.sql
```

### Error en Windows: `psql: command not found` (PowerShell)

Agrega la carpeta `bin` de PostgreSQL al PATH:

```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
```

Para hacerlo permanente, agrégalo desde *Panel de control > Sistema > Variables de entorno*.

### La descarga de la API se detiene o es muy lenta

El script incluye reintentos automáticos con backoff exponencial. Si la conexión es inestable, usa `--max-rows` para una prueba inicial:

```bash
python -m etl.api_to_excel --max-rows 10000
```

### Error: `python: can't open file '.../extraer_cum_invima.py': No such file or directory`

Ese archivo es un script independiente que **no forma parte del repositorio**. El extractor incluido en el repo es `etl/api_to_excel.py` y se invoca como módulo:

```bash
python -m etl.api_to_excel
```

### Error `IllegalCharacterError` en openpyxl

Ya está corregido en el código. Si aparece, actualiza openpyxl:

```bash
pip install --upgrade openpyxl
```

### Puerto 8050 ya en uso

Cambia el puerto en `.env`:

```dotenv
PORT=8051
```

O termina el proceso que usa el puerto:

```bash
# Windows
netstat -ano | findstr :8050
taskkill /PID <PID_ENCONTRADO> /F

# Ubuntu
sudo lsof -i :8050
sudo kill -9 <PID_ENCONTRADO>
```

---

## Resumen de comandos rápidos

```bash
# 1. Activar entorno virtual
#    Windows:  .venv\Scripts\Activate.ps1
#    Ubuntu:   source .venv/bin/activate

# 2. Descargar datos CUM/INVIMA (extractor como módulo, desde la raíz del repo)
python -m etl.api_to_excel

# 3. Crear la base de datos y TODAS las tablas
psql -U postgres -c "CREATE DATABASE xy_pharma;"
psql -U postgres -d xy_pharma -f sql/ddl.sql         # 5 tablas del CUM
psql -U postgres -d xy_pharma -f sql/ddl_users.sql   # usuario + audit_log (login)
psql -U postgres -d xy_pharma -f sql/indexes.sql     # índices

# 4. Iniciar servidor
python app_server.py

# 5. Abrir en navegador y registrarse (rol: admin o viewer)
#    http://localhost:8050
```

---

*Bayer · Market & Competitor Intelligence · Colombia*  
*Fuente de datos: datos.gov.co (CUM/INVIMA, en vivo) — API Socrata `i7cb-raxc`*
