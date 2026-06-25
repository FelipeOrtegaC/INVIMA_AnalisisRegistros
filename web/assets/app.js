/* ============================================================
   Bayer · Market & Competitor Intelligence · Colombia
   Dashboard estático (Plotly + JS vanilla).
   Datos REALES del CUM (INVIMA) consumidos de la API datos.gov.co,
   consolidados por registro sanitario. Sin stock/costos/demanda simulados.
   ============================================================ */

/* ============ AUTH ============ */

function switchAuthTab(tab) {
  document.getElementById('form-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

// ── Client-side live validation ──────────────────────────────────────────────
const _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const _USER_RE  = /^[a-zA-Z0-9_]{3,50}$/;

const VALIDATORS = {
  'r-username': v => _USER_RE.test(v) ? '' : '3–50 caracteres, solo letras, números y _',
  'r-email':    v => _EMAIL_RE.test(v) ? '' : 'Formato inválido (ej. nombre@correo.com)',
  'r-nombre':   v => (v.trim().length >= 2 && v.trim().length <= 100) ? '' : 'Entre 2 y 100 caracteres',
  'r-edad':     v => {
    const n = parseInt(v, 10);
    return (!isNaN(n) && n >= 1 && n <= 120) ? '' : 'Número entero entre 1 y 120';
  },
  'r-password': v => {
    if (v.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Za-z]/.test(v)) return 'Debe contener al menos una letra';
    if (!/\d/.test(v)) return 'Debe contener al menos un número';
    return '';
  },
};

function liveValidate(fieldId) {
  const input = document.getElementById(fieldId);
  const errEl = document.getElementById(fieldId + '-err');
  if (!input || !errEl || !VALIDATORS[fieldId]) return;
  errEl.textContent = VALIDATORS[fieldId](input.value);
}

function setFieldErr(fieldId, msg) {
  const el = document.getElementById(fieldId + '-err');
  if (el) el.textContent = msg;
}

function clearAuthErrors() {
  ['l-username','l-password','r-username','r-email','r-nombre','r-edad','r-password','r-rol']
    .forEach(id => setFieldErr(id, ''));
  ['login-global-err','register-global-err'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('auth-error-show'); }
  });
}

function showGlobalErr(formPrefix, msg) {
  const el = document.getElementById(formPrefix + '-global-err');
  if (el) { el.textContent = msg; el.classList.add('auth-error-show'); }
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthErrors();
  const username = document.getElementById('l-username').value.trim();
  const password = document.getElementById('l-password').value;
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (body.ok) onAuthSuccess(body);
    else showGlobalErr('login', (body.errors || ['Error desconocido.']).join(' '));
  } catch {
    showGlobalErr('login', 'No se pudo conectar con el servidor. ¿Está corriendo app_server.py?');
  } finally {
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  clearAuthErrors();
  const fields = ['r-username','r-email','r-nombre','r-edad','r-password'];
  let hasErr = false;
  fields.forEach(id => {
    const msg = VALIDATORS[id] ? VALIDATORS[id](document.getElementById(id).value) : '';
    if (msg) { setFieldErr(id, msg); hasErr = true; }
  });
  if (hasErr) return;

  const payload = {
    username: document.getElementById('r-username').value.trim(),
    email:    document.getElementById('r-email').value.trim(),
    nombre:   document.getElementById('r-nombre').value.trim(),
    edad:     parseInt(document.getElementById('r-edad').value, 10),
    password: document.getElementById('r-password').value,
    rol:      document.getElementById('r-rol').value,
  };
  const btn = document.getElementById('btn-register');
  btn.disabled = true; btn.textContent = 'Creando cuenta…';
  try {
    const res  = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (body.ok) {
      onAuthSuccess(body);
    } else {
      (body.errors || ['Error desconocido.']).forEach(msg => {
        if (msg.startsWith('username'))  setFieldErr('r-username', msg.replace('username: ', ''));
        else if (msg.startsWith('email'))  setFieldErr('r-email',    msg.replace('email: ', ''));
        else if (msg.startsWith('nombre')) setFieldErr('r-nombre',   msg.replace('nombre: ', ''));
        else if (msg.startsWith('edad'))   setFieldErr('r-edad',     msg.replace('edad: ', ''));
        else if (msg.startsWith('password')) setFieldErr('r-password', msg.replace('password: ', ''));
        else showGlobalErr('register', msg);
      });
    }
  } catch {
    showGlobalErr('register', 'No se pudo conectar con el servidor. ¿Está corriendo app_server.py?');
  } finally {
    btn.disabled = false; btn.textContent = 'Crear cuenta';
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  showAuthOverlay();
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const body = await res.json();
      if (body.ok) { onAuthSuccess(body, false); return; }
    }
  } catch {
    hideAuthOverlay();   // server not available — static mode
    return;
  }
  showAuthOverlay();
}

