import test from 'node:test';
import assert from 'node:assert/strict';
import { freshConfig, transitionConfig, solvePoint, TOPOLOGIES } from '../src/core/topologies.js';
import { qPointSummary } from '../src/core/qpoint.js';

// transitionConfig resets the drive state to the topology's ON state, so extras (including state) are applied after it.
const cfg = (topology, extra = {}) => ({ ...transitionConfig(freshConfig(), topology), ...extra });
const point = (topology, extra) => solvePoint(cfg(topology, extra));
const byId = (path, id) => path.terms.find(t => t.id === id);
const near = (a, b, rel = 1e-9, abs = 1e-12) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));

// Variants that change which branch of each model is used: supply, LED, series count, source model, drive resistors.
const VARIANTS = [
    {},
    { vcc: 12, resistance: 680 },
    { vcc: 3.3, vdd: 3.3, resistance: 150 },
    { led: 'KT-0805G', seriesCount: 2, vcc: 9, resistance: 220 },
    { baseResistance: 1000, gateResistance: 470, gatePull: 22000, resistance: 100 },
    { deviceModels: { GPIO1: 'assumed:DC-Thevenin' }, vdd: 5, sourceResistance: 40, vcc: 5 },
];

test('every KVL loop closes on every computable topology and variant', () => {
    let checked = 0;
    const covered = new Set();
    for (const t of TOPOLOGIES) for (const v of VARIANTS) {
        let p;
        try { p = solvePoint(cfg(t.id, v)); } catch (e) { if (e.code) continue; throw e; }
        const s = qPointSummary(p);
        if (s.status === 'off') continue;
        for (const path of [s.load, ...s.drive]) {
            assert.ok(Math.abs(path.residual) < 1e-6, t.id + ' ' + path.id + ' ' + JSON.stringify(v) + ' residual ' + path.residual);
            assert.ok(path.terms.every(x => Number.isFinite(x.value)), t.id + ' ' + path.id + ' finite terms');
            checked++;
        }
        covered.add(t.id);
        assert.ok(Math.abs(p.powerResidual) < 1e-6, t.id + ' power balance');
    }
    assert.ok(checked > 60, 'checked ' + checked + ' loops');
    assert.deepEqual([...covered].sort(), TOPOLOGIES.map(t => t.id).sort(), 'every topology was checked at least once');
});

test('every topology reports its load path and the expected number of drive paths', () => {
    const expected = { resistor: 0, 'gpio-source': 0, 'gpio-sink': 0, 'digital-npn': 1, 'npn-low': 1, 'npn-follower': 1, 'npn-current-sink': 1,
        'nmos-low': 1, 'pnp-high': 1, 'pmos-high': 1, 'npn-pnp': 2, 'npn-pmos': 2, 'nmos-pmos': 2 };
    assert.deepEqual(Object.keys(expected).sort(), TOPOLOGIES.map(t => t.id).sort());
    for (const [id, drive] of Object.entries(expected)) {
        const s = qPointSummary(point(id));
        assert.equal(s.status, 'on', id);
        assert.equal(s.drive.length, drive, id);
        assert.ok(byId(s.load, 'RLED') && byId(s.load, 'LED1'), id);
    }
});

test('load path rail: GPIO VDD for a sourcing pin, VLED otherwise', () => {
    assert.equal(qPointSummary(point('gpio-source')).load.railLabel, 'GPIO VDD');
    assert.equal(qPointSummary(point('gpio-sink')).load.railLabel, 'VLED');
    assert.equal(qPointSummary(point('npn-pmos')).load.railLabel, 'VLED');
});

test('emitter follower keeps IE (LED) and IC (rail) apart', () => {
    const p = point('npn-follower'), s = qPointSummary(p), q = s.devices[0];
    assert.equal(byId(s.load, 'RLED').currentLabel, 'IE');
    assert.ok(near(byId(s.load, 'RLED').current, p.emitterCurrent));
    assert.equal(byId(s.load, 'Q1').currentLabel, 'IC');
    assert.ok(near(byId(s.load, 'Q1').current, q.ic));
    assert.ok(Math.abs(q.ie - q.ic - q.ib) < 1e-10, 'IE = IC + IB within the solver tolerance');
    assert.ok(q.ie > q.ic);
    assert.ok(near(s.drive[0].terms.find(t => t.id === 'VE').value, p.nodes.emitter));
});

test('emitter-resistor current sink drops IE x RE, not IC x RE', () => {
    const p = point('npn-current-sink', { emitterResistance: 330 }), s = qPointSummary(p), q = s.devices[0];
    const re = byId(s.load, 'RE');
    assert.equal(re.currentLabel, 'IE');
    assert.ok(near(re.value, q.ie * 330, 1e-9));
    assert.ok(Math.abs(re.value - q.ic * 330) > 1e-6, 'IC x RE would be a different number');
    assert.equal(byId(s.load, 'RLED').currentLabel, 'IC');
    assert.ok(near(byId(s.load, 'RLED').current, q.ic));
});

