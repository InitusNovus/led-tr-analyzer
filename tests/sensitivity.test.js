import test from 'node:test';
import assert from 'node:assert/strict';
import { freshConfig, transitionConfig, TOPOLOGIES } from '../src/core/topologies.js';
import { analyzeCorners, analyzePoint } from '../src/core/analysis.js';
import { cornerPhase } from '../src/ui/viewModel.js';
import { designReducer, initialDesignState } from '../src/ui/designState.js';

const keys = list => list.map(a => a.key);

test('default sampled run reports what was swept and what was left at nominal', () => {
    const r = analyzeCorners(freshConfig());
    assert.equal(r.count, 81);
    assert.equal(r.validCount, 81);
    assert.deepEqual(keys(r.axes.swept), ['vcc', 'vdd', 'resistance', 'vfShift']);
    assert.ok(r.axes.swept.every(a => a.values.length === 3 && a.values.includes(a.nominal)));
    const fixed = keys(r.axes.fixed);
    for (const k of ['dtcTolerance', 'temperature', 'device-curves']) assert.ok(fixed.includes(k), k);
});

test('extended DTC sweep adds the internal-resistor axes and drops the "not swept" note', () => {
    const r = analyzeCorners(freshConfig(), { includeDtc: true });
    assert.equal(r.count, 729);
    assert.deepEqual(keys(r.axes.swept).slice(-2), ['dtcR1Scale', 'dtcRatio']);
    assert.ok(!keys(r.axes.fixed).includes('dtcTolerance'));
});

test('a zero tolerance moves that axis to the fixed list; non-GPIO circuits never mention GPIO supply', () => {
    const r = analyzeCorners(transitionConfig({ ...freshConfig(), resistorTolerance: 0 }, 'resistor'));
    assert.deepEqual(keys(r.axes.swept), ['vcc', 'vfShift']);
    assert.ok(r.axes.fixed.some(f => f.key === 'resistance' && /공차 0%/.test(f.label)));
    assert.ok(!keys(r.axes.fixed).includes('vdd'));
    assert.equal(r.count, 9);
});

test('active bias resistors are listed as nominal, not silently swept', () => {
    const r = analyzeCorners(transitionConfig(freshConfig(), 'npn-low'));
    const rb = r.axes.fixed.find(f => f.key === 'baseResistance');
    assert.ok(rb);
    assert.equal(rb.value, 4700);
    assert.ok(!keys(r.axes.swept).includes('baseResistance'));
});

test('every reported extreme is reproducible from its witness scenario', () => {
    const c = freshConfig();
    const r = analyzeCorners(c);
    for (const [metric, e] of Object.entries(r.extrema)) {
        for (const side of ['min', 'max']) {
            const again = analyzePoint({ ...c, ...e[side].scenario });
            assert.ok(again.ok, metric + side);
            assert.equal(again.point[metric], e[side].value, metric + ' ' + side);
        }
        assert.ok(e.min.value <= e.max.value);
    }
});

test('scenarios outside a model domain are excluded and counted, never silently passed', () => {
    const c = transitionConfig({ ...freshConfig(), vdd: 3.5, vddTolerance: 5 }, 'gpio-source');
    const r = analyzeCorners(c);
    assert.equal(r.count, 81);
    assert.equal(r.failures.length, 27, 'VDD 3.675 V is outside the 2.7-3.6 V GPIO model');
    assert.equal(r.validCount + r.failures.length, r.count);
    assert.ok(r.failures.every(f => f.error?.message && f.scenario.vdd > 3.6));
    assert.ok(Number.isFinite(r.extrema.current.min.value));
    assert.ok(r.extrema.current.max.scenario.vdd <= 3.6);
});

test('optical bin spread, electrical-only spread and the combined estimate stay separate', () => {
    const c = { ...freshConfig(), led: 'KT-0805R' };
    const r = analyzeCorners(c), nominal = analyzePoint(c).point.optical;
    const s = r.opticalSpread;
    assert.deepEqual(s.binAtNominal, { min: nominal.minMcd, max: nominal.maxMcd });
    assert.equal(s.electricalOnly.basis, 'representative');
    assert.ok(s.electricalOnly.min <= s.electricalOnly.max);
    assert.ok(s.combined.min <= s.electricalOnly.min && s.combined.max >= s.electricalOnly.max);
    assert.ok(s.combined.max - s.combined.min > s.electricalOnly.max - s.electricalOnly.min,
        'the bin range widens the combined estimate beyond the electrical spread');
    assert.equal(analyzeCorners(freshConfig()).opticalSpread.binAtNominal, null, 'LED without a bin range reports none');
});

test('sampled run works for every topology whose nominal point is computable', () => {
    let ran = 0;
    for (const t of TOPOLOGIES) {
        const c = transitionConfig(freshConfig(), t.id);
        if (!analyzePoint(c).ok) continue;
        const r = analyzeCorners(c);
        assert.equal(r.validCount + r.failures.length, r.count, t.id);
        assert.ok(r.axes.swept.length >= 3, t.id);
        assert.ok(r.axes.fixed.length >= 2, t.id);
        ran++;
    }
    assert.ok(ran >= 10, 'most topologies compute at their default configuration, ran ' + ran);
});

test('cornerPhase distinguishes never-run, running, stale, partial, failed and complete', () => {
    const base = { hasPoint: true, corners: null, hasSnapshot: false, stale: false, running: false };
    assert.equal(cornerPhase({ ...base, hasPoint: false, running: true }), 'unavailable');
    assert.equal(cornerPhase(base), 'idle');
    assert.equal(cornerPhase({ ...base, running: true }), 'running');
    assert.equal(cornerPhase({ ...base, stale: true }), 'stale');
    assert.equal(cornerPhase({ ...base, hasSnapshot: true }), 'stale', 'a snapshot for other inputs is stale, not current');
    assert.equal(cornerPhase({ ...base, corners: { error: 'x' } }), 'error');
    assert.equal(cornerPhase({ ...base, corners: { failures: [{}] } }), 'partial');
    assert.equal(cornerPhase({ ...base, corners: { failures: [] }, running: true }), 'complete');
});

test('reducer remembers that a sampled result was invalidated, and clears that on a new result', () => {
    let s = initialDesignState();
    assert.equal(s.cornersStale, false);
    s = designReducer(s, { type: 'config', key: 'vcc', value: 9 });
    assert.equal(s.cornersStale, false, 'nothing to invalidate yet');
    s = designReducer(s, { type: 'corners', snapshot: { key: 'k', result: {} } });
    assert.equal(s.cornersStale, false);
    s = designReducer(s, { type: 'config', key: 'vcc', value: 12 });
    assert.equal(s.cornerSnapshot, null);
    assert.equal(s.cornersStale, true);
    s = designReducer(s, { type: 'config', key: 'vcc', value: 5 });
    assert.equal(s.cornersStale, true, 'stays stale until a new result arrives');
    s = designReducer(s, { type: 'corners', snapshot: { key: 'k2', result: {} } });
    assert.equal(s.cornersStale, false);
    assert.equal(designReducer(s, { type: 'reset' }).cornersStale, false);
});