function onAuthSuccess(user) {
  document.getElementById('user-badge').style.display = '';
  document.getElementById('user-name-label').textContent = user.nombre || user.username;
  const av = document.getElementById('user-avatar');
  av.textContent = (user.nombre || user.username || '?').charAt(0).toUpperCase();
  hideAuthOverlay();
}
function showAuthOverlay() { document.getElementById('auth-overlay').classList.add('visible'); }
function hideAuthOverlay() { document.getElementById('auth-overlay').classList.remove('visible'); }


/* ============ DASHBOARD ============ */

const COLORS = {
  primary: '#10384F',      // Bayer Blue (navy)
  primarySoft: '#E7F0F4',
  positive: '#66B512',     // Bayer Green
  warning: '#E8B547',
  risk: '#D0021B',
  cyan: '#0091DF',         // Bayer Cyan
  textSecondary: '#5C6B72',
  border: '#E2E8E2',
};
const ATC_PALETTE = ['#10384F','#66B512','#0091DF','#89D329','#1B6CB5','#00A3A3','#7BBF3A','#3D6E8E','#A6CE39','#2E8BC0','#557A2E','#0BA3D6','#8FB339','#145374'];

const PLOTLY_LAYOUT_BASE = {
  margin: { t: 10, r: 10, b: 40, l: 50 },
  paper_bgcolor: '#FFFFFF',
  plot_bgcolor: '#FFFFFF',
  font: { family: 'Inter, sans-serif', size: 11, color: '#1F2937' },
  xaxis: { gridcolor: COLORS.border, zeroline: false, tickfont: { size: 10 } },
  yaxis: { gridcolor: COLORS.border, zeroline: false, tickfont: { size: 10 } },
  hoverlabel: { bgcolor: '#FFFFFF', bordercolor: COLORS.primary, font: { family: 'Inter, sans-serif', size: 11 } },
  showlegend: false,
};
const PLOTLY_CONFIG = { responsive: true, displaylogo: false, displayModeBar: false };

let DATA = [];          // dataset completo (registros sanitarios reales)
let FILTERED = [];      // vista filtrada actual
let FILTERS = {};       // selecciones activas
let CRUD_WORKING = [];  // copia mutable para la consola CRUD

const ENTITY_SCHEMAS = {
  medicamento: ['registrosanitario','producto','principio_activo','titular','fabricante','importador','segmento_mercado','formafarmaceutica','viaadministracion','concentracion','atc','categoria_atc','fechaexpedicion','fechavencimiento','num_presentaciones','modalidad'],
  principio_activo: ['principio_activo'],
  titular: ['titular'],
  clasificacion_atc: ['atc','descripcionatc','categoria_atc'],
  tiempo: ['fechaexpedicion','fechavencimiento'],
};

