/* ============================================================
   Regulatory Intelligence OneView · Colombia · XY Pharma
   Static dashboard powered by Plotly + vanilla JS
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

// ── Login ────────────────────────────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  clearAuthErrors();
  const username = document.getElementById('l-username').value.trim();
  const password = document.getElementById('l-password').value;

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Ingresando…';

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (body.ok) {
      onAuthSuccess(body);
    } else {
      showGlobalErr('login', (body.errors || ['Error desconocido.']).join(' '));
    }
  } catch {
    showGlobalErr('login', 'No se pudo conectar con el servidor. ¿Está corriendo app_server.py?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
}

// ── Register ─────────────────────────────────────────────────────────────────
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
  btn.disabled = true;
  btn.textContent = 'Creando cuenta…';

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
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────
async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  showAuthOverlay();
}

// ── Session helpers ───────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const body = await res.json();
      if (body.ok) { onAuthSuccess(body, false); return; }
    }
  } catch {
    // server not available — hide overlay so the dashboard works in static mode
    hideAuthOverlay();
    return;
  }
  showAuthOverlay();
}

function onAuthSuccess(user, redirect = true) {
  document.getElementById('user-badge').style.display = '';
  document.getElementById('user-name-label').textContent = user.nombre || user.username;
  const av = document.getElementById('user-avatar');
  av.textContent = (user.nombre || user.username || '?').charAt(0).toUpperCase();
  hideAuthOverlay();
}

function showAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('visible');
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').classList.remove('visible');
}


const COLORS = {
  primary: '#1E5AA8',
  primarySoft: '#E8F0FB',
  positive: '#3FB57F',
  warning: '#E8B547',
  risk: '#D64545',
  textSecondary: '#6B7280',
  border: '#E5E9F0',
};

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

let DATA = [];          // full dataset
let FILTERED = [];      // current filtered view
let FILTERS = {};       // active selections
let CRUD_WORKING = [];  // mutable copy for CRUD operations
const ENTITY_SCHEMAS = {
  medicamento: ['consecutivocum','registrosanitario','producto','estadoregistro','formafarmaceutica','viaadministracion','cantidad','unidadmedida','estado_regulatorio_final','segmento_mercado','tipo_producto_estimado','titular_normalizado','principio_activo_normalizado','atc','categoria_atc'],
  principio_activo: ['principio_activo_normalizado'],
  titular: ['titular_normalizado','tipo_titular'],
  clasificacion_atc: ['atc','categoria_atc'],
  tiempo: ['fechaexpedicion','fechainactivo','fechavencimiento'],
  inventario: ['consecutivocum','producto','stock_actual','stock_minimo','stock_maximo'],
  costos_precios: ['consecutivocum','producto','precio_referencia_cop','costo_produccion_estimado','precio_proyectado'],
  simulacion_mercado: ['consecutivocum','producto','demanda_mensual_estimada','participacion_mercado','riesgo_regulatorio'],
};

/* ============ BOOT ============ */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('updated-date').textContent =
    'Actualizado · ' + new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

  // Check session before showing dashboard content
  await checkAuth();

  try {
    const res = await fetch('data.json');
    DATA = await res.json();
    CRUD_WORKING = JSON.parse(JSON.stringify(DATA));
    console.log(`Loaded ${DATA.length} records`);
    initFilters();
    initTabs();
    initCrud();
    applyFilters();
  } catch (err) {
    console.error('Failed to load data.json', err);
    document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#D64545">
      <h2>Error cargando data.json</h2>
      <p>Asegúrate de servir esta carpeta con un servidor HTTP local (no abrir como file://).</p>
      <pre>python app_server.py</pre>
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
  fillSelect('f-titular',   uniq(DATA.map(d => d.titular_normalizado)).slice(0, 200));
  fillSelect('f-tipo',      uniq(DATA.map(d => d.tipo_producto_estimado)));
  fillSelect('f-estado',    uniq(DATA.map(d => d.estado_regulatorio_final)));
  fillSelect('f-via',       uniq(DATA.map(d => d.viaadministracion)));
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
    titular_normalizado: getSelectedValues('f-titular'),
    tipo_producto_estimado: getSelectedValues('f-tipo'),
    estado_regulatorio_final: getSelectedValues('f-estado'),
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
  renderRegulatoryHealth();
  renderEconomicSimulation();
  renderDemandaStock();
  renderTopProductos();
  renderTopTitulares();
  renderDemandaTemporal();
  renderInventoryEfficiency();
  renderScatter();
}

/* ============ KPIs ============ */
function renderKPIs() {
  const d = FILTERED;
  const total = d.length;
  const vigentes = d.filter(x => (x.estadoregistro || '').toLowerCase() === 'vigente').length;
  const riesgoAlto = d.filter(x => x.riesgo_regulatorio === 'ALTO').length;
  const avgPrecio = mean(d.map(x => x.precio_referencia_cop).filter(Number.isFinite));
  const stock = sum(d.map(x => x.stock_actual).filter(Number.isFinite));
  const demanda = sum(d.map(x => x.demanda_mensual_estimada).filter(Number.isFinite));

  document.getElementById('kpi-total').textContent     = total.toLocaleString('es-CO');
  document.getElementById('kpi-vigentes').textContent  = total ? ((vigentes / total) * 100).toFixed(1) + '%' : '—';
  document.getElementById('kpi-riesgo').textContent    = riesgoAlto.toLocaleString('es-CO');
  document.getElementById('kpi-precio').textContent    = avgPrecio ? '$ ' + Math.round(avgPrecio).toLocaleString('es-CO') : '—';
  document.getElementById('kpi-stock').textContent     = abbreviate(stock);
  document.getElementById('kpi-demanda').textContent   = abbreviate(demanda);
}

/* ============ REGULATORY HEALTH ============ */
function renderRegulatoryHealth() {
  const d = FILTERED;
  const total = d.length || 1;
  const activo   = d.filter(x => x.estado_regulatorio_final === 'ACTIVO').length / total * 100;
  const inactivo = d.filter(x => x.estado_regulatorio_final === 'INACTIVO').length / total * 100;
  const altoRiesgo = d.filter(x => x.riesgo_regulatorio === 'ALTO').length / total * 100;

  const trace = {
    type: 'bar', orientation: 'h',
    x: [activo, inactivo, altoRiesgo],
    y: ['% Activo', '% Inactivo', '% Alto Riesgo'],
    marker: { color: [COLORS.positive, COLORS.textSecondary, COLORS.risk] },
    text: [activo.toFixed(1)+'%', inactivo.toFixed(1)+'%', altoRiesgo.toFixed(1)+'%'],
    textposition: 'outside',
    hovertemplate: '%{y}: %{x:.1f}%<extra></extra>',
  };
  Plotly.react('chart-health', [trace], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 50, b: 30, l: 90 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, range: [0, Math.max(100, activo + 10)] },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, automargin: true },
  }, PLOTLY_CONFIG);
}

