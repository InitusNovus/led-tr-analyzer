import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPOLOGIES, DEFAULT_CONFIG, solvePoint } from '../src/core/topologies.js';
import { analyzePoint, analyzeCorners, selectResistance } from '../src/core/analysis.js';
const near = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);
const active = t => ({ ...DEFAULT_CONFIG, topology: t.id, state: t.active === 'LOW' ? 'LOW' : 'HIGH' });
for (const t of TOPOLOGIES) {
    test(`${t.id}: finite DC, coherent resistor power and electrical power balance`, () => {
        const r = solvePoint(active(t));
        assert.ok(r.current > 0 && r.solver.converged);
        near(r.resistorPower, r.current ** 2 * r.config.resistance, 1e-14);
        near(r.inputPower, r.dissipatedPower, 1e-6);
        for (const entry of r.ledger)
            assert.ok(Number.isFinite(entry.power) && entry.power >= 0, JSON.stringify(entry));
        assert.ok(!JSON.stringify(r).includes('NaN'));
    });
    if (t.active !== 'always')
        test(`${t.id}: logical OFF actually changes the solution`, () => {
            const c = active(t);
            c.state = t.active === 'LOW' ? 'HIGH' : 'LOW';
            if (t.id === 'pnp-high' || t.id === 'pmos-high' || t.id === 'gpio-sink')
                c.vcc = c.vdd;
            const r = solvePoint(c);
            near(r.current, 0, 1e-12);
            assert.equal(r.region, 'off');
        });
    if (t.id !== 'npn-current-sink')
        test(`${t.id}: size→verify round trip`, () => {
            const r = selectResistance(active(t), .003);
            assert.ok(r.result.ok);
            assert.ok(Math.abs(r.result.point.current / .003 - 1) < .04); // E96/union selection rounding
        });
}
test('follower LED current equals IE, not IC', () => {
    const r = solvePoint({ ...DEFAULT_CONFIG, topology: 'npn-follower' });
    near(r.current, r.emitterCurrent, 1e-12);
    near(r.sources[0].current + r.baseCurrent, r.current, 1e-8);
    assert.ok(r.nodes.emitter < r.gpioVoltage);
});
test('emitter current sink separates sensed IE from LED IC and holds current with headroom', () => {
    const c = { ...DEFAULT_CONFIG, topology: 'npn-current-sink', resistance: 1, emitterResistance: 470 };
    const a = solvePoint({ ...c, vcc: 5 }), b = solvePoint({ ...c, vcc: 12 });
    near(a.current + a.baseCurrent, a.emitterCurrent, 1e-8);
    assert.ok(Math.abs(a.current / b.current - 1) < .02);
    assert.ok(b.driverPower > a.driverPower);
});
test('weak base drive changes actual LED current instead of just adding warnings', () => {
    const c = { ...DEFAULT_CONFIG, topology: 'npn-low' };
    const strong = solvePoint(c), weak = solvePoint({ ...c, baseResistance: 1e6 });
    assert.ok(weak.current < strong.current / 3);
});
test('GPIO state and floating bases are distinguished', () => {
    assert.equal(solvePoint({ ...DEFAULT_CONFIG, state: 'HI_Z' }).current, 0); // digital TR has internal R2
    assert.equal(analyzePoint({ ...DEFAULT_CONFIG, topology: 'npn-follower', state: 'HI_Z' }).error.code, 'unsupported');
    assert.equal(solvePoint({ ...DEFAULT_CONFIG, topology: 'nmos-low', state: 'HI_Z' }).current, 0); // external gate pull
    assert.ok(solvePoint({ ...DEFAULT_CONFIG, topology: 'npn-follower', state: 'HI_Z', pull: 'up' }).current > 0);
    assert.equal(solvePoint({ ...DEFAULT_CONFIG, gpioMode: 'open-drain' }).current, 0);
});
test('different-domain direct high-side OFF and unpowered GPIO are not false passes', () => {
    for (const topology of ['pnp-high', 'pmos-high', 'gpio-sink'])
        assert.equal(analyzePoint({ ...DEFAULT_CONFIG, topology, state: 'HIGH' }).error.code, 'unsupported');
    assert.equal(analyzePoint({ ...DEFAULT_CONFIG, vdd: 0 }).error.code, 'unsupported');
});
test('absolute current rating is detected, never used as a current clamp', () => {
    const r = analyzePoint({ ...DEFAULT_CONFIG, topology: 'resistor', vcc: 24, resistance: 100 });
    assert.ok(r.ok && r.point.current > .03);
    assert.equal(r.validation.status, 'limits-exceeded');
});
test('unverified legacy limits never produce a verified result', () => {
    const r = analyzePoint({ ...DEFAULT_CONFIG, led: 'KT-0805R' });
    assert.equal(r.validation.status, 'unverified-limits');
    assert.equal(r.point.luminousMcd, null);
});
test('sensitivity extrema preserve physical witnesses, including resistor power', () => {
    const result = analyzeCorners({ ...DEFAULT_CONFIG, topology: 'resistor', resistorTolerance: 5 });
    assert.equal(result.kind, 'sampled-sensitivity');
    assert.equal(result.validCount, 27);
    for (const e of Object.values(result.extrema))
        for (const w of [e.min, e.max])
            near(w.point.resistorPower, w.point.current ** 2 * w.scenario.resistance, 1e-12);
    assert.ok(result.extrema.current.min.value <= result.extrema.current.max.value);
});
test('failed scenario corners remain visible (VDD range)', () => {
    const r = analyzeCorners({ ...DEFAULT_CONFIG, vdd: 3.6, vddTolerance: 5 });
    assert.ok(r.failures.length > 0);
    assert.ok(r.validCount < r.count);
});
for (const value of [NaN, Infinity, -1, '', null])
    test(`input error propagates without coercion: ${String(value)}`, () => {
        assert.equal(analyzePoint({ ...DEFAULT_CONFIG, resistance: value }).error.code, 'invalid-input');
    });
