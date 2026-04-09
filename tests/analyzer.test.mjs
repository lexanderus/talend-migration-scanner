import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  classifyNode, classifyJob, scoreJob, buildResult
} from '../analyzer.js';
import { COMPONENT_MAP, SKIP_COMPONENTS } from '../component-map.js';

describe('classifyNode', () => {
  it('returns mapped for known component', () => {
    const r = classifyNode('tMSSqlInput', '', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'mapped');
    assert.equal(r.flag, null);
  });

  it('returns skip for SKIP component', () => {
    const r = classifyNode('tRunJob', '', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'skip');
  });

  it('returns java for tJava', () => {
    const r = classifyNode('tJava', '', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'java');
  });

  it('returns java for tJavaRow', () => {
    const r = classifyNode('tJavaRow', '', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'java');
  });

  it('returns java for tJavaFlex', () => {
    const r = classifyNode('tJavaFlex', '', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'java');
  });

  it('returns JAVA_EXPR flag when expression contains TalendString.', () => {
    const r = classifyNode('tMap', 'TalendString.removeAccents(row1.name)', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'mapped');
    assert.equal(r.flag, 'JAVA_EXPR');
  });

  it('returns JAVA_EXPR flag when expression contains TalendDate. (not parseDate)', () => {
    const r = classifyNode('tMap', 'TalendDate.formatDate("yyyy", new Date())', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.flag, 'JAVA_EXPR');
  });

  it('returns JAVA_EXPR for Relational.ISNULL + .trim() chain (not auto-converted)', () => {
    const expr = '(Relational.ISNULL(row1.col)||row1.col.trim().equals(""))?null:row1.col.trim()';
    const r = classifyNode('tMap', expr, COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.flag, 'JAVA_EXPR');
  });

  it('does NOT return JAVA_EXPR for simple Relational.ISNULL (auto-converted)', () => {
    const r = classifyNode('tMap', '(Relational.ISNULL(row1.col)||row1.col.equals("\\\\N"))?null:row1.col', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.flag, null);
  });

  it('does NOT return JAVA_EXPR for auto-convertible .trim() alone', () => {
    const r = classifyNode('tMap', 'someVar.trim()', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.flag, null);
  });

  it('returns UNKNOWN_COMPONENT for unmapped non-skip non-java component', () => {
    const r = classifyNode('tSomeCustomComponent', '', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.type, 'unknown');
    assert.equal(r.flag, 'UNKNOWN_COMPONENT');
  });

  it('returns null flag for clean tMap (no Java expressions)', () => {
    const r = classifyNode('tMap', 'UPPER(name)', COMPONENT_MAP, SKIP_COMPONENTS);
    assert.equal(r.flag, null);
  });
});

describe('classifyJob', () => {
  it('AUTO when all nodes are mapped with no flags', () => {
    const nodes = [
      { type: 'mapped', flag: null },
      { type: 'mapped', flag: null },
      { type: 'skip' },
    ];
    assert.equal(classifyJob(nodes), 'AUTO');
  });

  it('SKIP when zero mappable nodes', () => {
    const nodes = [{ type: 'skip' }, { type: 'skip' }];
    assert.equal(classifyJob(nodes), 'SKIP');
  });

  it('SKIP for empty nodes array', () => {
    assert.equal(classifyJob([]), 'SKIP');
  });

  it('MANUAL when any node is java', () => {
    const nodes = [
      { type: 'mapped', flag: null },
      { type: 'java' },
    ];
    assert.equal(classifyJob(nodes), 'MANUAL');
  });

  it('MANUAL takes priority over flags', () => {
    const nodes = [
      { type: 'java' },
      { type: 'mapped', flag: 'JAVA_EXPR' },
    ];
    assert.equal(classifyJob(nodes), 'MANUAL');
  });

  it('PARTIAL when mapped node has a flag', () => {
    const nodes = [
      { type: 'mapped', flag: 'JAVA_EXPR' },
      { type: 'mapped', flag: null },
    ];
    assert.equal(classifyJob(nodes), 'PARTIAL');
  });

  it('PARTIAL for UNKNOWN_COMPONENT', () => {
    const nodes = [
      { type: 'unknown', flag: 'UNKNOWN_COMPONENT' },
      { type: 'mapped', flag: null },
    ];
    assert.equal(classifyJob(nodes), 'PARTIAL');
  });
});

describe('scoreJob', () => {
  it('AUTO → 100', () => assert.equal(scoreJob('AUTO', []), 100));
  it('MANUAL → 0', () => assert.equal(scoreJob('MANUAL', []), 0));
  it('SKIP → null', () => assert.equal(scoreJob('SKIP', []), null));

  it('PARTIAL → ratio of clean mapped nodes', () => {
    const nodes = [
      { type: 'mapped', flag: 'JAVA_EXPR' },  // problem
      { type: 'mapped', flag: null },           // clean
      { type: 'mapped', flag: null },           // clean
      { type: 'skip' },                         // excluded
    ];
    // 2 clean / 3 mappable = 66.67 → rounds to 67
    assert.equal(scoreJob('PARTIAL', nodes), 67);
  });
});

describe('buildResult', () => {
  it('returns correct summary for a mix of jobs', () => {
    const jobs = [
      { name: 'a', status: 'AUTO',    nodes: [], issues: [], score: 100 },
      { name: 'b', status: 'AUTO',    nodes: [], issues: [], score: 100 },
      { name: 'c', status: 'PARTIAL', nodes: [], issues: [{ flag: 'JAVA_EXPR' }], score: 80 },
      { name: 'd', status: 'MANUAL',  nodes: [], issues: [], score: 0 },
      { name: 'e', status: 'SKIP',    nodes: [], issues: [], score: null },
    ];
    const r = buildResult(jobs, 0);
    assert.equal(r.summary.total_jobs, 5);
    assert.equal(r.summary.auto, 2);
    assert.equal(r.summary.partial, 1);
    assert.equal(r.summary.manual, 1);
    assert.equal(r.summary.skip, 1);
    // auto_pct = 2 / (5 - 1) * 100 = 50
    assert.equal(r.summary.auto_pct, 50);
    assert.equal(r.issues_summary.JAVA_EXPR, 1);
    assert.equal(r.issues_summary.JOIN_EDGE_STALE, 0);
  });
});
