const presets = {
  health: {
    method: 'GET',
    url: '/api/v1/health',
    key: '',
    body: ''
  },
  products: {
    method: 'GET',
    url: '/api/v1/products?limit=5',
    key: 'dev-read-key-change-me',
    body: ''
  },
  stores: {
    method: 'GET',
    url: '/api/v1/stores',
    key: 'dev-read-key-change-me',
    body: ''
  },
  low_stock: {
    method: 'POST',
    url: '/api/v1/intents/execute',
    key: 'dev-read-key-change-me',
    body: JSON.stringify({
      intent: 'low_stock',
      params: { limit: 5 }
    }, null, 2)
  },
  sales_trend: {
    method: 'POST',
    url: '/api/v1/intents/execute',
    key: 'dev-read-key-change-me',
    body: JSON.stringify({
      intent: 'sales_trend',
      params: { granularity: 'day' }
    }, null, 2)
  },
  jobs: {
    method: 'GET',
    url: '/api/v1/jobs',
    key: 'dev-admin-key-change-me',
    body: ''
  }
};

function loadPreset(name) {
  const p = presets[name];
  if (!p) return;
  document.getElementById('reqMethod').value = p.method;
  document.getElementById('reqUrl').value = p.url;
  document.getElementById('reqKey').value = p.key;
  document.getElementById('reqBody').value = p.body;
  toggleBodyVisibility();
  executeRequest();
}

function setKey(role) {
  if (role === 'read') {
    document.getElementById('reqKey').value = 'dev-read-key-change-me';
  } else if (role === 'admin') {
    document.getElementById('reqKey').value = 'dev-admin-key-change-me';
  } else {
    document.getElementById('reqKey').value = '';
  }
}

function toggleBodyVisibility() {
  const method = document.getElementById('reqMethod').value;
  const bodyGroup = document.getElementById('bodyGroup');
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    bodyGroup.style.display = 'flex';
  } else {
    bodyGroup.style.display = 'none';
  }
}

// Keyboard shortcut Ctrl+Enter
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    executeRequest();
  }
});

async function executeRequest() {
  const method = document.getElementById('reqMethod').value;
  const url = document.getElementById('reqUrl').value;
  const key = document.getElementById('reqKey').value.trim();
  const bodyText = document.getElementById('reqBody').value;
  const resViewer = document.getElementById('resViewer');
  const resStatus = document.getElementById('resStatus');
  const resTime = document.getElementById('resTime');
  const sendBtn = document.getElementById('sendBtn');

  sendBtn.disabled = true;
  sendBtn.innerHTML = 'Sending...';
  resViewer.textContent = 'Executing request...';

  const headers = {};
  if (key) {
    headers['x-api-key'] = key;
  }
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };
  if ((method === 'POST' || method === 'PATCH' || method === 'PUT') && bodyText.trim()) {
    try {
      JSON.parse(bodyText);
      options.body = bodyText;
    } catch (err) {
      resViewer.textContent = `Invalid JSON in request body:\n${err.message}`;
      sendBtn.disabled = false;
      sendBtn.innerHTML = 'Send Request (Ctrl + Enter)';
      return;
    }
  }

  const startTime = performance.now();
  try {
    const response = await fetch(url, options);
    const duration = Math.round(performance.now() - startTime);
    const data = await response.json();

    resStatus.style.display = 'inline-flex';
    resStatus.className = `status-badge ${response.ok ? 'status-2xx' : 'status-4xx'}`;
    resStatus.textContent = `${response.status} ${response.statusText || (response.ok ? 'OK' : 'Error')}`;
    resTime.textContent = `${duration} ms`;

    resViewer.innerHTML = syntaxHighlight(JSON.stringify(data, null, 2));
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    resStatus.style.display = 'inline-flex';
    resStatus.className = 'status-badge status-5xx';
    resStatus.textContent = 'Fetch Error';
    resTime.textContent = `${duration} ms`;
    resViewer.textContent = `Error: ${err.message}`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
      Send Request (Ctrl + Enter)
    `;
  }
}

function syntaxHighlight(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// Telemetry Poller
async function updateTelemetry() {
  try {
    const res = await fetch('/api/v1/health');
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      document.getElementById('healthStatus').textContent = d.status.toUpperCase();
      document.getElementById('uptimeSub').textContent = `Uptime: ${formatUptime(d.uptime)}`;
      document.getElementById('dbStatus').textContent = d.dbConnected ? 'Connected' : 'Disconnected';
      document.getElementById('queueStatus').innerHTML = `${d.queueSize} <span style="font-size: 1rem; color: var(--text-dim); font-weight: 400;">pending</span>`;
      
      if (d.cacheStats) {
        document.getElementById('cacheHitRate').innerHTML = `${d.cacheStats.hitRate}% <span style="font-size: 1rem; color: var(--text-dim); font-weight: 400;">hit rate</span>`;
        document.getElementById('cacheDetails').textContent = `Entries: ${d.cacheStats.size} / ${d.cacheStats.maxSize} (${d.cacheStats.hits} hits, ${d.cacheStats.misses} misses)`;
      }
    }
  } catch (e) {
    // silent fail
  }
}

function formatUptime(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reqMethod').addEventListener('change', toggleBodyVisibility);
  updateTelemetry();
  setInterval(updateTelemetry, 4000);
});
