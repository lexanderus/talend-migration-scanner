// component-map.js
// Synced from: github.com/visual-flow/imdb-talend/blob/main/migrate_to_vf.py
// Last synced: 2026-04-07
// When migrate_to_vf.py adds new component mappings, update this file manually.

export const COMPONENT_MAP = {
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

// Components with no VF analog — excluded from node count and scoring
export const SKIP_COMPONENTS = new Set([
  'tParallelize', 'tContextLoad',
  'tFileUnarchive', 'tRunJob', 'DI_CNTL_Job_Tracking_Stats',
]);
