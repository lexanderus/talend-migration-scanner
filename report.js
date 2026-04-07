// report.js — main thread: worker wiring, upload UX, tab navigation, rendering

// ── CDN libraries (loaded lazily when needed) ──────────────────────────────
const JSPDF_CDN    = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
const H2C_CDN      = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

const MAX_ZIP_BYTES = 500 * 1024 * 1024; // 500 MB

// ── State ──────────────────────────────────────────────────────────────────
let scanResult = null;   // last successful scan result JSON
let worker     = null;   // Web Worker instance

// ── DOM refs ──────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Tab navigation ─────────────────────────────────────────────────────────
function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  // Upload tab always shows "1" — never gets a checkmark class
}

document.getElementById('tab-bar').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) switchTab(tab.dataset.tab);
});

// ── Upload: drag-drop and file input ──────────────────────────────────────
const dropZone  = $('drop-zone');
const fileInput = $('file-input');

$('choose-btn').addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

// ── "Load another" button (rendered by renderResults) ─────────────────────
document.addEventListener('click', e => {
  if (e.target.id === 'load-another-btn') resetToUpload();
});

function resetToUpload() {
  scanResult = null;
  $('upload-error').classList.add('hidden');
  $('upload-error').textContent = '';
  $('progress-wrap').classList.add('hidden');
  $('progress-bar-inner').style.width = '0%';
  $('panel-results').innerHTML = '';
  $('panel-issues').innerHTML  = '';
  $('bottom-info').textContent = 'Upload a TOS project ZIP to begin';
  $('clear-filter-btn').classList.add('hidden');
  $('pdf-btn').classList.add('hidden');
  switchTab('upload');
}

