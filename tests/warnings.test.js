import test from 'node:test';
import assert from 'node:assert/strict';
import { freshConfig, transitionConfig, solvePoint, TOPOLOGIES, activeParameterNames } from '../src/core/topologies.js';
import { analyzePoint, analyzeCorners } from '../src/core/analysis.js';
import { buildWarnings, relatedInputs, scenarioDiffs, powerBudget, sortedPresets, DEFAULT_MARGIN_PCT } from '../src/core/warnings.js';
import { PACKAGE_PRESETS } from '../src/data/catalog.js';

const cfg = (topology, extra = {}) => ({ ...transitionConfig(freshConfig(), topology), ...extra });
const run = (config, { corners = true, phase = 'complete', marginPct } = {}) => {
    const a = analyzePoint(config);
    assert.ok(a.ok, 'nominal computes');
    const c = corners ? analyzeCorners(config) : null;
    return { a, c, w: buildWarnings({ config: a.point.config, point: a.point, validation: a.validation, corners: c, cornerPhase: c ? phase : 'idle', marginPct }) };
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Issue #26 reference case: default circuit, RLED 220 ohm, generic 0402 (62.5 mW) at 0.7 derating.
const REFERENCE = { resistance: 220, resistorRating: 0.0625 };

test('reference case: nominal passes, sampled exceeds, and the numbers match the issue', () => {
    const { a, c, w } = run({ ...freshConfig(), ...REFERENCE });
    assert.ok(near(a.point.resistorPower, 37.17e-3, 0.01e-3));
    assert.ok(near(0.0625 * 0.7, 43.75e-3, 1e-9));
    assert.equal(a.validation.status, 'within-entered-limits', 'nominal passes');
    const f = w.findings.find(x => x.scope === 'sampled' && x.ruleId === 'resistor-power-budget');
    assert.ok(f, 'sampled finding exists');
    assert.equal(f.severity, 'exceeded');
    assert.equal(f.instanceId, 'RLED');
    assert.ok(near(f.actual, 46.51e-3, 0.01e-3), 'worst sampled power ' + f.actual);
    assert.ok(near(f.limit, 43.75e-3, 1e-9));
    assert.ok(near(f.excess, 2.76e-3, 0.02e-3) && near(f.excessPct, 6.3, 0.2), 'excess ' + f.excess + ' / ' + f.excessPct);
    assert.equal(f.total, 81);
    assert.equal(f.count, 10, 'scenarios over budget');
    assert.ok(!w.findings.some(x => x.scope === 'nominal' && x.severity === 'exceeded'), 'no nominal exceed');
    const by = Object.fromEntries(f.scenario.map(d => [d.key, d]));
    assert.ok(near(by.vcc.value, 5.25, 1e-9) && by.vcc.nominal === 5);
    assert.ok(near(by.vdd.value, 3.399, 1e-9) && near(by.resistance.value, 217.8, 1e-9) && near(by.vfShift.value, -0.1, 1e-9));
    assert.equal(f.scenario.length, 4, 'only axes that differ from nominal');
    assert.equal(c.violationGroups.length, 1);
});

test('power budget keeps nominal and sampled peak apart and recommends a generic preset only against the input budget', () => {
    const config = { ...freshConfig(), ...REFERENCE };
    const a = analyzePoint(config), c = analyzeCorners(config);
    const nominalOnly = powerBudget({ config: a.point.config, point: a.point, corners: null, presets: PACKAGE_PRESETS });
    assert.ok(near(nominalOnly.nominalRatio, 0.8497, 1e-3));
    assert.equal(nominalOnly.basisKind, 'nominal');
    assert.equal(nominalOnly.exceeds, false);
    assert.equal(nominalOnly.recommendation.key, '0402');
    assert.equal(nominalOnly.currentPreset, '0402');
    const withPeak = powerBudget({ config: a.point.config, point: a.point, corners: c, presets: PACKAGE_PRESETS });
    assert.equal(withPeak.basisKind, 'sampled');
    assert.ok(near(withPeak.peakRatio, 1.0631, 2e-3), 'over 100% is kept, not clipped: ' + withPeak.peakRatio);
    assert.equal(withPeak.exceeds, true);
    assert.equal(withPeak.recommendation.key, '0603');
    assert.ok(near(withPeak.requiredRated, 46.51e-3 / 0.7, 0.03e-3));
    assert.ok(near(withPeak.ratedRatio, 1 / 0.7, 1e-9));
    assert.equal(withPeak.nominalRatio, nominalOnly.nominalRatio, 'nominal is unchanged by the sampled run');
});

test('no preset is recommended when none fits the entered derating', () => {
    const config = { ...freshConfig(), resistance: 33, derating: 0.1, resistorRating: 0.0625 };
    const a = analyzePoint(config);
    const b = powerBudget({ config: a.point.config, point: a.point, corners: null, presets: PACKAGE_PRESETS });
    assert.equal(b.recommendation, null);
    assert.ok(b.requiredRated > 0.25);
});

test('violation groups cover every sample even when the raw list is truncated', () => {
    const config = { ...freshConfig(), resistance: 220, resistorRating: 0.001 };
    const c = analyzeCorners(config);
    assert.equal(c.violations.length, 30, 'raw list is capped');
    const g = c.violationGroups.find(x => x.ruleId === 'resistor-power-budget');
    assert.equal(g.count, 81, 'the group is not');
    const worst = analyzePoint({ ...config, ...g.worst.scenario });
    assert.ok(worst.ok);
    assert.equal(worst.point.resistorPower, g.worst.actual, 'worst witness reproduces');
    assert.equal(g.worst.actual, c.extrema.resistorPower.max.value, 'and is the sampled maximum');
});

test('nominal exceed is reported first, with scope, severity and a primary input', () => {
    const { w } = run({ ...freshConfig(), resistance: 33, resistorRating: 0.0625 });
    const first = w.findings[0];
    assert.equal(first.severity, 'exceeded');
    assert.equal(first.scope, 'nominal');
    const led = w.findings.find(x => x.ruleId === 'led-forward-current' && x.scope === 'nominal');
    assert.ok(led && led.excess > 0 && led.excessPct > 0);
    assert.equal(led.inputs[0].id, 'resistance');
    const order = w.findings.map(x => x.severity);
    assert.deepEqual(order, [...order].sort((p, q) => ['exceeded', 'margin', 'unknown', 'approximation'].indexOf(p) - ['exceeded', 'margin', 'unknown', 'approximation'].indexOf(q)));
});

test('margin is a user-set heads-up, not a pass line', () => {
    // nominal RLED power 37.17 mW against a 39.2 mW budget is 94.8 %
    const config = { ...freshConfig(), resistance: 220, resistorRating: 0.056 };
    const at = pct => run(config, { corners: false, marginPct: pct }).w.findings.filter(f => f.severity === 'margin');
    assert.equal(DEFAULT_MARGIN_PCT, 90);
    assert.equal(at(90).length, 1);
    const m = at(90)[0];
    assert.equal(m.ruleId, 'resistor-power-budget');
    assert.ok(near(m.usagePct, 94.8, 0.2) && m.marginPct === 90);
    assert.equal(at(95).length, 0, 'a higher threshold clears it');
    assert.equal(at(99).length, 0);
    for (const off of [NaN, 0, -5, undefined === 1]) assert.equal(at(off).length, off === undefined ? 1 : 0);
    assert.equal(run(config, { corners: false, marginPct: 90 }).a.validation.status, 'within-entered-limits', 'the verdict itself is unchanged by the threshold');
});

test('margin warnings never use a temperature ratio and never appear for exceeded checks', () => {
    for (const t of TOPOLOGIES) {
        let a;
        try { a = analyzePoint(cfg(t.id, { ambient: 80, resistance: 100 })); } catch { continue; }
        if (!a.ok) continue;
        const w = buildWarnings({ config: a.point.config, point: a.point, validation: a.validation, corners: null, cornerPhase: 'idle', marginPct: 10 });
        for (const f of w.findings.filter(x => x.severity === 'margin')) {
            assert.ok(['A', 'W', 'V'].includes(f.unit), t.id + ' ' + f.id + ' ' + f.unit);
            assert.ok(f.actual <= f.limit, t.id + ' ' + f.id);
        }
    }
});

test('unknown limits and model approximations are separate severities with their own text', () => {
    const { a, w } = run({ ...freshConfig(), led: 'KT-0805Y' }, { corners: false });
    const unknown = w.findings.filter(f => f.severity === 'unknown'), approx = w.findings.filter(f => f.severity === 'approximation');
    assert.equal(unknown.length, a.validation.checks.filter(c => c.status === 'unknown').length);
    assert.ok(unknown.length > 0);
    assert.ok(unknown.every(f => f.scope === 'nominal' && f.inputs.length === 0));
    assert.ok(approx.length > 0 && approx.every(f => typeof f.text === 'string' && f.text.length > 0));
    assert.ok(approx.every(f => !('excess' in f)), 'approximations are not limit verdicts');
});

const KNOWN_RULES = ['led-forward-current', 'led-power', 'led-current-derated', 'led-ambient', 'resistor-power-budget', 'driver-pin-current',
    'driver-total-source', 'driver-total-sink', 'transistor-current', 'transistor-voltage', 'gate-source-voltage', 'digital-input-voltage', 'transistor-power-budget'];

test('every limit rule maps to inputs that exist on that topology', () => {
    const seen = new Set();
    for (const t of TOPOLOGIES) for (const extra of [{}, { led: 'APT2012SURCK', ambient: 30 }, { auxRating: 0.001, resistorRating: 0.001 }]) {
        let a;
        try { a = analyzePoint(cfg(t.id, extra)); } catch { continue; }
        if (!a.ok) continue;
        const active = activeParameterNames(t, a.point.config);
        for (const c of a.validation.checks) {
            seen.add(c.ruleId);
            assert.ok(KNOWN_RULES.includes(c.ruleId), 'unmapped new rule ' + c.ruleId);
            const inputs = relatedInputs(c, a.point.config);
            assert.ok(inputs.length > 0, t.id + ' ' + c.ruleId + ' has a place to act');
            for (const i of inputs) assert.ok(i.id.startsWith('model-') || i.id.startsWith('target') || active.has(i.id), t.id + ' ' + c.ruleId + ' maps to hidden input ' + i.id);
            assert.ok(inputs.every(i => i.label && i.label !== i.id || i.id.startsWith('model-')), 'labelled');
        }
    }
    assert.deepEqual([...seen].sort(), [...KNOWN_RULES].sort(), 'all rules exercised');
});

test('the primary input follows the physics of the rule and topology', () => {
    const primary = (topology, extra, rule, instance) => {
        const a = analyzePoint(cfg(topology, extra)), c = a.validation.checks.find(x => x.ruleId === rule && (!instance || x.instanceId === instance));
        assert.ok(c, topology + ' ' + rule);
        return relatedInputs(c, a.point.config).map(i => i.id);
    };
    assert.equal(primary('digital-npn', {}, 'resistor-power-budget', 'RLED')[0], 'resistorRating');
    assert.equal(primary('npn-low', {}, 'resistor-power-budget', 'RB')[0], 'auxRating');
    assert.ok(primary('npn-low', {}, 'resistor-power-budget', 'RB').includes('baseResistance'));
    assert.equal(primary('npn-current-sink', {}, 'led-forward-current')[0], 'emitterResistance', 'current set by RE');
    assert.equal(primary('digital-npn', {}, 'led-forward-current')[0], 'resistance');
    assert.equal(primary('gpio-source', {}, 'driver-total-sink')[0], 'otherSinkCurrent');
    assert.ok(!primary('gpio-source', {}, 'driver-pin-current').includes('baseResistance'), 'no hidden input');
    assert.equal(primary('led-only' in {} ? 'x' : 'npn-low', {}, 'transistor-voltage')[1], 'model-Q1');
    assert.equal(primary('npn-low', {}, 'led-ambient')[0], 'ambient');
});

test('partial sampled runs are reported as excluded, not as a full guarantee', () => {
    const { w, c } = run(cfg('gpio-source', { vdd: 3.5, vddTolerance: 5 }), { phase: 'partial' });
    assert.equal(c.failures.length, 27);
    assert.equal(w.sampled.excluded, 27);
    assert.equal(w.sampled.complete, false);
    assert.equal(w.sampled.validCount, 54);
    assert.equal(w.sampled.phase, 'partial');
});

test('scenarioDiffs lists only axes that moved', () => {
    const c = analyzeCorners(freshConfig());
    assert.deepEqual(scenarioDiffs(c, { vcc: 5, vdd: 3.3, resistance: 330, vfShift: 0 }), []);
    const d = scenarioDiffs(c, { vcc: 5.25, vdd: 3.3, resistance: 330, vfShift: 0 });
    assert.deepEqual(d.map(x => x.key), ['vcc']);
    assert.equal(d[0].nominal, 5);
    assert.deepEqual(scenarioDiffs(null, { vcc: 1 }), []);
});

test('presets are ordered by rated power, not by object key order', () => {
    assert.deepEqual(sortedPresets(PACKAGE_PRESETS).map(([k]) => k), ['0402', '0603', '0805', '1206']);
    assert.equal(Object.keys(PACKAGE_PRESETS)[0], '1206', 'the raw object really does list 1206 first');
});

test('in size mode the RLED field is replaced by the matching target field', () => {
    const a = analyzePoint(freshConfig());
    const check = { ruleId: 'led-forward-current', instanceId: 'LED1' };
    const ids = view => relatedInputs(check, a.point.config, view).map(i => i.id);
    assert.equal(ids({})[0], 'resistance');
    assert.equal(ids({ mode: 'verify', targetKind: 'mcd' })[0], 'resistance');
    assert.deepEqual(ids({ mode: 'size', targetKind: 'current' }).slice(0, 2), ['targetMa', 'vcc']);
    assert.equal(ids({ mode: 'size', targetKind: 'mcd' })[0], 'targetMcd');
    assert.ok(!ids({ mode: 'size', targetKind: 'current' }).includes('resistance'));
    assert.ok(!ids({ mode: 'verify' }).includes('targetMa'));
    const rated = relatedInputs({ ruleId: 'resistor-power-budget', instanceId: 'RLED' }, a.point.config, { mode: 'size', targetKind: 'current' }).map(i => i.id);
    assert.equal(rated[0], 'resistorRating');
    assert.ok(rated.includes('targetMa') && !rated.includes('resistance'));
});
