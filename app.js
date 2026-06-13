const $ = (id) => document.getElementById(id);

const elements = {
  loading: $('loading'),
  error: $('error'),
  errorText: $('errorText'),
  retryBtn: $('retryBtn'),
  leaderboard: $('leaderboard'),
  emptyState: $('emptyState'),
  statsBar: $('statsBar'),
  totalGoles: $('totalGoles'),
  totalClientes: $('totalClientes'),
  lastUpdate: $('lastUpdate'),
};

let refreshTimer = null;

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function parseSheetDate(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return value.toLocaleDateString('es-CL');
  }

  const text = String(value);

  const gvizDate = text.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (gvizDate) {
    const [, year, month, day] = gvizDate.map(Number);
    return new Date(year, month, day).toLocaleDateString('es-CL');
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('es-CL');
  }

  return text;
}

function parseGvizTable(table) {
  const rows = table?.rows || [];

  return rows
    .map((row) => {
      const cells = row.c || [];
      return {
        cliente: cells[0]?.v != null ? String(cells[0].v).trim() : '',
        fecha: cells[1]?.v ?? '',
        valor: Number(cells[2]?.v) || 0,
        goles: Number(cells[3]?.v) || 0,
      };
    })
    .filter((row) => row.cliente);
}

function parseGvizResponse(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Respuesta inválida de Google Sheets.');
  }

  const payload = JSON.parse(text.slice(start, end + 1));
  return parseGvizTable(payload.table);
}

function buildLeaderboard(rows) {
  const byClient = new Map();

  for (const row of rows) {
    const current = byClient.get(row.cliente) || {
      cliente: row.cliente,
      goles: 0,
      compras: 0,
      totalValor: 0,
      ultimaFecha: '',
    };

    current.goles += row.goles;
    current.compras += 1;
    current.totalValor += row.valor;

    const fechaTexto = parseSheetDate(row.fecha);
    if (fechaTexto) {
      current.ultimaFecha = fechaTexto;
    }

    byClient.set(row.cliente, current);
  }

  return Array.from(byClient.values()).sort((a, b) => {
    if (b.goles !== a.goles) return b.goles - a.goles;
    if (b.totalValor !== a.totalValor) return b.totalValor - a.totalValor;
    return a.cliente.localeCompare(b.cliente, 'es');
  });
}

function fetchFromSheetsViaScript() {
  return new Promise((resolve, reject) => {
    const scriptId = 'goles-sheet-loader';
    document.getElementById(scriptId)?.remove();

    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = window.google.visualization.Query || {};

    const timeoutId = setTimeout(() => {
      document.getElementById(scriptId)?.remove();
      reject(new Error('Tiempo de espera agotado al conectar con Google Sheets.'));
    }, 15000);

    window.google.visualization.Query.setResponse = (payload) => {
      clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();

      if (payload.status !== 'ok') {
        reject(new Error('Google Sheets devolvió un error al leer los datos.'));
        return;
      }

      try {
        const rows = parseGvizTable(payload.table);
        resolve(buildLeaderboard(rows));
      } catch (err) {
        reject(err);
      }
    };

    const script = document.createElement('script');
    script.id = scriptId;
    script.src =
      `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq` +
      `?tqx=out:json&gid=${CONFIG.GID}&headers=1`;
    script.onerror = () => {
      clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();
      reject(new Error('No se pudo conectar con Google Sheets.'));
    };
    document.head.appendChild(script);
  });
}

async function fetchFromSheetsViaFetch() {
  const url =
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq` +
    `?tqx=out:json&gid=${CONFIG.GID}&headers=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo conectar con Google Sheets.');
  }

  const text = await response.text();
  const rows = parseGvizResponse(text);
  return buildLeaderboard(rows);
}

async function fetchFromSheets() {
  // fetch() falla con file:// por CORS; el script tag funciona en local y en GitHub Pages.
  if (window.location.protocol === 'file:') {
    return fetchFromSheetsViaScript();
  }

  try {
    return await fetchFromSheetsViaFetch();
  } catch {
    return fetchFromSheetsViaScript();
  }
}