// ── File validation ────────────────────────────────────────────────────────
function showError(msg) {
  const el = $('upload-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  $('progress-wrap').classList.add('hidden');
}

function handleFile(file) {
  // Validation
  if (!file.name.endsWith('.zip')) {
    showError('❌ Invalid file type. Please upload a .zip archive.');
    return;
  }
  if (file.size > MAX_ZIP_BYTES) {
    showError('❌ File too large (max 500 MB).');
    return;
  }

  $('upload-error').classList.add('hidden');
  showProgress(0, '', 0, 1);

  const reader = new FileReader();
  reader.onload = e => startScan(e.target.result, file.name);
  reader.readAsArrayBuffer(file);
}

// ── Progress display ──────────────────────────────────────────────────────
function showProgress(pct, jobName, current, total) {
  $('progress-wrap').classList.remove('hidden');
  $('drop-zone').classList.add('hidden');
  $('progress-bar-inner').style.width = `${pct}%`;
  $('progress-label').textContent = `Analyzing... ${pct}%`;
  $('progress-job').textContent = jobName
    ? `Scanning job ${current} of ${total}: ${jobName}`
    : '';
}

// ── Worker ────────────────────────────────────────────────────────────────
function startScan(buffer, filename) {
  if (worker) worker.terminate();
  worker = new Worker('./scanner.worker.js');

  worker.onmessage = e => {
    const msg = e.data;
    if (msg.type === 'progress') {
      showProgress(msg.pct, msg.job, msg.current, msg.total);
    } else if (msg.type === 'result') {
      onScanComplete(msg.data, filename);
    } else if (msg.type === 'error') {
      $('drop-zone').classList.remove('hidden');
      showError(`❌ ${msg.message}`);
    }
  };

  worker.onerror = err => {
    $('drop-zone').classList.remove('hidden');
    showError(`❌ Worker error: ${err.message}`);
  };

  worker.postMessage({ type: 'scan', buffer, filename }, [buffer]);
}

function onScanComplete(result, filename) {
  scanResult = result;
  $('progress-wrap').classList.add('hidden');
  $('drop-zone').classList.remove('hidden');

  renderResults(result, filename);
  renderIssues(result);

  $('bottom-info').textContent =
    `🕐 Analysis: ${result.summary.analysis_ms}ms · ${filename} · ${new Date().toISOString().slice(0,10)}`;
  $('pdf-btn').classList.remove('hidden');

  switchTab('results');
}

// ── Results tab rendering (Task 6) ────────────────────────────────────────
const STATUS_COLOR = { AUTO: '#0a9396', PARTIAL: '#ffa726', MANUAL: '#ef5350', SKIP: '#ccc' };

function renderResults(result, filename) {
  const { summary, issues_summary, jobs } = result;
  const circumference = 251.2;
  const offset = circumference * (1 - summary.auto_pct / 100);

  $('panel-results').innerHTML = `
  <div class="results-panel">
    <!-- Compact upload bar -->
    <div class="upload-bar">
      <div class="ub-icon">📦</div>
      <div class="ub-text">
        <div class="ub-title">${filename} <span style="color:#28a745;font-size:10px;">✓ loaded</span></div>
        <div class="ub-sub">${summary.total_jobs} jobs · analyzed in ${summary.analysis_ms}ms
          ${result.meta?.skipped_xml ? ` · ⚠️ ${result.meta.skipped_xml} files skipped (XML error)` : ''}
        </div>
      </div>
      <div class="ub-privacy">🔒 stays in browser</div>
      <button class="ub-reload" id="load-another-btn">Load another</button>
    </div>

    <div class="results-grid">
      <!-- Dial -->
      <div class="score-panel">
        <div class="dial-wrap">
          <svg class="dial-svg" viewBox="0 0 100 100">
            <circle class="dial-bg" cx="50" cy="50" r="40"/>
            <circle class="dial-fg" cx="50" cy="50" r="40"
              style="stroke-dashoffset:${offset}"/>
          </svg>
          <div class="dial-center">
            <div class="pct">${summary.auto_pct}%</div>
            <div class="lbl">AUTO</div>
          </div>
        </div>
        <div class="legend">
          <div class="legend-item"><div class="legend-dot dot-auto"></div>AUTO<div class="legend-count">${summary.auto}</div></div>
          <div class="legend-item"><div class="legend-dot dot-partial"></div>PARTIAL<div class="legend-count">${summary.partial}</div></div>
          <div class="legend-item"><div class="legend-dot dot-manual"></div>MANUAL<div class="legend-count">${summary.manual}</div></div>
          <div class="legend-item"><div class="legend-dot dot-skip"></div>SKIP<div class="legend-count">${summary.skip}</div></div>
        </div>
        <div class="score-label">${summary.auto} of ${summary.total_jobs - summary.skip} jobs<br>migrate automatically</div>
      </div>

      <!-- Right panel -->
      <div class="right-panel">
        <!-- Status cards -->
        <div class="cards-row">
          ${['AUTO','PARTIAL','MANUAL','SKIP'].map(s => `
            <div class="sum-card ${s.toLowerCase()}" data-filter-status="${s}">
              <div class="val">${summary[s.toLowerCase()]}</div>
              <div class="lbl">${s}</div>
            </div>`).join('')}
        </div>

        <!-- Issue chips -->
        <div>
          <div class="section-title">⚠️ Detected issues</div>
          <div class="chips-row">
            ${Object.entries(issues_summary)
              .map(([flag, count]) => `
                <div class="issue-chip${count === 0 ? ' hidden' : ''}" data-filter-issue="${flag}">
                  <div class="ic-count">${count}</div>
                  <div class="ic-label">${flag}</div>
                </div>`).join('')}
          </div>
        </div>

        <!-- Filter bar -->
        <div class="filter-bar" id="filter-bar">
          <span>🔍 Filter: <b id="filter-label"></b></span>
          <span id="filter-count"></span>
          <button class="clear-btn" id="filter-clear-btn">✕ Clear</button>
        </div>

        <!-- Job table -->
        <div>
          <div class="section-title">📋 Jobs <span class="count-badge" id="visible-count">${jobs.length}</span></div>
          <div class="table-wrap">
            <table class="job-table">
              <thead><tr>
                <th>Job</th><th style="width:80px">Status</th>
                <th>Issues</th><th style="width:110px">Score</th>
              </tr></thead>
              <tbody>
                ${jobs.map(j => {
                  const issueHtml = j.issues.length
                    ? j.issues.map(i =>
                        `<span class="issue-tag${i.flag==='MANUAL'?' manual':''}">${i.flag}</span>`
                      ).join('')
                    : '<span style="color:#aaa">—</span>';
                  const scoreHtml = j.score === null
                    ? '<span style="color:#aaa;font-size:10px">n/a</span>'
                    : `<div class="score-bar-wrap">
                        <div class="score-bar">
                          <div class="score-bar-fill"
                            style="background:${STATUS_COLOR[j.status]};width:${Math.max(j.score,3)}%">
                          </div>
                        </div>
                        <span style="font-size:10px;font-weight:700;color:#555;min-width:28px">${j.score}%</span>
                       </div>`;
                  return `<tr data-status="${j.status}" data-issues="${j.issues.map(i=>i.flag).join(' ')}">
                    <td>${j.name}</td>
                    <td><span class="status-badge badge-${j.status.toLowerCase()}">${j.status}</span></td>
                    <td>${issueHtml}</td>
                    <td>${scoreHtml}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
            <div class="no-results hidden" id="no-results">No jobs match the current filter</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // Wire up filters
  initFilters();
  $('clear-filter-btn').classList.remove('hidden');
}

// ── Filter logic ───────────────────────────────────────────────────────────
let activeStatus = null, activeIssue = null;

function initFilters() {
  $('panel-results').addEventListener('click', e => {
    const card = e.target.closest('.sum-card');
    const chip = e.target.closest('.issue-chip');
    const clear = e.target.closest('#filter-clear-btn');
    if (card) toggleStatusFilter(card.dataset.filterStatus);
    if (chip) toggleIssueFilter(chip.dataset.filterIssue);
    if (clear) clearFilter();
  });
}

function toggleStatusFilter(status) {
  activeStatus = activeStatus === status ? null : status;
  if (activeStatus) activeIssue = null;
  applyFilter();
}

function toggleIssueFilter(issue) {
  activeIssue = activeIssue === issue ? null : issue;
  if (activeIssue) activeStatus = null;
  applyFilter();
}

function clearFilter() {
  activeStatus = null; activeIssue = null;
  applyFilter();
}

function applyFilter() {
  document.querySelectorAll('.sum-card').forEach(c => {
    c.classList.remove('active-filter','dimmed');
    if (activeStatus) {
      c.dataset.filterStatus === activeStatus
        ? c.classList.add('active-filter')
        : c.classList.add('dimmed');
    }
  });
  document.querySelectorAll('.issue-chip').forEach(c => {
    c.classList.remove('active-filter','dimmed');
    if (activeIssue) {
      c.dataset.filterIssue === activeIssue
        ? c.classList.add('active-filter')
        : c.classList.add('dimmed');
    }
  });

  const rows = document.querySelectorAll('.job-table tbody tr');
  let visible = 0;
  rows.forEach(row => {
    let show = true;
    if (activeStatus && row.dataset.status !== activeStatus) show = false;
    if (activeIssue && !(row.dataset.issues || '').includes(activeIssue)) show = false;
    row.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  const noResults = $('no-results');
  if (noResults) noResults.classList.toggle('hidden', visible > 0);

  const countEl = $('visible-count');
  if (countEl) countEl.textContent =
    (activeStatus || activeIssue) ? `${visible} of ${scanResult.jobs.length}` : String(scanResult.jobs.length);

  const bar = $('filter-bar');
  if (bar) {
    if (activeStatus || activeIssue) {
      bar.classList.add('visible');
      $('filter-label').textContent = activeStatus || activeIssue;
      $('filter-count').textContent = `— ${visible} jobs`;
    } else {
      bar.classList.remove('visible');
    }
  }
}

// ── Issues tab rendering (Task 7) ─────────────────────────────────────────
const ISSUE_META = {
  JAVA_EXPR: {
    cls: 'java', icon: '⚡',
    title: 'JAVA_EXPR_SKIPPED — Java expressions not auto-converted',
    fix: flag => `💡 Replace with SQL: <code>NULLIF(NULLIF(TRIM(col), ''), '\\N')</code>`,
  },
  JOIN_EDGE_STALE: {
    cls: 'join', icon: '🔗',
    title: 'JOIN_EDGE_STALE — JOIN keys must be set manually in VF UI',
    fix: () => '💡 Open job in VF → JOIN node → set leftKey / rightKey manually',
  },
  STALE_LEFTDATASET: {
    cls: 'stale', icon: '🔀',
    title: 'STALE_LEFTDATASET — leftDataset removed from graph',
    fix: () => '💡 Open job in VF → JOIN node → reconnect leftDataset manually',
  },
  UNKNOWN_COMPONENT: {
    cls: 'unknown', icon: '❓',
    title: 'UNKNOWN_COMPONENT — Component has no VF equivalent mapping',
    fix: () => '💡 Add component to COMPONENT_MAP or implement manually in VF',
  },
};

function renderIssues(result) {
  const { jobs, issues_summary } = result;

  // Build per-flag groups
  const flagGroups = {};
  for (const job of jobs) {
    for (const issue of job.issues) {
      if (!flagGroups[issue.flag]) flagGroups[issue.flag] = [];
      flagGroups[issue.flag].push({ job: job.name, ...issue });
    }
  }

  // Manual jobs group
  const manualJobs = jobs.filter(j => j.status === 'MANUAL');

  let html = '<div class="issues-panel">';

  // Render each flag group
  for (const [flag, meta] of Object.entries(ISSUE_META)) {
    const items = flagGroups[flag] || [];
    if (items.length === 0) continue;
    html += `
    <div class="issue-group ${meta.cls}" id="ig-${flag}">
      <div class="issue-group-header" onclick="this.closest('.issue-group').classList.toggle('collapsed')">
        <div class="ig-icon">${meta.icon}</div>
        <div class="ig-title">${meta.title}</div>
        <div class="ig-count">${items.length} node${items.length>1?'s':''}</div>
        <div class="ig-chevron">▼</div>
      </div>
      <div class="issue-group-body">
        ${items.map(item => `
          <div class="issue-item">
            <div class="ii-job">${item.job}
              <span class="job-link" data-goto="PARTIAL">→ view in Results</span>
            </div>
            <div class="ii-node">📍 ${item.node}</div>
            ${item.detail ? `<div class="ii-detail">${item.detail}</div>` : ''}
            <div class="ii-fix">${meta.fix(item)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // tJava / MANUAL group
  if (manualJobs.length > 0) {
    html += `
    <div class="issue-group tjava" id="ig-MANUAL">
      <div class="issue-group-header" onclick="this.closest('.issue-group').classList.toggle('collapsed')">
        <div class="ig-icon">☕</div>
        <div class="ig-title">tJava — no VF equivalent, requires manual implementation</div>
        <div class="ig-count">${manualJobs.length} job${manualJobs.length>1?'s':''}</div>
        <div class="ig-chevron">▼</div>
      </div>
      <div class="issue-group-body">
        ${manualJobs.map(job => `
          <div class="issue-item">
            <div class="ii-job">${job.name}
              <span class="job-link" data-goto="MANUAL">→ view in Results</span>
            </div>
            <div class="ii-node">📍 tJava node present</div>
            <div class="ii-fix">💡 Rewrite Java logic as SQL TRANSFORM in VF, or extract to a microservice</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  if (html === '<div class="issues-panel">') {
    html += '<p style="padding:20px;color:#aaa;text-align:center;">No issues detected — all jobs migrate automatically! 🎉</p>';
  }

  html += '</div>';
  $('panel-issues').innerHTML = html;

  // Wire "view in Results" links
  $('panel-issues').addEventListener('click', e => {
    const link = e.target.closest('.job-link');
    if (link) {
      const status = link.dataset.goto;
      switchTab('results');
      toggleStatusFilter(status);
    }
  });
}

// ── PDF (Task 9) ───────────────────────────────────────────────────────────
$('pdf-btn').addEventListener('click', generatePdf);
document.addEventListener('click', e => {
  if (e.target.id === 'export-btn') generatePdf();
});

async function generatePdf() {
  alert('PDF generation — implemented in Task 9');
}

// ── Filter button wired dynamically inside renderResults / initFilters ────
