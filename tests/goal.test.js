import test from 'node:test';
import assert from 'node:assert/strict';
import { freshConfig, transitionConfig } from '../src/core/topologies.js';
import { analyzePoint, selectResistance } from '../src/core/analysis.js';
import { evaluateGoal, goalDrift, intentFromGoal, normalizeCriterion } from '../src/core/goal.js';
import { ModelError } from '../src/core/math.js';
import { designReducer, initialDesignState } from '../src/ui/designState.js';

const ktConfig = () => ({ ...freshConfig(), led: 'KT-0805R' });
const size = (config, extra = {}) => selectResistance(config, .001, { targetMcd: 40, opticalBasis: 'min', ...extra });
const point = (current, optical = null) => ({ current, optical });

test('minimum criterion is a threshold, approximate criterion is a tolerance band', () => {
    const intent = { kind: 'current', targetCurrent: 0.010 };
    assert.equal(evaluateGoal(point(0.0100), intent).met, true);
    assert.equal(evaluateGoal(point(0.0125), intent).status, 'met');
    const below = evaluateGoal(point(0.0097), intent);
    assert.equal(below.status, 'missed');
    assert.ok(Math.abs(below.errorPct + 3) < 1e-9);
    const band = { ...intent, criterion: 'approximate', tolerancePct: 5 };
    assert.equal(evaluateGoal(point(0.0097), band).met, true);
    assert.equal(evaluateGoal(point(0.0125), band).met, false, 'overshoot is outside an approximate target');
    assert.equal(evaluateGoal(point(0.0105), band).met, true, 'band edge is inclusive');
});

test('goal reports signed error and distinguishes unavailable from not computed', () => {
    const g = evaluateGoal(point(0.012), { kind: 'current', targetCurrent: 0.010 });
    assert.ok(Math.abs(g.error - 0.002) < 1e-12);
    assert.equal(g.achievedCurrent, 0.012);
    const none = evaluateGoal(null, { kind: 'current', targetCurrent: 0.010 });
    assert.equal(none.status, 'not-computed');
    assert.equal(none.met, false);
    const noOptical = evaluateGoal(point(0.005, { kind: 'unavailable' }), { kind: 'optical', targetMcd: 40, basis: 'min' });
    assert.equal(noOptical.status, 'unavailable');
    assert.equal(noOptical.achieved, null);
});

test('criterion input is validated instead of silently defaulted', () => {
    assert.deepEqual(normalizeCriterion(undefined), { criterion: 'minimum', tolerancePct: 5 });
    assert.throws(() => normalizeCriterion('exact'), ModelError);
    assert.throws(() => normalizeCriterion('approximate', ''), ModelError);
    assert.throws(() => normalizeCriterion('approximate', 101), ModelError);
    assert.equal(normalizeCriterion('approximate', 2).tolerancePct, 2);
});

for (const strategy of ['closest', 'safe', 'bright']) {
    test(`applied optical goal re-evaluates to the sizing verdict (${strategy})`, () => {
        const config = ktConfig();
        const sized = size(config, { strategy, series: 'E24' });
        const verify = analyzePoint({ ...config, resistance: sized.selected });
        assert.ok(verify.ok);
        const again = evaluateGoal(verify.point, intentFromGoal(sized.goal, { series: 'E24', strategy }));
        for (const key of ['status', 'met', 'target', 'achieved', 'error', 'errorPct', 'criterion', 'basis'])
            assert.deepEqual(again[key], sized.goal[key], key);
        assert.equal(sized.goal.basis, 'min');
        assert.equal(sized.goal.kind, 'optical');
    });
}

test('larger standard resistor can miss a minimum-bin target and the miss is reported', () => {
    const config = ktConfig();
    const safe = size(config, { strategy: 'safe', series: 'E24' });
    const bright = size(config, { strategy: 'bright', series: 'E24' });
    assert.ok(safe.selected >= bright.selected);
    assert.ok(bright.goal.achieved >= safe.goal.achieved);
    assert.equal(bright.goal.status, 'met');
    // Same selected resistor judged by a tolerance band instead of a threshold.
    const band = size(config, { strategy: 'safe', series: 'E24', criterion: 'approximate', tolerancePct: 0.001 });
    assert.equal(band.goal.criterion, 'approximate');
    assert.equal(band.goal.met, Math.abs(band.goal.error) <= 40 * 0.001 / 100 * (1 + 1e-7));
});