test('DTC separates external IO/II, input II, internal IB and internal IC/IB', () => {
    const p = point('digital-npn'), q = qPointSummary(p).devices[0];
    assert.equal(q.kind, 'digital');
    // Reference operating point of the default DTC043ZEB circuit (see issue #21 section 5.3).
    assert.ok(near(q.ii, 0.5441e-3, 2e-3), 'II ' + q.ii);
    assert.ok(near(q.ib, 0.5289e-3, 2e-3), 'IB ' + q.ib);
    assert.ok(near(q.externalRatio, 16.53, 2e-3), 'IO/II ' + q.externalRatio);
    assert.ok(near(q.internalRatio, 17.01, 2e-3), 'IC/IB ' + q.internalRatio);
    assert.ok(Math.abs(q.externalRatio - q.internalRatio) > 0.3, 'the two ratios are not interchangeable');
    assert.ok(near(q.ii, q.io / q.externalRatio) && near(q.ib, q.io / q.internalRatio));
    assert.ok(near(q.ii - q.ib, q.vbe / q.r2, 1e-9), 'the difference is the current through R2');
    assert.equal(q.testRatio, 10, 'VO(on) curve is for IO/II = 10');
    assert.ok(q.figures.some(f => /Fig\.5/.test(f.figure)));
    const drive = qPointSummary(p).drive[0];
    assert.ok(near(byId(drive, 'Q1.R1').value, q.ii * q.r1, 1e-9));
    assert.ok(near(drive.rail, q.inputVoltage, 1e-9));
});

test('DTC R1 / R2 tolerance changes only the internal split, and the identities still hold', () => {
    const q = qPointSummary(point('digital-npn', { dtcR1Scale: 1.2, dtcRatio: 8 })).devices[0];
    assert.ok(near(q.ii - q.ib, q.vbe / q.r2, 1e-9));
    assert.ok(near(q.r2 / q.r1, 8, 1e-9));
});

test('BJT rows carry IC/IB, hFE, the datasheet test ratio and the figures behind them, with no verdict', () => {
    for (const [model, test, mismatch] of [['onsemi:MMBT3904LT1G', 10, false], ['nexperia:BC847B', 20, true]]) {
        const q = qPointSummary(point('npn-low', { deviceModels: { Q1: model } })).devices[0];
        assert.equal(q.kind, 'bjt');
        assert.ok(near(q.forcedRatio, q.ic / q.ib));
        assert.equal(q.testRatio, test, model);
        assert.equal(q.ratioMismatch, mismatch, model);
        assert.ok(['hFE', 'VCE(sat)', 'VBE(sat)'].every(l => q.figures.some(f => f.label === l && /Fig\.\d+/.test(f.figure))), model);
        for (const key of ['verdict', 'pass', 'ok', 'status', 'safe']) assert.ok(!(key in q), key);
    }
});

test('active-region BJT use is reported as active, not as a failure', () => {
    const q = qPointSummary(point('npn-follower')).devices[0];
    assert.equal(q.region, 'active');
    assert.ok(near(q.forcedRatio, q.activeGain, 1e-6), 'IC/IB follows hFE in the active region');
});

test('compound high-side separates the GPIO-to-Q1 drive from the Q2 drive path', () => {
    for (const id of ['npn-pnp', 'npn-pmos', 'nmos-pmos']) {
        const p = point(id), s = qPointSummary(p);
        const [input, output] = s.drive;
        assert.equal(input.id, 'drive-input'); assert.equal(output.id, 'drive-output');
        assert.ok(near(input.rail, p.gpioVoltage), id + ' input path closes at the GPIO pin');
        assert.equal(output.railLabel, 'VLED');
        assert.ok(byId(output, 'Rdrive'), id);
        assert.equal(byId(s.load, 'Q2').instanceId, 'Q2');
        assert.ok(s.devices.map(d => d.instanceId).sort().join() === 'Q1,Q2', id);
    }
});

test('MOSFET gate drive: |VGS| equals the gate divider drop on the drive path', () => {
    const p = point('nmos-low'), s = qPointSummary(p), q = s.devices[0];
    assert.equal(q.kind, 'mosfet');
    assert.ok(near(q.vgs, byId(s.drive[0], 'RGS').value, 1e-9));
    assert.ok(near(q.vds, byId(s.load, 'Q1').value, 1e-9));
    const hs = qPointSummary(point('pmos-high')), m = hs.devices[0];
    assert.ok(near(m.vgs, byId(hs.drive[0], 'RGS').value, 1e-9));
});

test('OFF states show no voltage split and no ratios instead of invented zeros', () => {
    const s = qPointSummary(point('npn-low', { state: 'LOW' }));
    assert.equal(s.status, 'off');
    assert.equal(s.load, null);
    assert.deepEqual(s.drive, []);
    assert.deepEqual(s.devices, []);
    assert.match(s.note, /OFF/);
    assert.equal(qPointSummary(point('digital-npn', { state: 'LOW' })).status, 'off');
});

test('conditions the model cannot decide are rejected by the solver, so no summary can be made for them', () => {
    assert.throws(() => solvePoint(cfg('npn-low', { state: 'HI_Z', pull: 'none' })), e => e.code === 'unsupported');
    assert.throws(() => solvePoint(cfg('gpio-sink', { state: 'HIGH', vcc: 12 })), e => e.code === 'unsupported');
});
