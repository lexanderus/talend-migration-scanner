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

// ── Placeholder render functions (implemented in Tasks 6–9) ──────────────
function renderResults(result, filename) {
  $('panel-results').innerHTML = `<div style="padding:20px;font-family:monospace;font-size:12px;">
    <pre>${JSON.stringify(result.summary, null, 2)}</pre>
  </div>`;
}

function renderIssues(result) {
  $('panel-issues').innerHTML = '<p style="padding:20px;">Issues panel — Task 7</p>';
}

// ── PDF (Task 9) ───────────────────────────────────────────────────────────
$('pdf-btn').addEventListener('click', generatePdf);
document.addEventListener('click', e => {
  if (e.target.id === 'export-btn') generatePdf();
});

async function generatePdf() {
  alert('PDF generation — implemented in Task 9');
}

// ── Filter button (wired in Task 6) ───────────────────────────────────────
$('clear-filter-btn').addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('tms:clearfilter'));
});