/* ============ ECONOMIC SIMULATION ============ */
function renderEconomicSimulation() {
  const d = FILTERED;
  const precio  = mean(d.map(x => x.precio_referencia_cop).filter(Number.isFinite));
  const costo   = mean(d.map(x => x.costo_produccion_estimado).filter(Number.isFinite));
  const proy    = mean(d.map(x => x.precio_proyectado).filter(Number.isFinite));
  const margen  = proy && costo ? ((proy - costo) / proy) * 100 : 0;

  // baseline = full dataset
  const basePrecio = mean(DATA.map(x => x.precio_referencia_cop).filter(Number.isFinite));
  const baseCosto  = mean(DATA.map(x => x.costo_produccion_estimado).filter(Number.isFinite));
  const baseProy   = mean(DATA.map(x => x.precio_proyectado).filter(Number.isFinite));
  const baseMargen = baseProy && baseCosto ? ((baseProy - baseCosto) / baseProy) * 100 : 0;

  setEcon('econ-precio', '$ ' + Math.round(precio || 0).toLocaleString('es-CO'), pctDelta(precio, basePrecio), 'econ-precio-delta');
  setEcon('econ-costo',  '$ ' + Math.round(costo  || 0).toLocaleString('es-CO'), pctDelta(costo,  baseCosto),  'econ-costo-delta');
  setEcon('econ-proy',   '$ ' + Math.round(proy   || 0).toLocaleString('es-CO'), pctDelta(proy,   baseProy),   'econ-proy-delta');
  setEcon('econ-margen', margen.toFixed(1) + '%',                                pctDelta(margen, baseMargen), 'econ-margen-delta');
}