/* ============ BOOT ============ */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('updated-date').textContent =
    'Actualizado · ' + new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

  await checkAuth();

  try {
    const res = await fetch('data.json');
    DATA = await res.json();
    CRUD_WORKING = JSON.parse(JSON.stringify(DATA));
    console.log(`Cargados ${DATA.length} registros`);
    initFilters();
    initTabs();
    initCrud();
    initCompetidores();
    applyFilters();
  } catch (err) {
    console.error('Failed to load data.json', err);
    document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#D64545">
      <h2>Error cargando data.json</h2>
      <p>Genera los datos desde la API y sirve la carpeta por HTTP:</p>
      <pre>python -m etl.api_to_excel
python -m etl.excel_to_json
python app_server.py</pre>
    </div>`;
  }
});

/* ============ TABS ============ */
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-' + target).classList.add('active');
    });
  });
}

/* ============ FILTERS ============ */
function uniq(arr) { return [...new Set(arr.filter(v => v != null && v !== ''))].sort(); }

function initFilters() {
  const fillSelect = (id, vals) => {
    const sel = document.getElementById(id);
    sel.innerHTML = vals.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
    sel.addEventListener('change', applyFilters);
  };
  fillSelect('f-atc',       uniq(DATA.map(d => d.categoria_atc)));
  fillSelect('f-titular',   uniq(DATA.map(d => d.titular)).slice(0, 300));
  fillSelect('f-forma',     uniq(DATA.map(d => d.formafarmaceutica)).slice(0, 100));
  fillSelect('f-via',       uniq(DATA.map(d => d.viaadministracion)).slice(0, 100));
  fillSelect('f-segmento',  uniq(DATA.map(d => d.segmento_mercado)));

  document.getElementById('btn-reset').addEventListener('click', () => {
    document.querySelectorAll('.filter select').forEach(s => {
      [...s.options].forEach(o => o.selected = false);
    });
    applyFilters();
  });
}

function getSelectedValues(id) {
  return [...document.getElementById(id).selectedOptions].map(o => o.value);
}

function applyFilters() {
  FILTERS = {
    categoria_atc: getSelectedValues('f-atc'),
    titular: getSelectedValues('f-titular'),
    formafarmaceutica: getSelectedValues('f-forma'),
    viaadministracion: getSelectedValues('f-via'),
    segmento_mercado: getSelectedValues('f-segmento'),
  };
  FILTERED = DATA.filter(d => {
    for (const [k, vals] of Object.entries(FILTERS)) {
      if (vals.length === 0) continue;
      if (!vals.includes(String(d[k]))) return false;
    }
    return true;
  });
  document.getElementById('filter-count').textContent = `${FILTERED.length.toLocaleString('es-CO')} resultados`;
  renderAll();
}

/* ============ RENDER ALL ============ */
function renderAll() {
  renderKPIs();
  renderCategoriaATC();
  renderTopPrincipios();
  renderAprobacionesPorAnio();
  renderSegmento();
  renderTopTitulares();
  renderForma();
  renderVia();
  renderVencimientos();
  renderTablaRegistros();
}

/* ============ KPIs ============ */
function renderKPIs() {
  const d = FILTERED;
  const total = d.length;
  const pa = new Set(d.map(x => x.principio_activo).filter(Boolean)).size;
  const tit = new Set(d.map(x => x.titular).filter(Boolean)).size;
  const atc = new Set(d.map(x => x.categoria_atc).filter(Boolean)).size;
  const importado = d.filter(x => x.segmento_mercado === 'IMPORTADO').length;
  const vencer = d.filter(x => Number.isFinite(x.dias_para_vencer) && x.dias_para_vencer >= 0 && x.dias_para_vencer <= 365).length;

  document.getElementById('kpi-total').textContent     = total.toLocaleString('es-CO');
  document.getElementById('kpi-pa').textContent        = pa.toLocaleString('es-CO');
  document.getElementById('kpi-titulares').textContent = tit.toLocaleString('es-CO');
  document.getElementById('kpi-atc').textContent       = atc.toLocaleString('es-CO');
  document.getElementById('kpi-importado').textContent = total ? ((importado / total) * 100).toFixed(1) + '%' : '—';
  document.getElementById('kpi-vencer').textContent    = vencer.toLocaleString('es-CO');
}

/* ============ helpers de conteo ============ */
function countBy(rows, key) {
  const c = {};
  rows.forEach(x => {
    const v = x[key];
    if (v == null || v === '') return;
    c[v] = (c[v] || 0) + 1;
  });
  return c;
}
function topPairs(counts, n) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function barH(divId, pairs, color, layoutExtra = {}) {
  const rev = [...pairs].reverse();
  const trace = {
    type: 'bar', orientation: 'h',
    x: rev.map(p => p[1]),
    y: rev.map(p => truncate(p[0], 28)),
    marker: { color },
    text: rev.map(p => p[1]),
    textposition: 'outside',
    hovertemplate: '%{y}<br>%{x} registros<extra></extra>',
  };
  Plotly.react(divId, [trace], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 36, b: 28, l: 150 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: '# registros', font: { size: 10 } } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, automargin: true, tickfont: { size: 9 } },
    ...layoutExtra,
  }, PLOTLY_CONFIG);
}

function barV(divId, pairs, color, xtitle) {
  const trace = {
    type: 'bar',
    x: pairs.map(p => p[0]),
    y: pairs.map(p => p[1]),
    marker: { color },
    hovertemplate: '%{x}<br>%{y} registros<extra></extra>',
  };
  Plotly.react(divId, [trace], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 16, b: 70, l: 50 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, tickangle: -35, tickfont: { size: 9 }, title: { text: xtitle, font: { size: 10 } } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: '# registros', font: { size: 10 } } },
  }, PLOTLY_CONFIG);
}

/* ============ Categoría ATC ============ */
function renderCategoriaATC() {
  const pairs = topPairs(countBy(FILTERED, 'categoria_atc'), 14);
  barH('chart-atc', pairs, COLORS.primary);
}

/* ============ Top Principios Activos ============ */
function renderTopPrincipios() {
  const pairs = topPairs(countBy(FILTERED, 'principio_activo'), 15);
  barH('chart-principios', pairs, COLORS.positive);
}

/* ============ Aprobaciones por Año ============ */
function renderAprobacionesPorAnio() {
  const c = {};
  FILTERED.forEach(x => {
    if (!x.fechaexpedicion) return;
    const y = String(x.fechaexpedicion).slice(0, 4);
    if (!/^\d{4}$/.test(y)) return;
    c[y] = (c[y] || 0) + 1;
  });
  const years = Object.keys(c).sort();
  const pairs = years.map(y => [y, c[y]]);
  barV('chart-temporal', pairs, COLORS.primary, 'Año de expedición');
}

/* ============ Nacional vs Importado (donut) ============ */
function renderSegmento() {
  const c = countBy(FILTERED, 'segmento_mercado');
  const labels = Object.keys(c);
  const trace = {
    type: 'pie', hole: 0.55,
    labels, values: labels.map(l => c[l]),
    marker: { colors: labels.map(l => l === 'IMPORTADO' ? COLORS.warning : COLORS.primary) },
    textinfo: 'label+percent', textposition: 'inside',
    hovertemplate: '%{label}<br>%{value} registros (%{percent})<extra></extra>',
  };
  Plotly.react('chart-segmento', [trace], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 10, b: 10, l: 10 },
    showlegend: true, legend: { orientation: 'h', y: -0.05, font: { size: 10 } },
  }, PLOTLY_CONFIG);
}

/* ============ Top Titulares ============ */
function renderTopTitulares() {
  const pairs = topPairs(countBy(FILTERED, 'titular'), 10);
  barH('chart-titulares', pairs, COLORS.primary, { margin: { t: 10, r: 30, b: 28, l: 140 } });
}

/* ============ Forma Farmacéutica ============ */
function renderForma() {
  const pairs = topPairs(countBy(FILTERED, 'formafarmaceutica'), 12);
  barH('chart-forma', pairs, COLORS.cyan);
}

/* ============ Vía de Administración ============ */
function renderVia() {
  const pairs = topPairs(countBy(FILTERED, 'viaadministracion'), 12);
  barH('chart-via', pairs, '#00A3A3');
}

/* ============ Próximos a vencer por año (DIFERENCIADOR) ============ */
function renderVencimientos() {
  const c = {};
  const nowY = new Date().getFullYear();
  FILTERED.forEach(x => {
    if (!x.fechavencimiento) return;
    const y = String(x.fechavencimiento).slice(0, 4);
    if (!/^\d{4}$/.test(y)) return;
    c[y] = (c[y] || 0) + 1;
  });
  const years = Object.keys(c).sort();
  const trace = {
    type: 'bar',
    x: years, y: years.map(y => c[y]),
    marker: { color: years.map(y => (+y <= nowY + 1 ? COLORS.risk : (+y <= nowY + 3 ? COLORS.warning : COLORS.positive))) },
    hovertemplate: '%{x}<br>%{y} registros vencen<extra></extra>',
  };
  Plotly.react('chart-vencimientos', [trace], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 16, b: 50, l: 50 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Año de vencimiento', font: { size: 10 } } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: '# registros', font: { size: 10 } } },
  }, PLOTLY_CONFIG);
}

/* ============ Tabla de registros recientes ============ */
function renderTablaRegistros() {
  const top = [...FILTERED]
    .sort((a, b) => String(b.fechaexpedicion || '').localeCompare(String(a.fechaexpedicion || '')))
    .slice(0, 15);
  const tbody = document.querySelector('#tbl-registros tbody');
  tbody.innerHTML = top.map(x => `<tr>
    <td title="${escapeAttr(x.producto)}">${escapeHtml(truncate(x.producto, 28))}</td>
    <td title="${escapeAttr(x.principio_activo)}">${escapeHtml(truncate(x.principio_activo, 26))}</td>
    <td title="${escapeAttr(x.titular)}">${escapeHtml(truncate(x.titular, 22))}</td>
    <td>${escapeHtml(x.atc || '—')}</td>
    <td>${escapeHtml(truncate(x.formafarmaceutica, 18))}</td>
    <td class="num">${escapeHtml(x.fechaexpedicion || '—')}</td>
    <td class="num">${(x.num_presentaciones || 0).toLocaleString('es-CO')}</td>
    <td><span class="risk-dot ${x.segmento_mercado === 'IMPORTADO' ? 'risk-MEDIO' : 'risk-BAJO'}">${x.segmento_mercado === 'IMPORTADO' ? '🌎' : '🏭'} ${escapeHtml(x.segmento_mercado || '—')}</span></td>
  </tr>`).join('');
}

/* ============ CRUD CONSOLE ============ */
function initCrud() {
  const entSel = document.getElementById('crud-entity');
  const colSel = document.getElementById('crud-col');
  const fillCols = () => {
    const cols = ENTITY_SCHEMAS[entSel.value] || [];
    colSel.innerHTML = cols.map(c => `<option>${c}</option>`).join('');
  };
  entSel.addEventListener('change', fillCols);
  fillCols();
  document.getElementById('crud-run').addEventListener('click', runQuery);
  document.getElementById('crud-apply').addEventListener('click', applyCrud);
  document.getElementById('crud-export').addEventListener('click', exportCsv);
}

function runQuery() {
  const entity = document.getElementById('crud-entity').value;
  const col    = document.getElementById('crud-col').value;
  const op     = document.getElementById('crud-op').value;
  const val    = document.getElementById('crud-val').value;
  const limit  = parseInt(document.getElementById('crud-limit').value, 10) || 50;
  const cols   = ENTITY_SCHEMAS[entity] || [];

  const where = buildWhere(col, op, val);
  const sql = `SELECT ${cols.join(', ')} FROM ${entity}${where.text ? ' WHERE ' + where.text : ''} LIMIT ${limit};`;
  document.getElementById('crud-sql').textContent = sql;

  const rows = CRUD_WORKING.filter(r => where.predicate(r))
    .map(r => Object.fromEntries(cols.map(c => [c, r[c] != null ? r[c] : ''])))
    .slice(0, limit);
  renderCrudTable(cols, rows);
}

function buildWhere(col, op, val) {
  if (op === 'IS NULL')      return { text: `${col} IS NULL`,      predicate: r => r[col] == null || r[col] === '' };
  if (op === 'IS NOT NULL')  return { text: `${col} IS NOT NULL`,  predicate: r => r[col] != null && r[col] !== '' };
  if (val === '')            return { text: '',                     predicate: () => true };

  // Numérico solo si el valor ES un número completo (no "2026-05-25", que es fecha).
  const isNum = /^-?\d+(\.\d+)?$/.test(val.trim());
  const text = `${col} ${op} ${isNum ? val : "'" + val.replace(/'/g, "''") + "'"}`;

  // Orden válido para números Y para fechas/texto: las fechas ISO 'YYYY-MM-DD'
  // se comparan lexicográficamente, que equivale al orden cronológico.
  const bothNum = (a, b) => /^-?\d+(\.\d+)?$/.test(String(a).trim()) && /^-?\d+(\.\d+)?$/.test(String(b).trim());
  const ord = (a, b, fn) => bothNum(a, b) ? fn(+a, +b) : fn(String(a), String(b));
  const cmp = {
    '=':  (a,b) => String(a).toLowerCase() === String(b).toLowerCase(),
    '!=': (a,b) => String(a).toLowerCase() !== String(b).toLowerCase(),
    '>':  (a,b) => ord(a, b, (x,y) => x >  y),
    '>=': (a,b) => ord(a, b, (x,y) => x >= y),
    '<':  (a,b) => ord(a, b, (x,y) => x <  y),
    '<=': (a,b) => ord(a, b, (x,y) => x <= y),
    'LIKE': (a,b) => String(a).toLowerCase().includes(String(b).toLowerCase().replace(/%/g, '')),
  }[op];
  return { text, predicate: r => r[col] != null && cmp(r[col], val) };
}

function applyCrud() {
  const action  = document.getElementById('crud-action').value;
  const entity  = document.getElementById('crud-entity').value;
  const col     = document.getElementById('crud-col').value;
  const op      = document.getElementById('crud-op').value;
  const val     = document.getElementById('crud-val').value;
  const payloadStr = document.getElementById('crud-payload').value.trim();

  let sql = '', msg = '';
  let payload = {};
  if (payloadStr) {
    try { payload = JSON.parse(payloadStr); }
    catch (e) { alert('Payload JSON inválido: ' + e.message); return; }
  }
  const where = buildWhere(col, op, val);

  if (action === 'INSERT') {
    const keys = Object.keys(payload);
    sql = `INSERT INTO ${entity} (${keys.join(', ')}) VALUES (${keys.map(k => formatVal(payload[k])).join(', ')});`;
    CRUD_WORKING.push({...payload});
    msg = '1 fila insertada (en memoria).';
  } else if (action === 'UPDATE') {
    const sets = Object.entries(payload).map(([k,v]) => `${k} = ${formatVal(v)}`).join(', ');
    sql = `UPDATE ${entity} SET ${sets}${where.text ? ' WHERE ' + where.text : ''};`;
    let n = 0;
    CRUD_WORKING.forEach(r => { if (where.predicate(r)) { Object.assign(r, payload); n++; } });
    msg = `${n} filas actualizadas (en memoria).`;
  } else if (action === 'DELETE') {
    sql = `DELETE FROM ${entity}${where.text ? ' WHERE ' + where.text : ''};`;
    if (!confirm(`¿Eliminar filas que cumplan: ${where.text || '(todas)'}?`)) return;
    const before = CRUD_WORKING.length;
    CRUD_WORKING = CRUD_WORKING.filter(r => !where.predicate(r));
    msg = `${before - CRUD_WORKING.length} filas eliminadas (en memoria).`;
  } else {
    runQuery();
    return;
  }
  document.getElementById('crud-sql').textContent = sql;
  document.getElementById('crud-count').textContent = msg;
  setTimeout(runQuery, 50);
}

function formatVal(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

let LAST_RESULT = { cols: [], rows: [] };
function renderCrudTable(cols, rows) {
  LAST_RESULT = { cols, rows };
  const thead = document.querySelector('#crud-table thead tr');
  const tbody = document.querySelector('#crud-table tbody');
  thead.innerHTML = cols.map(c => `<th>${escapeHtml(c)}</th>`).join('');
  tbody.innerHTML = rows.map(r =>
    '<tr>' + cols.map(c => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('') + '</tr>'
  ).join('');
  document.getElementById('crud-count').textContent = `${rows.length.toLocaleString('es-CO')} filas`;
}

function exportCsv() {
  const { cols, rows } = LAST_RESULT;
  if (!rows.length) { alert('Sin filas para exportar. Ejecuta una consulta primero.'); return; }
  const csv = [
    cols.join(','),
    ...rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'crud_export.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ============ EXPLORADOR DE COMPETIDORES ============ */
function initCompetidores() {
  // Autocompletado con las moléculas (principio activo) distintas.
  const list = document.getElementById('comp-list');
  if (list) {
    list.innerHTML = uniq(DATA.map(d => d.principio_activo))
      .map(v => `<option value="${escapeAttr(v)}"></option>`).join('');
  }
  document.getElementById('comp-btn').addEventListener('click', searchCompetidores);
  document.getElementById('comp-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchCompetidores(); }
  });
}

function hasMarca(d) { return (d.producto || '').includes('®'); }

function searchCompetidores() {
  const termRaw = document.getElementById('comp-input').value.trim();
  if (!termRaw) return;
  const term = termRaw.toUpperCase();

  // 1) Coincidencia por molécula (principio activo, incluye combinaciones).
  let rows = DATA.filter(d => (d.principio_activo || '').toUpperCase().includes(term));
  let label = termRaw.toUpperCase();

  // 2) Si no hay, resolver por nombre de producto -> moléculas de esos productos.
  if (!rows.length) {
    const prodHits = DATA.filter(d => (d.producto || '').toUpperCase().includes(term));
    const mols = [...new Set(prodHits.map(d => d.principio_activo).filter(Boolean))];
    if (mols.length) {
      rows = DATA.filter(d => mols.includes(d.principio_activo));
      label = mols.length === 1 ? mols[0] : `${mols.length} moléculas · "${termRaw}"`;
    }
  } else {
    const mols = [...new Set(rows.map(d => d.principio_activo).filter(Boolean))];
    if (mols.length > 1) label = `${termRaw.toUpperCase()} (${mols.length} variantes/combinaciones)`;
  }
  renderCompetidores(rows, label);
}

function renderCompetidores(rows, label) {
  const placeholder = document.getElementById('comp-placeholder');
  const results = document.getElementById('comp-results');

  if (!rows.length) {
    results.style.display = 'none';
    placeholder.style.display = '';
    placeholder.innerHTML = `Sin coincidencias para ese principio activo o producto.
      Prueba con otro término (ej. <b>DAPAGLIFLOZINA</b>, <b>ENZALUTAMIDA</b>, <b>RIOCIGUAT</b>).`;
    return;
  }
  placeholder.style.display = 'none';
  results.style.display = '';

  const competidores = new Set(rows.map(r => r.titular).filter(Boolean)).size;
  const marca = rows.filter(hasMarca).length;
  const inn = rows.length - marca;
  const pct = rows.length ? Math.round(marca * 100 / rows.length) : 0;

  document.getElementById('comp-molecula').textContent = truncate(label, 34);
  document.getElementById('comp-molecula').title = label;
  document.getElementById('comp-competidores').textContent = competidores.toLocaleString('es-CO');
  document.getElementById('comp-marca').textContent = `${marca}  (${pct}%)`;
  document.getElementById('comp-inn').textContent = `${inn}  (${100 - pct}%)`;
  document.getElementById('comp-count').textContent =
    `${rows.length} registros · ${competidores} competidores`;

  // Barras: registros por competidor (top 15)
  const porComp = topPairs(countBy(rows, 'titular'), 15);
  barH('comp-chart', porComp, COLORS.primary);

  // Dona: con marca ® vs sin marca
  Plotly.react('comp-donut', [{
    type: 'pie', hole: 0.55,
    labels: ['Con marca ®', 'Sin marca (INN)'],
    values: [marca, inn],
    marker: { colors: [COLORS.positive, '#9AA7AD'] },
    textinfo: 'label+percent', textposition: 'inside',
    hovertemplate: '%{label}<br>%{value} registros (%{percent})<extra></extra>',
  }], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 10, b: 10, l: 10 },
    showlegend: true, legend: { orientation: 'h', y: -0.05, font: { size: 10 } },
  }, PLOTLY_CONFIG);

  // Tabla de competidores y presentaciones
  const ordered = [...rows].sort((a, b) =>
    String(a.titular || '').localeCompare(String(b.titular || '')) ||
    String(a.producto || '').localeCompare(String(b.producto || '')));
  document.querySelector('#comp-table tbody').innerHTML = ordered.map(r => `<tr>
    <td title="${escapeAttr(r.producto)}">${escapeHtml(truncate(r.producto, 30))}</td>
    <td title="${escapeAttr(r.titular)}">${escapeHtml(truncate(r.titular, 26))}</td>
    <td>${escapeHtml(r.segmento_mercado || '—')}</td>
    <td>${escapeHtml(truncate(r.formafarmaceutica, 18))}</td>
    <td>${escapeHtml(r.concentracion || '—')}</td>
    <td class="num">${escapeHtml(r.fechaexpedicion || '—')}</td>
    <td>${hasMarca(r) ? '<span class="badge-marca">Marca ®</span>' : '<span class="badge-inn">INN</span>'}</td>
  </tr>`).join('');
}

/* ============ UTILS ============ */
function truncate(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n-1) + '…' : s; }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
