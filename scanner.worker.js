// scanner.worker.js
// Web Worker for ZIP extraction, XML parsing, and TOS job classification
// Runs in a Web Worker context. Receives: { type: 'scan', buffer: ArrayBuffer, filename: string }
// Posts: { type: 'progress', pct, job } during scanning
// Posts: { type: 'result', data }       when done
// Posts: { type: 'error', message }     on failure

importScripts(
  'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js',
  'vendor/fast-xml-parser.min.js',
);

// ── Load local modules ─────────────────────────────────────────────────────
// Because we can't use ES module imports in a classic worker,
// we use a self-executing pattern: each module checks for `self` and
// attaches exports to it.
importScripts('component-map-umd.js', 'analyzer-umd.js');

const { COMPONENT_MAP, SKIP_COMPONENTS } = self.TMS_MAP;
const { classifyNode, classifyJob, scoreJob, buildResult } = self.TMS_ANALYZER;

// ── XML parser config ──────────────────────────────────────────────────────
const XML_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => ['node', 'elementParameter'].includes(name),
};

// ── Main handler ───────────────────────────────────────────────────────────
self.onmessage = function(e) {
  const { type, buffer, filename } = e.data;
  if (type !== 'scan') return;

  const t0 = Date.now();

  try {
    // 1. Decompress ZIP
    const uint8 = new Uint8Array(buffer);
    let files;
    try {
      files = fflate.unzipSync(uint8);
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Cannot read archive. File may be corrupted.' });
      return;
    }

    // 2. Find job .item files (only under /process/ — skip metadata/, context/, etc.)
    const allItems = Object.entries(files).filter(([path]) => path.endsWith('.item'));
    let itemEntries = allItems.filter(([path]) => {
      const lower = path.toLowerCase().replace(/\\/g, '/');
      return lower.includes('/process/');
    });
    // Fallback: if no /process/ folder found, use all .item files (flat export or test fixtures)
    if (itemEntries.length === 0 && allItems.length > 0) {
      itemEntries = allItems;
    }
    if (itemEntries.length === 0) {
      self.postMessage({ type: 'error', message: 'No .item files found. Is this a TOS project?' });
      return;
    }

    // Detect TOS version from .project file (if present)
    let tosVersion = null;
    for (const [path, bytes] of Object.entries(files)) {
      if (path.endsWith('.project')) {
        try {
          const content = new TextDecoder().decode(bytes);
          const match = content.match(/<technicalLabel>([^<]+)<\/technicalLabel>/);
          if (match) tosVersion = match[1];
        } catch (_) {}
        break;
      }
    }

    // 3. Parse and classify each job
    const jobs = [];
    let skippedXml = 0;

    for (let i = 0; i < itemEntries.length; i++) {
      const [path, bytes] = itemEntries[i];
      const jobName = path.split('/').pop().replace('.item', '');

      // Progress update
      self.postMessage({
        type: 'progress',
        pct: Math.round(((i + 1) / itemEntries.length) * 100),
        job: jobName,
        current: i + 1,
        total: itemEntries.length,
      });

      // Parse XML
      let xmlDoc;
      try {
        const xmlStr = new TextDecoder().decode(bytes);
        const parser = new fxparser.XMLParser(XML_OPTS);
        xmlDoc = parser.parse(xmlStr);
      } catch (err) {
        skippedXml++;
        continue;
      }

      // Extract nodes
      // Real TOS files: root is <talendfile:ProcessType> → after removeNSPrefix → ProcessType
      // Test fixtures: root is <talendfile> → talendfile
      const root = xmlDoc?.ProcessType || xmlDoc?.talendfile || {};
      const rawNodes = root?.node || [];
      const nodeResults = [];
      const issues = [];

      for (const rawNode of rawNodes) {
        const componentType = rawNode['@_componentName'] || '';

        // Collect expression text from elementParameter values
        const params = rawNode.elementParameter || [];
        const exprText = params
          .map(p => String(p['@_value'] || ''))
          .join('\n');

        const result = classifyNode(componentType, exprText, COMPONENT_MAP, SKIP_COMPONENTS);
        nodeResults.push(result);

        // Push MANUAL issue for java nodes so they appear in job table + Issues panel
        if (result.type === 'java') {
          issues.push({
            flag: 'MANUAL',
            node: rawNode['@_name'] || componentType,
            component: componentType,
            detail: `${componentType} — custom Java code, must be reimplemented manually`,
          });
        }

        // Combined issue push — exactly one push per node, no double-push possible.
        // For tMap with leftDataset: JOIN_EDGE_STALE / STALE_LEFTDATASET take priority.
        const leftDataset = rawNode['@_leftDataset'] || '';
        if (componentType === 'tMap' && leftDataset) {
          // Priority 1: leftDataset refers to a WRITE node → JOIN_EDGE_STALE
          const refNode = rawNodes.find(n => (n['@_name'] || '') === leftDataset);
          if (refNode && COMPONENT_MAP[refNode['@_componentName'] || '']?.operation === 'WRITE') {
            issues.push({
              flag: 'JOIN_EDGE_STALE',
              node: rawNode['@_name'] || componentType,
              detail: `leftDataset='${leftDataset}' references a WRITE node`,
            });
          // Priority 2: leftDataset references a node not present in graph → STALE_LEFTDATASET
          } else if (!refNode) {
            issues.push({
              flag: 'STALE_LEFTDATASET',
              node: rawNode['@_name'] || componentType,
              detail: `leftDataset='${leftDataset}' not found in job graph`,
            });
          // Priority 3: no leftDataset edge issue — fall back to classifyNode flag if any
          } else if (result.flag) {
            issues.push({
              flag: result.flag,
              node: rawNode['@_name'] || componentType,
              detail: result.flag === 'UNKNOWN_COMPONENT'
                ? `Component '${componentType}' is not in COMPONENT_MAP`
                : exprText.slice(0, 120),
            });
          }
        } else if (result.flag) {
          // Non-tMap nodes (or tMap with no leftDataset): push classifyNode flag normally
          issues.push({
            flag: result.flag,
            node: rawNode['@_name'] || componentType,
            detail: result.flag === 'UNKNOWN_COMPONENT'
              ? `Component '${componentType}' is not in COMPONENT_MAP`
              : exprText.slice(0, 120),
          });
        }
      }

      const status = classifyJob(nodeResults);
      const score  = scoreJob(status, nodeResults);

      // For SKIP jobs: add informational issues listing the skipped component types
      if (status === 'SKIP' && rawNodes.length > 0) {
        const skipNames = [...new Set(rawNodes.map(n => n['@_componentName'] || '').filter(Boolean))];
        for (const name of skipNames) {
          issues.push({
            flag: 'SKIP_REASON',
            node: name,
            component: name,
            detail: `${name} — no VF equivalent, job excluded from migration`,
          });
        }
      }

      jobs.push({ name: jobName, status, nodes: nodeResults.length, issues, score });
    }

    // 4. Build result
    const result = buildResult(jobs, Date.now() - t0);
    result.meta = { filename, skipped_xml: skippedXml, tos_version: tosVersion };

    self.postMessage({ type: 'result', data: result });

  } catch (err) {
    self.postMessage({ type: 'error', message: `Unexpected error: ${err.message}` });
  }
};