async function fetchFromAppsScript() {
  const response = await fetch(CONFIG.APPS_SCRIPT_URL);
  if (!response.ok) {
    throw new Error('No se pudo conectar con Apps Script.');
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Error al leer datos desde Apps Script.');
  }

  return data.leaderboard;
}

async function fetchLeaderboard() {
  if (CONFIG.APPS_SCRIPT_URL) {
    return fetchFromAppsScript();
  }
  return fetchFromSheets();
}

function getRankClass(index) {
  if (index === 0) return 'leaderboard-item--gold';
  if (index === 1) return 'leaderboard-item--silver';
  if (index === 2) return 'leaderboard-item--bronze';
  return '';
}

function showLoading() {
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.leaderboard.hidden = true;
  elements.emptyState.hidden = true;
  elements.statsBar.hidden = true;
  elements.lastUpdate.hidden = true;
}

function showError(message) {
  elements.loading.hidden = true;
  elements.error.hidden = false;
  elements.errorText.textContent = message;
  elements.leaderboard.hidden = true;
  elements.emptyState.hidden = true;
  elements.statsBar.hidden = true;
  elements.lastUpdate.hidden = true;
}

function renderLeaderboard(leaderboard) {
  elements.loading.hidden = true;
  elements.error.hidden = true;

  if (leaderboard.length === 0) {
    elements.leaderboard.hidden = true;
    elements.emptyState.hidden = false;
    elements.statsBar.hidden = true;
    elements.lastUpdate.hidden = false;
    elements.lastUpdate.textContent = `Actualizado: ${new Date().toLocaleString('es-CL')}`;
    return;
  }

  elements.emptyState.hidden = true;

  const totalGoles = leaderboard.reduce((sum, item) => sum + item.goles, 0);

  elements.statsBar.hidden = false;
  elements.totalGoles.textContent = totalGoles;
  elements.totalClientes.textContent = leaderboard.length;

  elements.leaderboard.innerHTML = leaderboard
    .map((item, index) => {
      const rankClass = getRankClass(index);
      const meta =
        item.compras > 1
          ? `${item.compras} compras · ${formatCurrency(item.totalValor)}`
          : formatCurrency(item.totalValor);

      return `
        <li class="leaderboard-item ${rankClass}" style="animation-delay:${index * 0.05}s">
          <span class="rank">${index + 1}</span>
          <div class="player-info">
            <div class="player-name">${escapeHtml(item.cliente)}</div>
            <div class="player-meta">${escapeHtml(meta)}</div>
          </div>
          <div class="goals-badge">
            <span class="goals-count">${item.goles}</span>
            <span class="goals-label">${item.goles === 1 ? 'gol' : 'goles'}</span>
          </div>
        </li>
      `;
    })
    .join('');

  elements.leaderboard.hidden = false;
  elements.lastUpdate.hidden = false;
  elements.lastUpdate.textContent = `Actualizado: ${new Date().toLocaleString('es-CL')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadData() {
  showLoading();

  try {
    const leaderboard = await fetchLeaderboard();
    renderLeaderboard(leaderboard);
  } catch (err) {
    console.error(err);
    const hint =
      window.location.protocol === 'file:'
        ? ' Estás abriendo el archivo directamente desde tu computador; prueba subirlo a GitHub Pages o usar un servidor local.'
        : ' Verifica que la hoja esté compartida como "Cualquier persona con el enlace".';
    showError(`No se pudieron cargar los goles.${hint} (${err.message})`);
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, CONFIG.REFRESH_INTERVAL_MS);
}

function pauseAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function resumeAutoRefresh() {
  startAutoRefresh();
  loadData();
}

window.RankingApp = {
  pauseAutoRefresh,
  resumeAutoRefresh,
  loadData,
};

elements.retryBtn.addEventListener('click', loadData);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadData();
});

loadData();
startAutoRefresh();