function setEcon(valueId, value, deltaObj, deltaId) {
  document.getElementById(valueId).textContent = value;
  const el = document.getElementById(deltaId);
  el.textContent = deltaObj.text;
  el.className = 'econ-delta ' + deltaObj.cls;
}

function pctDelta(curr, base) {
  if (!base || !Number.isFinite(curr)) return { text: '—', cls: '' };
  const d = ((curr - base) / base) * 100;
  if (Math.abs(d) < 0.05) return { text: '≈ vs avg', cls: '' };
  return { text: (d > 0 ? '▲ +' : '▼ ') + d.toFixed(1) + '% vs avg', cls: d > 0 ? 'delta-up' : 'delta-down' };
}

/* ============ DEMANDA VS STOCK ============ */
function renderDemandaStock() {
  const top = [...FILTERED]
    .filter(x => Number.isFinite(x.demanda_mensual_estimada))
    .sort((a,b) => b.demanda_mensual_estimada - a.demanda_mensual_estimada)
    .slice(0, 20);
  const labels = top.map((x,i) => truncate(x.producto, 22));
  const demanda = top.map(x => x.demanda_mensual_estimada || 0);
  const stock   = top.map(x => x.stock_actual || 0);

  const traces = [
    { type: 'bar', name: 'Demanda', x: labels, y: demanda, marker: { color: COLORS.primary }, hovertemplate: '%{x}<br>Demanda: %{y:,.0f}<extra></extra>' },
    { type: 'scatter', mode: 'lines+markers', name: 'Stock', x: labels, y: stock, line: { color: COLORS.warning, width: 2 }, marker: { size: 6 }, yaxis: 'y2', hovertemplate: '%{x}<br>Stock: %{y:,.0f}<extra></extra>' },
  ];
  Plotly.react('chart-demanda-stock', traces, {
    ...PLOTLY_LAYOUT_BASE,
    showlegend: true,
    legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 11 } },
    margin: { t: 30, r: 50, b: 80, l: 50 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, tickangle: -35, tickfont: { size: 9 } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'Demanda', font: { size: 11 } } },
    yaxis2: { overlaying: 'y', side: 'right', gridcolor: 'transparent', title: { text: 'Stock', font: { size: 11 } } },
  }, PLOTLY_CONFIG);
}

