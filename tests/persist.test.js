import test from 'node:test';
import assert from 'node:assert/strict';
import { designReducer, initialDesignState } from '../src/ui/designState.js';
import { STORAGE_KEY, serializeDesign, restoreDesign, loadDesignState, saveDesignState } from '../src/ui/persist.js';
import { analyzePoint } from '../src/core/analysis.js';

const fakeStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const withStorage = (st, fn) => { Object.defineProperty(globalThis, 'localStorage', { value: st, configurable: true }); try { fn(); } finally { delete globalThis.localStorage; } };
const edited = () => {
    let s = initialDesignState();
    s = designReducer(s, { type: 'topology', id: 'npn-low' });
    s = designReducer(s, { type: 'led', id: '17-21SURC/S530-A2/4T' });
    s = designReducer(s, { type: 'config', key: 'resistance', value: 470 });
    return designReducer(s, { type: 'patch', patch: { targetMa: 7, series: 'E12', includeDtc: true } });
};

test('a saved design round-trips through JSON and still analyses', () => {
    const s = edited(), back = restoreDesign(JSON.parse(JSON.stringify(serializeDesign(s))));
    assert.deepEqual(back.config, s.config);
    for (const k of ['mode', 'targetMa', 'series', 'includeDtc', 'opticalBasis', 'selectedInstance']) assert.equal(back[k], s[k], k);
    assert.equal(analyzePoint(back.config).ok, true);
    assert.equal(back.appliedGoal, null); assert.equal(back.cornerSnapshot, null);
});

test('unknown version, unknown topology/LED or garbage are rejected; bad fields fall back to defaults', () => {
    const good = JSON.parse(JSON.stringify(serializeDesign(edited())));
    assert.equal(restoreDesign({ ...good, v: 2 }), null);
    assert.equal(restoreDesign(null), null); assert.equal(restoreDesign('x'), null);
    assert.equal(restoreDesign({ ...good, config: { ...good.config, topology: 'nope' } }), null);
    assert.equal(restoreDesign({ ...good, config: { ...good.config, led: 'gone' } }), null);
    const r = restoreDesign({ ...good, config: { ...good.config, resistance: 'abc', vcc: null, ledBin: 'ZZ', deviceModels: { Q1: 'bogus' } }, targetMa: '7', mode: 5, selectedInstance: 'X9' });
    const d = initialDesignState();
    assert.equal(r.config.resistance, d.config.resistance); assert.equal(r.config.vcc, d.config.vcc);
    assert.equal(r.config.ledBin, null); assert.equal(r.targetMa, d.targetMa); assert.equal(r.mode, d.mode);
    assert.equal(r.selectedInstance, d.selectedInstance);
    assert.equal(analyzePoint(r.config).ok, true, 'a bogus device model falls back to a compatible one');
});

test('storage: saves edits, removes the entry at defaults, survives broken or missing storage', () => {
    const st = fakeStorage();
    withStorage(st, () => {
        saveDesignState(edited());
        assert.ok(st.m.has(STORAGE_KEY));
        assert.equal(loadDesignState().config.resistance, 470);
        saveDesignState(designReducer(edited(), { type: 'reset' }));
        assert.ok(!st.m.has(STORAGE_KEY), 'reset leaves nothing behind');
        st.setItem(STORAGE_KEY, '{not json');
        assert.deepEqual(loadDesignState(), initialDesignState());
    });
    assert.deepEqual(loadDesignState(), initialDesignState());          // no storage at all
    withStorage({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } }, () => {
        saveDesignState(edited());
        assert.deepEqual(loadDesignState(), initialDesignState());
    });
});