test('zero brightness/current sizing fails cleanly, no synthetic 0Ω', () => {
    assert.throws(() => selectResistance(DEFAULT_CONFIG, 0));
    assert.throws(() => selectResistance(DEFAULT_CONFIG, -1));
    assert.throws(() => selectResistance(DEFAULT_CONFIG, .001, { targetMcd: 0 }));
    assert.throws(() => selectResistance({ ...DEFAULT_CONFIG, led: 'KT-0805R' }, .001, { targetMcd: 20 }));
});
test('optical target inversion uses the selected LED optical model', () => {
    const r = selectResistance(DEFAULT_CONFIG, .01, { targetMcd: 115 });
    near(r.targetCurrent, .01, 1e-8);
});
test('supply/resistor grids retain power consistency and finite results', () => {
    for (const t of TOPOLOGIES)
        for (const vcc of [3.3, 5, 12])
            for (const resistance of [100, 1000, 10000]) {
                const c = { ...active(t), vcc, resistance };
                const r = analyzePoint(c);
                assert.ok(r.ok, `${t.id} ${vcc}V ${resistance}Ω: ${JSON.stringify(r.error)}`);
                near(r.point.powerResidual, 0, 2e-6);
                assert.ok(r.point.current >= 0 && Number.isFinite(r.point.current), t.id);
                for (const q of r.point.semiconductors)
                    assert.ok(q.power >= 0 && q.voltage >= -1e-6, `${t.id} ${JSON.stringify(q)}`);
            }
});
test('OFF device voltage limits still apply and DTC provenance is retained', () => {
    const r = analyzePoint({ ...DEFAULT_CONFIG, vcc: 60, state: 'LOW' });
    assert.ok(r.ok);
    assert.ok(r.point.provenance.includes('dtc'));
    assert.ok(r.validation.checks.some(c => c.id.includes('voltage') && c.status === 'exceeded'));
});
test('high-side MOS gate stress is detected without silently clamping VGS', () => {
    const r = analyzePoint({ ...DEFAULT_CONFIG, topology: 'nmos-pmos', vcc: 24 });
    assert.ok(r.ok && Math.abs(r.point.gateVoltage) > 20);
    assert.ok(r.validation.checks.some(c => c.id.includes('VGS') && c.status === 'exceeded'));
});
test('auxiliary resistor dissipation and total GPIO current are checked', () => {
    const r = analyzePoint({ ...DEFAULT_CONFIG, topology: 'npn-low', baseResistance: 100, otherSourceCurrent: .079 });
    assert.ok(r.ok);
    assert.ok(r.validation.checks.some(c => c.id === 'GPIO total source' && c.status === 'exceeded'));
    assert.ok(r.validation.checks.some(c => c.id === 'RB power budget'));
});
test('digital internal-resistor corners do not double-count input current', () => {
    for (const dtcR1Scale of [.7, 1, 1.3])
        for (const dtcRatio of [8, 10, 12]) {
            const r = solvePoint({ ...DEFAULT_CONFIG, dtcR1Scale, dtcRatio });
            near(r.inputPower, r.dissipatedPower, 1e-6);
            const R2 = r.ledger.find(p => p.id === 'R2 internal');
            near(r.externalInputCurrent, r.baseCurrent + R2.current, 1e-9);
        }
});
test('low supply does not acquire fictitious sub-mA conduction from an ohmic LED tail', () => {
    const r = solvePoint({ ...DEFAULT_CONFIG, topology: 'resistor', vcc: .5, resistance: 100 });
    assert.ok(r.current < 1e-6);
    assert.ok(r.flags.includes('extrapolation:LED-low-current-tail'));
});

test('low-voltage and near-short stress never returns an inconsistent physical point', () => {
    let successful = 0, failed = 0;
    for (const t of TOPOLOGIES) for (const vcc of [.5, 1, 2, 3.3, 5, 12, 24, 48]) for (const resistance of [.001, 100, 1000, 10000]) {
        const a = analyzePoint({...active(t), vcc, resistance});
        if (!a.ok) {
            failed++;
            assert.ok(['no-bracket', 'nonconvergence', 'inconsistent-point', 'unsupported'].includes(a.error.code), JSON.stringify(a));
            continue;
        }
        successful++;
        const r = a.point;
        near(r.powerResidual, 0, 2e-8 + 1e-6 * Math.abs(r.inputPower));
        assert.ok(r.ledger.every(e => Number.isFinite(e.power) && e.power >= -1e-10));
    }
    assert.ok(successful > 300 && failed > 0); // Failures are reported, not hidden as valid OFF solutions.
});
test('all unsupported corner samples remain failures without fake extrema', () => {
    const c = analyzeCorners({...DEFAULT_CONFIG, vdd: 0, vddTolerance: 0});
    assert.equal(c.validCount, 0);
    assert.ok(c.failures.length === c.count);
    assert.ok(Object.values(c.extrema).every(e => e === null));
});
test('temperature outside a reference derating graph produces unknown thermal checks', () => {
    const r = analyzePoint({...DEFAULT_CONFIG, ambient: 100});
    assert.ok(r.ok);
    assert.ok(r.validation.checks.some(c => c.id === 'LED derated current' && c.status === 'unknown'));
    assert.ok(r.validation.checks.some(c => c.id.includes('package power') && c.status === 'unknown'));
});
