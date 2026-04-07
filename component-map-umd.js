// component-map-umd.js
// UMD bridge — wraps component-map.js for classic Worker importScripts
// Attaches COMPONENT_MAP and SKIP_COMPONENTS to self.TMS_MAP
// This allows scanner.worker.js to access these exports without ES module syntax

self.TMS_MAP = (function() {
  const COMPONENT_MAP = {
    tMSSqlInput:          { operation: 'READ',              storage: 'mssql' },
    tFileInputDelimited:  { operation: 'READ',              storage: 'cluster' },
    tRowGenerator:        { operation: 'READ',              storage: 'cluster' },
    tMSSqlOutput:         { operation: 'WRITE',             storage: 'mssql' },
    tFileOutputDelimited: { operation: 'WRITE',             storage: 'cluster' },
    tLogRow:              { operation: 'WRITE',             storage: 'stdout' },
    tMap:                 { operation: 'TRANSFORM' },
    tNormalize:           { operation: 'TRANSFORM' },
    tMSSqlRow:            { operation: 'TRANSFORM' },
    tAggregateRow:        { operation: 'GROUP' },
    tSortRow:             { operation: 'SORT' },
    tFilterRows:          { operation: 'FILTER' },
    tUniqRow:             { operation: 'REMOVE_DUPLICATES' },
    tJoin:                { operation: 'JOIN' },
    tReplicate:           { operation: 'TRANSFORM' },
  };

  const SKIP_COMPONENTS = new Set([
    'tParallelize',
    'tContextLoad',
    'tFileUnarchive',
    'tRunJob',
    'DI_CNTL_Job_Tracking_Stats',
  ]);

  return { COMPONENT_MAP, SKIP_COMPONENTS };
})();
