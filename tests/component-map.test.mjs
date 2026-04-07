import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { COMPONENT_MAP, SKIP_COMPONENTS } from '../component-map.js';

describe('COMPONENT_MAP', () => {
  it('has all 15 required components', () => {
    const required = [
      'tMSSqlInput','tFileInputDelimited','tRowGenerator',
      'tMSSqlOutput','tFileOutputDelimited','tLogRow',
      'tMap','tNormalize','tMSSqlRow','tAggregateRow',
      'tSortRow','tFilterRows','tUniqRow','tJoin','tReplicate'
    ];
    for (const c of required) {
      assert.ok(c in COMPONENT_MAP, `Missing: ${c}`);
    }
  });

  it('every entry has an operation field', () => {
    for (const [key, val] of Object.entries(COMPONENT_MAP)) {
      assert.ok(val.operation, `${key} missing operation`);
    }
  });

  it('SKIP_COMPONENTS contains required entries', () => {
    const required = ['tParallelize','tContextLoad','tFileUnarchive','tRunJob','DI_CNTL_Job_Tracking_Stats'];
    for (const c of required) {
      assert.ok(SKIP_COMPONENTS.has(c), `Missing in SKIP_COMPONENTS: ${c}`);
    }
  });

  it('tJava is NOT in SKIP_COMPONENTS', () => {
    assert.ok(!SKIP_COMPONENTS.has('tJava'));
  });

  it('tJava is NOT in COMPONENT_MAP', () => {
    assert.ok(!('tJava' in COMPONENT_MAP));
  });
});
