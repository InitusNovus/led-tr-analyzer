import test from 'node:test';
import assert from 'node:assert/strict';
import { designReducer, initialDesignState } from '../src/ui/designState.js';

const run = (state, ...actions) => actions.reduce(designReducer, state);
const withSnapshot = state => designReducer(state, { type: 'patch', patch: { cornerSnapshot: { key: 'k', result: {} } } });

test('initial state matches the documented defaults', () => {
    const s = initialDesignState();
    assert.equal(s.mode, 'verify');
    assert.equal(s.targetKind, 'current');
    assert.equal(s.targetMa, 10);
    assert.equal(s.targetMcd, 60);
    assert.equal(s.config.topology, 'digital-npn');
    assert.equal(s.selectedInstance, 'Q1');
    assert.equal(s.cornerSnapshot, null);
});

test('electrical input changes drop the sampled snapshot, UI-only patches keep it', () => {
    const s = withSnapshot(initialDesignState());
    assert.notEqual(designReducer(s, { type: 'patch', patch: { selectedInstance: 'LED1' } }).cornerSnapshot, null);
    assert.notEqual(designReducer(s, { type: 'patch', patch: { mode: 'size' } }).cornerSnapshot, null);
    assert.equal(designReducer(s, { type: 'patch', patch: { targetMa: 5 }, invalidate: true }).cornerSnapshot, null);
    assert.equal(designReducer(s, { type: 'config', key: 'vcc', value: 12 }).cornerSnapshot, null);
    assert.equal(designReducer(s, { type: 'config', key: 'vcc', value: 12 }).config.vcc, 12);
    assert.equal(designReducer(s, { type: 'device', id: 'Q1', value: 'rohm:DTC043ZEB' }).cornerSnapshot, null);
});

test('config update does not mutate the previous state', () => {
    const s = initialDesignState();
    const before = JSON.stringify(s);
    designReducer(s, { type: 'config', key: 'vcc', value: 9 });
    designReducer(s, { type: 'device', id: 'GPIO1', value: 'assumed:DC-Thevenin' });
    assert.equal(JSON.stringify(s), before);
});

test('topology change selects Q1 when present, otherwise LED1, and leaves size mode where unsupported', () => {
    let s = run(initialDesignState(), { type: 'patch', patch: { mode: 'size' } });
    s = withSnapshot(designReducer(s, { type: 'topology', id: 'nmos-low' }));
    assert.equal(s.config.topology, 'nmos-low');
    assert.equal(s.mode, 'size');
    assert.equal(s.selectedInstance, 'Q1');
    const sink = designReducer(s, { type: 'topology', id: 'npn-current-sink' });
    assert.equal(sink.mode, 'verify');
    assert.equal(sink.cornerSnapshot, null);
    assert.equal(designReducer(sink, { type: 'topology', id: 'resistor' }).selectedInstance, 'LED1');
});

test('device selection records the chosen model and focuses that instance', () => {
    const s = run(initialDesignState(), { type: 'topology', id: 'npn-low' }, { type: 'device', id: 'Q1', value: 'nexperia:BC847B' });
    assert.equal(s.config.deviceModels.Q1, 'nexperia:BC847B');
    assert.equal(s.selectedInstance, 'Q1');
});

test('unsupported optical LED returns to current target but keeps both drafts', () => {
    let s = run(initialDesignState(), { type: 'led', id: 'KT-0805R' }, { type: 'targetKind', kind: 'mcd' },
        { type: 'patch', patch: { targetMa: 12, targetMcd: 20 } });
    assert.equal(s.targetKind, 'mcd');
    assert.equal(s.opticalBasis, 'min');
    s = designReducer(s, { type: 'led', id: 'KT-0805W' });
    assert.equal(s.targetKind, 'current');
    assert.equal(s.targetMa, 12);
    assert.equal(s.targetMcd, 20);
    assert.match(s.opticalNotice, /이전 mcd 입력값은 보존/);
    s = designReducer(s, { type: 'led', id: 'KT-0805R' });
    assert.equal(s.opticalNotice, '');
    assert.equal(s.targetMcd, 20);
});

test('mcd target cannot be selected for an LED without an optical inverse', () => {
    const s = run(initialDesignState(), { type: 'led', id: 'KT-0805W' });
    assert.equal(designReducer(s, { type: 'targetKind', kind: 'mcd' }), s);
});

test('full reset restores every field including sizing options', () => {
    const dirty = run(initialDesignState(), { type: 'topology', id: 'npn-low' },
        { type: 'patch', patch: { mode: 'size', series: 'E96', strategy: 'bright', includeDtc: true, targetMa: 3, opticalBasis: 'min' } });
    assert.deepEqual(designReducer(dirty, { type: 'reset' }), initialDesignState());
});

test('unknown actions return the same state object', () => {
    const s = initialDesignState();
    assert.equal(designReducer(s, { type: 'nope' }), s);
});
