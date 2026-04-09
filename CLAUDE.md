# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install fast-xml-parser (tests only — no runtime deps)
npm test           # run unit tests (Node.js built-in test runner)
npm run serve      # local dev server at http://localhost:8080
```

Run a single test file:
```bash
node --test tests/analyzer.test.mjs
node --test tests/component-map.test.mjs
```

## Architecture

Pure client-side browser app. No build step. Deployed as static files to GitHub Pages.

```
index.html           — UI shell, tab structure, upload zone
style.css            — all styles
report.js            — main thread: file upload, tab nav, rendering, PDF generation
scanner.worker.js    — Web Worker: ZIP extraction (fflate), XML parsing (fast-xml-parser), job classification
analyzer.js          — ES module: pure classification logic (classifyNode, classifyJob, scoreJob, buildResult)
analyzer-umd.js      — UMD bridge of analyzer.js for importScripts() in the Worker
component-map.js     — ES module: COMPONENT_MAP and SKIP_COMPONENTS
component-map-umd.js — UMD bridge of component-map.js for the Worker
vendor/              — fast-xml-parser bundled locally (no CDN)
tests/               — Node.js test files (.mjs, ES modules)
```

### Module duplication pattern

The Worker runs as a classic worker (`importScripts`), which cannot use ES module `import`. So every module that the Worker needs exists in two forms:
- `foo.js` — ES module (used by tests via `import`)
- `foo-umd.js` — IIFE that attaches to `self.TMS_*` (used by Worker via `importScripts`)

**These two files must always be kept in sync.** The UMD version is a manual copy — there is no build step.

### Data flow

1. User drops ZIP → `report.js` sends `{type:'scan', buffer}` to Worker
2. Worker: fflate unzip → filter `.item` files under `/process/` → parse each XML
3. For each TOS job node: `classifyNode()` → collect issues → `classifyJob()` → `scoreJob()`
4. Worker posts `{type:'result', data}` → `report.js` renders tabs and PDF

### TOS XML structure (critical)

- Root element: `<talendfile:ProcessType>` → parsed as `xmlDoc.ProcessType` (removeNSPrefix:true)
- Node names: NOT in `<node name="...">` but in `elementParameter[name='UNIQUE_NAME'][value]`
- tMap expressions: NOT in `elementParameter[@value]` — in `nodeData.outputTables[].mapperTableEntries[@expression]`
- Connections: `<connection source="tDBInput_3" target="tMap_1">` at same level as `<node>` elements
- Arrays requiring `isArray` config: `node, elementParameter, connection, outputTables, inputTables, mapperTableEntries`

### Classification rules (mirrors migrate_to_vf.py)

**JAVA_EXPR** — tMap expressions not auto-converted by migrate_to_vf.py:
- `TalendString.*`, `TalendDate.*` (except `parseDate`), `TalendDataGenerator.*`, `StringHandling.*`
- `new java.*` (except `new java.util.Date((long)(col*1000)/1000)` → auto-converts to `from_unixtime()`)
- `Relational.ISNULL...? null : col.trim()` — only when `.trim()` is in the RESULT of the ternary (not in the condition)
- Audit columns (`DI_Create_DT`, `DI_Update_DT`, etc.) are skipped — migrate_to_vf.py skips these via `_TALEND_AUDIT_COLS`

**JOIN_EDGE_STALE** — WRITE node feeds into tMap AND tMap has 2+ total input flows (connection graph analysis)

**STALE_LEFTDATASET** — connection references a source node that doesn't exist in the job graph

**Job status priority**: SKIP → MANUAL → PARTIAL → AUTO

### Sync with migrate_to_vf.py

`COMPONENT_MAP` and `SKIP_COMPONENTS` in `component-map.js` / `component-map-umd.js` must match the production migration script at `C:\Users\ashevelev\IMDb-Talend\migrate_to_vf.py`.

JAVA_EXPR patterns in `analyzer.js` / `analyzer-umd.js` must match `_SKIP_JAVA_FNS` and `_java_expr_to_sql()` in migrate_to_vf.py.
