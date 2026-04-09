// analyzer.js
// Pure analysis functions — no browser APIs, fully testable in Node.js

// Only patterns that migrate_to_vf.py cannot auto-convert to SQL.
// Convertible patterns (Relational.ISNULL, .trim(), Numeric., Integer.parseInt etc.)
// are intentionally excluded — they map to NULLIF/TRIM/CAST and are handled automatically.
const JAVA_EXPR_PATTERNS = [
  // Relational.ISNULL null-check where the ternary RESULT contains .trim() — not auto-converted.
  // migrate_to_vf.py converts "? null : table.col" (simple ref) but NOT "? null : table.col.trim()".
  // .trim() in the CONDITION (before ?) IS handled — only flag when it appears after "? null :".
  /Relational\.ISNULL[^\n]*\?\s*null\s*:[^\n]*\.trim\s*\(/,
  /TalendString\./,          // string utility class — no SQL equivalent
  /TalendDate\.(?!parseDate)/, // date utility (except parseDate → to_date())
  /TalendDataGenerator\./,   // data gen — no SQL equivalent
  /StringHandling\./,        // string util class — no SQL equivalent
  /\bnew\s+java\./,          // Java constructors — no SQL equivalent
];

/**
 * Classify a single TOS node.
 * @param {string} componentType  - e.g. 'tMSSqlInput'
 * @param {string} expressionText - concatenated expression strings from the node's XML
 * @param {Object} componentMap   - COMPONENT_MAP
 * @param {Set}    skipComponents - SKIP_COMPONENTS
 * @returns {{ type: 'mapped'|'skip'|'java'|'unknown', flag: string|null }}
 */
export function classifyNode(componentType, expressionText, componentMap, skipComponents) {
  if (componentType === 'tJava' || componentType === 'tJavaRow' || componentType === 'tJavaFlex') {
    return { type: 'java', flag: null };
  }
  if (skipComponents.has(componentType)) {
    return { type: 'skip', flag: null };
  }
  if (!(componentType in componentMap)) {
    return { type: 'unknown', flag: 'UNKNOWN_COMPONENT' };
  }
  // Check for Java expressions in tMap nodes
  if (componentType === 'tMap' && expressionText) {
    for (const pattern of JAVA_EXPR_PATTERNS) {
      if (pattern.test(expressionText)) {
        return { type: 'mapped', flag: 'JAVA_EXPR' };
      }
    }
  }
  return { type: 'mapped', flag: null };
}

/**
 * Classify a job based on its array of node results.
 * Priority: SKIP → MANUAL → PARTIAL → AUTO
 * @param {Array<{type: string, flag: string|null}>} nodes
 * @returns {'AUTO'|'PARTIAL'|'MANUAL'|'SKIP'}
 */
export function classifyJob(nodes) {
  const mappable = nodes.filter(n => n.type !== 'skip');
  if (mappable.length === 0) return 'SKIP';
  if (mappable.some(n => n.type === 'java')) return 'MANUAL';
  if (mappable.some(n => n.flag !== null)) return 'PARTIAL';
  return 'AUTO';
}

/**
 * Calculate per-job migration score.
 * @param {'AUTO'|'PARTIAL'|'MANUAL'|'SKIP'} status
 * @param {Array<{type: string, flag: string|null}>} nodes
 * @returns {number|null} 0-100 or null for SKIP
 */
export function scoreJob(status, nodes) {
  if (status === 'AUTO')    return 100;
  if (status === 'MANUAL')  return 0;
  if (status === 'SKIP')    return null;
  // PARTIAL: clean mapped nodes / total mappable nodes
  const mappable = nodes.filter(n => n.type !== 'skip');
  const clean    = mappable.filter(n => n.flag === null && n.type !== 'java');
  return Math.round((clean.length / mappable.length) * 100);
}

/**
 * Build the final result JSON from an array of classified jobs.
 * @param {Array} jobs     - each job has { name, status, nodes, issues, score }
 * @param {number} elapsed - analysis time in ms
 * @returns {Object} result JSON matching the spec schema
 */
export function buildResult(jobs, elapsed) {
  const nonSkip = jobs.filter(j => j.status !== 'SKIP');
  const autoPct = nonSkip.length === 0
    ? 0
    : Math.round((jobs.filter(j => j.status === 'AUTO').length / nonSkip.length) * 1000) / 10;

  const issuesSummary = {
    JAVA_EXPR: 0, JOIN_EDGE_STALE: 0, STALE_LEFTDATASET: 0, UNKNOWN_COMPONENT: 0,
    MANUAL: 0, SKIP_REASON: 0,
  };
  for (const job of jobs) {
    for (const issue of job.issues) {
      if (issue.flag in issuesSummary) issuesSummary[issue.flag]++;
    }
  }

  return {
    summary: {
      total_jobs:   jobs.length,
      auto:         jobs.filter(j => j.status === 'AUTO').length,
      partial:      jobs.filter(j => j.status === 'PARTIAL').length,
      manual:       jobs.filter(j => j.status === 'MANUAL').length,
      skip:         jobs.filter(j => j.status === 'SKIP').length,
      auto_pct:     autoPct,
      analysis_ms:  elapsed,
    },
    issues_summary: issuesSummary,
    jobs,
  };
}