test('current goal carries criterion through selectResistance', () => {
    const r = selectResistance(freshConfig(), .010, { criterion: 'approximate', tolerancePct: 10 });
    assert.equal(r.goal.kind, 'current');
    assert.equal(r.goal.criterion, 'approximate');
    assert.equal(r.goal.tolerancePct, 10);
    assert.equal(r.goal.met, Math.abs(r.goal.achievedCurrent - .010) <= .010 * .10 * (1 + 1e-7));
    assert.throws(() => selectResistance(freshConfig(), .010, { criterion: 'approximate', tolerancePct: '' }), ModelError);
});

test('changing the LED away from the optical basis makes the applied goal unavailable, not silently passing', () => {
    const config = ktConfig();
    const sized = size(config, { series: 'E24' });
    const intent = intentFromGoal(sized.goal, { series: 'E24', strategy: 'closest' });
    const other = analyzePoint({ ...config, led: 'KT-0805W', resistance: sized.selected });
    assert.ok(other.ok);
    const g = evaluateGoal(other.point, intent);
    assert.equal(g.status, 'unavailable');
    assert.equal(g.met, false);
});

test('goalDrift lists every changed electrical input and ignores unchanged ones', () => {
    const base = { ...ktConfig(), resistance: 330 };
    assert.deepEqual(goalDrift(base, { ...base }), []);
    assert.deepEqual(goalDrift(base, { ...base, resistorTolerance: 5, ambient: 40 }), [], 'rating/tolerance inputs do not change the operating point');
    const drift = goalDrift(base, { ...base, resistance: 220, vcc: 12, led: 'KT-0805G',
        deviceModels: { ...base.deviceModels, Q1: 'nexperia:BC847B' } });
    assert.deepEqual(drift.map(d => d.key).sort(), ['deviceModels.Q1', 'led', 'resistance', 'vcc']);
    const rled = drift.find(d => d.key === 'resistance');
    assert.equal(rled.from, 330);
    assert.equal(rled.to, 220);
    assert.equal(goalDrift(null, base).length, 0);
});

test('applyGoal stores intent and snapshot, switches to verify and keeps independent drafts', () => {
    let s = designReducer(initialDesignState(), { type: 'led', id: 'KT-0805R' });
    s = designReducer(s, { type: 'patch', patch: { mode: 'size', targetMa: 12, targetMcd: 40, targetKind: 'mcd' } });
    s = designReducer(s, { type: 'patch', patch: { cornerSnapshot: { key: 'k', result: {} } } });
    const sized = size(s.config, { series: 'E24' });
    const intent = intentFromGoal(sized.goal, { series: 'E24', strategy: 'closest' });
    const next = designReducer(s, { type: 'applyGoal', intent, selectedResistance: sized.selected, exactResistance: sized.exact });
    assert.equal(next.mode, 'verify');
    assert.equal(next.config.resistance, sized.selected);
    assert.equal(next.cornerSnapshot, null);
    assert.equal(next.targetMa, 12);
    assert.equal(next.targetMcd, 40);
    assert.equal(next.appliedGoal.intent.targetMcd, 40);
    assert.equal(next.appliedGoal.snapshot.resistance, sized.selected);
    assert.equal(next.appliedGoal.snapshot.led, 'KT-0805R');
    // Later edits must not rewrite what was applied.
    const edited = designReducer(next, { type: 'config', key: 'resistance', value: 1000 });
    assert.equal(edited.appliedGoal.snapshot.resistance, sized.selected);
    assert.equal(edited.appliedGoal, next.appliedGoal);
    assert.equal(designReducer(edited, { type: 'reset' }).appliedGoal, null);
});

test('applyGoal survives a topology change and is judged on the new topology', () => {
    let s = designReducer(initialDesignState(), { type: 'led', id: 'KT-0805R' });
    const sized = size(s.config, { series: 'E24' });
    s = designReducer(s, { type: 'applyGoal', intent: intentFromGoal(sized.goal, { series: 'E24', strategy: 'closest' }),
        selectedResistance: sized.selected, exactResistance: sized.exact });
    s = designReducer(s, { type: 'topology', id: 'resistor' });
    assert.ok(s.appliedGoal);
    assert.ok(goalDrift(s.appliedGoal.snapshot, s.config).some(d => d.key === 'topology'));
    const a = analyzePoint(s.config);
    assert.ok(a.ok);
    assert.notEqual(evaluateGoal(a.point, s.appliedGoal.intent).status, 'not-computed');
});
