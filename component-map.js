// component-map.js
// Synced from: github.com/visual-flow/imdb-talend/blob/main/migrate_to_vf.py
// Last synced: 2026-04-07
// When migrate_to_vf.py adds new component mappings, update this file manually.

export const COMPONENT_MAP = {
  // ── READ (database) ──────────────────────────────────────────────────────
  tMSSqlInput:          { operation: 'READ',              storage: 'mssql' },
  tMysqlInput:          { operation: 'READ',              storage: 'mysql' },
  tPostgresqlInput:     { operation: 'READ',              storage: 'postgresql' },
  tOracleInput:         { operation: 'READ',              storage: 'oracle' },
  tDBInput:             { operation: 'READ',              storage: 'jdbc' },
  tSnowflakeInput:      { operation: 'READ',              storage: 'snowflake' },
  tRedshiftInput:       { operation: 'READ',              storage: 'redshift' },
  tSqliteInput:         { operation: 'READ',              storage: 'sqlite' },
  tAccessInput:         { operation: 'READ',              storage: 'access' },

  // ── READ (file / stream) ─────────────────────────────────────────────────
  tFileInputDelimited:  { operation: 'READ',              storage: 'cluster' },
  tFileInputExcel:      { operation: 'READ',              storage: 'cluster' },
  tFileInputJSON:       { operation: 'READ',              storage: 'json' },
  tFileInputXML:        { operation: 'READ',              storage: 'xml' },
  tFileInputParquet:    { operation: 'READ',              storage: 'parquet' },
  tRowGenerator:        { operation: 'READ',              storage: 'cluster' },
  tFileInputMSXML:      { operation: 'READ',              storage: 'xml' },
  tFixedFlowInput:      { operation: 'READ',              storage: 'cluster' },

  // ── WRITE (database) ─────────────────────────────────────────────────────
  tMSSqlOutput:         { operation: 'WRITE',             storage: 'mssql' },
  tMysqlOutput:         { operation: 'WRITE',             storage: 'mysql' },
  tPostgresqlOutput:    { operation: 'WRITE',             storage: 'postgresql' },
  tOracleOutput:        { operation: 'WRITE',             storage: 'oracle' },
  tDBOutput:            { operation: 'WRITE',             storage: 'jdbc' },
  tSnowflakeOutput:     { operation: 'WRITE',             storage: 'snowflake' },
  tRedshiftOutput:      { operation: 'WRITE',             storage: 'redshift' },
  tSqliteOutput:        { operation: 'WRITE',             storage: 'sqlite' },

  // ── WRITE (file / stream) ────────────────────────────────────────────────
  tFileOutputDelimited: { operation: 'WRITE',             storage: 'cluster' },
  tFileOutputExcel:     { operation: 'WRITE',             storage: 'cluster' },
  tFileOutputJSON:      { operation: 'WRITE',             storage: 'json' },
  tFileOutputXML:       { operation: 'WRITE',             storage: 'xml' },
  tAdvancedFileOutputXML: { operation: 'WRITE',            storage: 'xml' },
  tLogRow:              { operation: 'WRITE',             storage: 'stdout' },

  // ── TRANSFORM ────────────────────────────────────────────────────────────
  tMap:                 { operation: 'TRANSFORM' },
  tNormalize:           { operation: 'TRANSFORM' },
  tDenormalize:         { operation: 'TRANSFORM' },
  tMSSqlRow:            { operation: 'TRANSFORM' },
  tMysqlRow:            { operation: 'TRANSFORM' },
  tPostgresqlRow:       { operation: 'TRANSFORM' },
  tOracleRow:           { operation: 'TRANSFORM' },
  tDBRow:               { operation: 'TRANSFORM' },
  tReplicate:           { operation: 'TRANSFORM' },
  tConvertType:         { operation: 'TRANSFORM' },
  tSetGlobalVar:        { operation: 'TRANSFORM' },
  tFlowToIterate:       { operation: 'TRANSFORM' },
  tExtractDelimitedFields: { operation: 'TRANSFORM' },
  tReplace:             { operation: 'TRANSFORM' },
  tIterateToFlow:       { operation: 'TRANSFORM' },
  tFileConcat:          { operation: 'TRANSFORM' },
  tSchemaComplianceCheck: { operation: 'TRANSFORM' },

  // ── REST / HTTP / ESB ─────────────────────────────────────────────────────
  tRESTClient:          { operation: 'READ',              storage: 'rest' },
  tRESTRequest:         { operation: 'READ',              storage: 'rest' },
  tRESTResponse:        { operation: 'WRITE',             storage: 'rest' },
  tHTTPClient:          { operation: 'READ',              storage: 'rest' },
  tHttpRequest:         { operation: 'READ',              storage: 'rest' },
  tSOAP:                { operation: 'READ',              storage: 'soap' },
  tESBConsumer:         { operation: 'READ',              storage: 'esb' },
  tESBProviderRequest:  { operation: 'READ',              storage: 'esb' },
  tESBProviderResponse: { operation: 'WRITE',             storage: 'esb' },
  tESBProviderFault:    { operation: 'WRITE',             storage: 'esb' },
  tRouteInput:          { operation: 'READ',              storage: 'esb' },
  tRouteOutput:         { operation: 'WRITE',             storage: 'esb' },

  // ── XML / JSON extraction ────────────────────────────────────────────────
  tExtractXMLField:     { operation: 'TRANSFORM' },
  tExtractJSONFields:   { operation: 'TRANSFORM' },
  tXMLMap:              { operation: 'TRANSFORM' },
  tComplexXMLInput:     { operation: 'READ',              storage: 'xml' },

  // ── GROUP / SORT / FILTER / DEDUP / JOIN ─────────────────────────────────
  tAggregateRow:        { operation: 'GROUP' },
  tSortRow:             { operation: 'SORT' },
  tFilterRows:          { operation: 'FILTER' },
  tFilterRow:           { operation: 'FILTER' },
  tSampleRow:           { operation: 'FILTER' },
  tUniqRow:             { operation: 'REMOVE_DUPLICATES' },
  tJoin:                { operation: 'JOIN' },
  tUnite:               { operation: 'UNION' },
};