/* ============ TOP PRODUCTOS ============ */
function renderTopProductos() {
  const top = [...FILTERED]
    .filter(x => Number.isFinite(x.demanda_mensual_estimada) && Number.isFinite(x.precio_referencia_cop))
    .map(x => ({...x, score: (x.demanda_mensual_estimada || 0) * (x.precio_referencia_cop || 0) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 12);
  const tbody = document.querySelector('#tbl-productos tbody');
  tbody.innerHTML = top.map(x => {
    const ms = Number.isFinite(x.participacion_mercado) ? x.participacion_mercado.toFixed(1) + '%' : '—';
    const r = x.riesgo_regulatorio || 'MEDIO';
    const dot = r === 'ALTO' ? '🔴' : r === 'MEDIO' ? '🟡' : '🟢';
    return `<tr>
      <td title="${escapeAttr(x.producto)}">${escapeHtml(truncate(x.producto, 22))}</td>
      <td>${escapeHtml(x.atc || '—')}</td>
      <td class="num">$${Math.round(x.precio_referencia_cop || 0).toLocaleString('es-CO')}</td>
      <td class="num">${(x.demanda_mensual_estimada || 0).toLocaleString('es-CO')}</td>
      <td class="num">${ms}</td>
      <td><span class="risk-dot risk-${r}">${dot} ${r}</span></td>
    </tr>`;
  }).join('');
}

/* ============ TOP TITULARES ============ */
function renderTopTitulares() {
  const counts = {};
  FILTERED.forEach(x => {
    const t = x.titular_normalizado || 'Sin titular';
    counts[t] = (counts[t] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10).reverse();
  const trace = {
    type: 'bar', orientation: 'h',
    x: top.map(t => t[1]),
    y: top.map(t => truncate(t[0], 26)),
    marker: { color: COLORS.primary },
    text: top.map(t => t[1]),
    textposition: 'outside',
    hovertemplate: '%{y}<br>%{x} productos<extra></extra>',
  };
  Plotly.react('chart-titulares', [trace], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 30, b: 30, l: 140 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: '# productos', font: { size: 10 } } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, automargin: true, tickfont: { size: 9 } },
  }, PLOTLY_CONFIG);
}

/* ============ DEMANDA TEMPORAL ============ */
function renderDemandaTemporal() {
  const buckets = {};
  FILTERED.forEach(x => {
    if (!x.fechaexpedicion) return;
    const key = x.fechaexpedicion.slice(0, 7); // YYYY-MM
    if (!buckets[key]) buckets[key] = { demanda: 0, stock: 0, precio: [], n: 0 };
    buckets[key].demanda += x.demanda_mensual_estimada || 0;
    buckets[key].stock   += x.stock_actual || 0;
    if (Number.isFinite(x.precio_referencia_cop)) buckets[key].precio.push(x.precio_referencia_cop);
    buckets[key].n++;
  });
  const months = Object.keys(buckets).sort();
  // Group by year for cleaner view (monthly granularity is too sparse over 30+ yrs)
  const byYear = {};
  months.forEach(m => {
    const y = m.slice(0, 4);
    if (!byYear[y]) byYear[y] = { demanda: 0, stock: 0, precio: [], n: 0 };
    byYear[y].demanda += buckets[m].demanda;
    byYear[y].stock   += buckets[m].stock;
    byYear[y].precio  = byYear[y].precio.concat(buckets[m].precio);
    byYear[y].n      += buckets[m].n;
  });
  const years = Object.keys(byYear).sort().slice(-15); // last 15 years
  const traces = [
    { type: 'bar', name: 'Demanda', x: years, y: years.map(y => byYear[y].demanda), marker: { color: COLORS.primary } },
    { type: 'bar', name: 'Stock',   x: years, y: years.map(y => byYear[y].stock),   marker: { color: COLORS.warning } },
    { type: 'scatter', mode: 'lines+markers', name: 'Precio avg', yaxis: 'y2',
      x: years, y: years.map(y => mean(byYear[y].precio)),
      line: { color: COLORS.positive, width: 2 }, marker: { size: 6 } },
  ];
  Plotly.react('chart-temporal', traces, {
    ...PLOTLY_LAYOUT_BASE,
    barmode: 'group',
    showlegend: true,
    legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 11 } },
    margin: { t: 30, r: 60, b: 50, l: 50 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Año de expedición', font: { size: 11 } } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'Demanda / Stock', font: { size: 11 } } },
    yaxis2: { overlaying: 'y', side: 'right', gridcolor: 'transparent', title: { text: 'Precio (COP)', font: { size: 11 } } },
  }, PLOTLY_CONFIG);
}