// Components with no VF analog — excluded from node count and scoring
export const SKIP_COMPONENTS = new Set([
  'tParallelize', 'tContextLoad', 'tContextDump',
  'tFileUnarchive', 'tFileArchive',
  'tRunJob', 'tPreJob', 'tPostJob',
  'tWarn', 'tDie', 'tAssert',
  'tMsgBox', 'tSleep',
  'tCreateTemporaryFile', 'tFileDelete', 'tFileCopy', 'tFileExist',
  'tMysqlConnection', 'tMysqlCommit', 'tMysqlRollback', 'tMysqlClose',
  'tMSSqlConnection', 'tMSSqlCommit', 'tMSSqlRollback', 'tMSSqlClose',
  'tPostgresqlConnection', 'tPostgresqlCommit', 'tPostgresqlRollback', 'tPostgresqlClose',
  'tOracleConnection', 'tOracleCommit', 'tOracleRollback', 'tOracleClose',
  'tDBConnection', 'tDBCommit', 'tDBRollback', 'tDBClose',
  'tSnowflakeConnection', 'tSnowflakeClose',
  'DI_CNTL_Job_Tracking_Stats',
  // ESB / route lifecycle
  'tRouteLoop', 'tRouteFault', 'tRouteDirectInput',
  'tRESTRequestLoop', 'tESBProviderRequestLoop',
  'tSetHeader', 'tSetBody',
  // FTP utilities
  'tFTPFileList', 'tFTPRename', 'tFTPDelete', 'tFTPExist', 'tFTPGet', 'tFTPPut',
  'tFTPConnection', 'tFTPClose',
  'tSFTPGet', 'tSFTPPut', 'tSFTPConnection', 'tSFTPClose',
  // File system iterators / utilities
  'tFileList', 'tFileProperties', 'tFileTouch', 'tFileCompare',
  'tFileFetch', 'tFileRename',
]);