/* ============ INVENTORY EFFICIENCY ============ */
function renderInventoryEfficiency() {
  const series = FILTERED
    .filter(x => Number.isFinite(x.stock_actual) && Number.isFinite(x.demanda_mensual_estimada) && x.demanda_mensual_estimada > 0)
    .map(x => ({
      producto: x.producto,
      dias: x.stock_actual / (x.demanda_mensual_estimada / 30),
    }))
    .sort((a,b) => b.dias - a.dias)
    .slice(0, 50);
  const trace = {
    type: 'scatter', mode: 'lines+markers',
    x: series.map((_, i) => i + 1),
    y: series.map(s => s.dias),
    line: { color: COLORS.primary, width: 2 },
    marker: { size: 4, color: series.map(s => s.dias > 90 ? COLORS.risk : s.dias < 15 ? COLORS.warning : COLORS.positive) },
    text: series.map(s => s.producto),
    hovertemplate: '%{text}<br>%{y:.0f} días<extra></extra>',
  };
  const refLine = {
    type: 'scatter', mode: 'lines',
    x: [1, series.length], y: [30, 30],
    line: { color: COLORS.textSecondary, dash: 'dash', width: 1 },
    hoverinfo: 'skip',
  };
  Plotly.react('chart-efficiency', [trace, refLine], {
    ...PLOTLY_LAYOUT_BASE,
    margin: { t: 10, r: 20, b: 40, l: 50 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Producto (top 50 por días)', font: { size: 11 } } },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'Días de inventario', font: { size: 11 } } },
  }, PLOTLY_CONFIG);
}

/* ============ SCATTER (DIFERENCIADOR) ============ */
function renderScatter() {
  const groups = { BAJO: [], MEDIO: [], ALTO: [] };
  FILTERED.forEach(x => {
    if (!Number.isFinite(x.stock_actual) || !Number.isFinite(x.demanda_mensual_estimada)) return;
    const r = x.riesgo_regulatorio || 'MEDIO';
    groups[r].push(x);
  });
  const colorMap = { BAJO: COLORS.positive, MEDIO: COLORS.warning, ALTO: COLORS.risk };
  const traces = Object.entries(groups).map(([r, items]) => ({
    type: 'scatter', mode: 'markers', name: r,
    x: items.map(x => x.stock_actual),
    y: items.map(x => x.demanda_mensual_estimada),
    text: items.map(x => `${x.producto}<br>${x.titular_normalizado || ''}<br>ATC: ${x.atc || ''}`),
    marker: {
      color: colorMap[r],
      size: items.map(x => {
        const p = Number.isFinite(x.participacion_mercado) ? x.participacion_mercado : 0;
        // participacion_mercado is in 0..25 range (already a percentage)
        return Math.min(26, Math.max(5, 5 + p * 0.9));
      }),
      opacity: 0.55,
      line: { color: '#FFFFFF', width: 0.5 },
    },
    hovertemplate: '%{text}<br>Stock: %{x:,.0f}<br>Demanda: %{y:,.0f}<extra>%{fullData.name}</extra>',
  }));
  Plotly.react('chart-scatter', traces, {
    ...PLOTLY_LAYOUT_BASE,
    showlegend: true,
    legend: { orientation: 'h', x: 0, y: 1.08, font: { size: 11 } },
    margin: { t: 30, r: 20, b: 50, l: 60 },
    xaxis: { ...PLOTLY_LAYOUT_BASE.xaxis, title: { text: 'Stock actual', font: { size: 11 } }, type: 'log' },
    yaxis: { ...PLOTLY_LAYOUT_BASE.yaxis, title: { text: 'Demanda mensual', font: { size: 11 } }, type: 'log' },
  }, PLOTLY_CONFIG);
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

  // Execute against in-memory dataset (each row of DATA is logically a JOINed view of the 8 entities)
  const rows = CRUD_WORKING.filter(r => where.predicate(r))
    .map(r => Object.fromEntries(cols.map(c => [c, r[c] != null ? r[c] : ''])))
    .slice(0, limit);

  renderCrudTable(cols, rows);
}

function buildWhere(col, op, val) {
  if (op === 'IS NULL')      return { text: `${col} IS NULL`,      predicate: r => r[col] == null || r[col] === '' };
  if (op === 'IS NOT NULL')  return { text: `${col} IS NOT NULL`,  predicate: r => r[col] != null && r[col] !== '' };
  if (val === '')            return { text: '',                     predicate: () => true };
  const numericVal = parseFloat(val);
  const isNum = !isNaN(numericVal) && val.trim() !== '';
  const text = `${col} ${op} ${isNum ? val : "'" + val.replace(/'/g, "''") + "'"}`;
  const cmp = {
    '=':  (a,b) => String(a).toLowerCase() === String(b).toLowerCase(),
    '!=': (a,b) => String(a).toLowerCase() !== String(b).toLowerCase(),
    '>':  (a,b) => Number(a) >  Number(b),
    '>=': (a,b) => Number(a) >= Number(b),
    '<':  (a,b) => Number(a) <  Number(b),
    '<=': (a,b) => Number(a) <= Number(b),
    'LIKE': (a,b) => String(a).toLowerCase().includes(String(b).toLowerCase().replace(/%/g, '')),
  }[op];
  return { text, predicate: r => r[col] != null && cmp(r[col], isNum ? numericVal : val) };
}

function applyCrud() {
  const action  = document.getElementById('crud-action').value;
  const entity  = document.getElementById('crud-entity').value;
  const col     = document.getElementById('crud-col').value;
  const op      = document.getElementById('crud-op').value;
  const val     = document.getElementById('crud-val').value;
  const payloadStr = document.getElementById('crud-payload').value.trim();
  const cols   = ENTITY_SCHEMAS[entity] || [];

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
  // Refresh result table after mutation
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

/* ============ UTILS ============ */
function mean(arr) { if (!arr.length) return 0; return arr.reduce((a,b) => a+b, 0) / arr.length; }
function sum(arr)  { return arr.reduce((a,b) => a+b, 0); }
function truncate(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n-1) + '…' : s; }
function abbreviate(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('es-CO');
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
