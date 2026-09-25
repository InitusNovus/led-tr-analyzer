import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, LEDS, BJTS, DIGITAL, MOSFETS, GPIO } from '../src/data/catalog.js';
import { context, sample, ledVoltage, luminousIntensity, gpioVoltage, bjtAt, digitalAt, mosCurrent } from '../src/core/devices.js';
import { DEFAULT_CONFIG } from '../src/core/topologies.js';
const near = (a, b, t = 1e-8) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test('Kingbright electrical/photometric reference points are not mixed with starred convention', () => {
    near(ledVoltage('APT2012SURCK', .02), 1.95);
    near(luminousIntensity('APT2012SURCK', .02), 230);
    near(ledVoltage('APT2012SURCK', 0), 0);
    near(luminousIntensity('APT2012SURCK', 0), 0);
    assert.equal(LEDS.APT2012SURCK.vfTest.min, null);
});
test('KT-0805 datasheet links are sourced and absolute limits are no longer synthetic', () => {
    for (const id of ['KT-0805R','KT-0805G','KT-0805B','KT-0805YG','KT-0805Y','KT-0805O','KT-0805W']) {
        const p = LEDS[id], src = SOURCES[p.source];
        assert.ok(src.manufacturer.includes('KENTO'));
        assert.ok(src.url.startsWith('https://'));
        if (id !== 'KT-0805Y')
            assert.ok(Number.isFinite(p.limits.current) && p.limits.current > 0);
        else
            assert.equal(p.limits.current, null);
        assert.ok(Number.isFinite(p.limits.power) && p.limits.power > 0);
        const ctx = context();
        assert.ok(ledVoltage(id, Number.isFinite(p.vfTest.current) ? p.vfTest.current : .01, 25, 0, ctx) > 0);
        assert.equal(ctx.flags.has('legacy-led-unverified'), false);
    }
    near(LEDS['KT-0805R'].limits.current, .025);
    near(LEDS['KT-0805G'].limits.current, .03);
    near(LEDS['KT-0805W'].limits.power, .08);
});
test('KT table-only Y/W models expose midpoint/current-shape assumptions instead of fake curves', () => {
    const y = context();
    near(ledVoltage('KT-0805Y', .01, 25, 0, y), LEDS['KT-0805Y'].vfTableOnly.nominalAssumption);
    assert.ok(y.flags.has('approximation:LED-table-midpoint'));
    assert.ok(y.flags.has('not-modeled:LED-vf-current-shape'));
    assert.equal(LEDS['KT-0805Y'].limits.current, null);
    assert.equal(luminousIntensity('KT-0805Y', .02, 25, context()), null);

    const w = LEDS['KT-0805W'], wc = context();
    near(ledVoltage('KT-0805W', w.vfTest.current, 25, 0, wc), w.vfTableOnly.nominalAssumption);
    assert.ok(wc.flags.has('approximation:LED-table-midpoint'));
    const away = context();
    ledVoltage('KT-0805W', w.vfTest.current * 2, 25, 0, away);
    assert.ok(away.flags.has('extrapolation:LED-table-only-current'));
    near(luminousIntensity('KT-0805W', .005, 25, context()), 350);
    const whiteAway = context();
    assert.equal(luminousIntensity('KT-0805W', .01, 25, whiteAway), null);
    assert.ok(whiteAway.flags.has('not-modeled:LED-optical-current-shape'));
});
test('KT min/max intensity ranges are not converted into invented typical mcd', () => {
    for (const id of ['KT-0805R','KT-0805G','KT-0805B','KT-0805YG','KT-0805Y','KT-0805O']) {
        const ctx = context();
        assert.equal(luminousIntensity(id, LEDS[id].optical.testCurrent, 25, ctx), null);
        assert.ok(ctx.flags.has('not-modeled:LED-absolute-optical-anchor'));
    }
});
test('curve endpoints are preserved and provenance is resolvable', () => {
    const ktCurves = Object.values(LEDS).flatMap(p => [p.vf, p.optical?.relative, p.optical?.temperature, p.currentDerating].filter(Boolean));
    const curves = [LEDS.APT2012SURCK.vf, LEDS.APT2012SURCK.optical.relative, LEDS.APT2012SURCK.optical.temperature,
        ...ktCurves, DIGITAL.on, DIGITAL.gain, GPIO.drop, ...Object.values(BJTS).flatMap(p => [p.gain, p.vbe, p.vbeSat, p.vceSat])];
    for (const curve of curves) {
        assert.ok(SOURCES[curve.source].url.startsWith('https://'));
        assert.ok(curve.figure && curve.conditions && curve.kind);
        for (const [x, y] of curve.points) {
            const ctx = context();
            near(sample(curve, x, ctx, 'anchor'), y);
            assert.equal(ctx.flags.size, 0);
        }
    }
});
test('GPIO characterization limits are not represented as a typical curve', () => {
    assert.equal(GPIO.drop.kind, 'limit-derived-approximation');
    near(gpioVoltage(DEFAULT_CONFIG, .008), 2.9);
    near(gpioVoltage({ ...DEFAULT_CONFIG, state: 'LOW' }, -.015), 1.3);
    assert.equal(gpioVoltage({ ...DEFAULT_CONFIG, state: 'HI_Z' }, 0), null);
});
test('BJT saturation curve anchors reproduce their forced drive ratios', () => {
    for (const key of ['npn', 'pnp']) {
        const p = BJTS[key], i = .01, v = sample(p.vceSat, i);
        const q = bjtAt(key, i, v);
        near(q.base, i / p.ratio);
        near(q.collector + q.base, q.emitter);
    }
});
test('DTC external II / internal IB and dependent R2 are distinct', () => {
    const q = digitalAt(.005, sample(DIGITAL.on, .005), DEFAULT_CONFIG);
    near(q.input, .0005);
    assert.ok(q.base < q.input);
    near(q.input, q.base + q.vbe / q.r2);
    const varied = digitalAt(.005, .1, { ...DEFAULT_CONFIG, dtcR1Scale: 1.3, dtcRatio: 8 });
    near(varied.r2, 4700 * 1.3 * 8);
    assert.notEqual(q.forcedBeta, q.externalRatio);
});
test('MOS output surfaces match stored coordinates and respond to VGS', () => {
    for (const [key, p] of Object.entries(MOSFETS))
        for (const curve of p.output)
            for (const [v, i] of curve.points)
                near(mosCurrent(key, v, curve.gate), i);
    assert.ok(mosCurrent('nmos', .1, 4) > mosCurrent('nmos', .1, 3));
    assert.equal(mosCurrent('pmos', 5, 0), 0);
});
test('domain and unsupported-temperature effects are explicit', () => {
    const ctx = context();
    ledVoltage('APT2012SURCK', .0001, 100, 0, ctx);
    bjtAt('npn', .5, .5, 80, ctx);
    mosCurrent('nmos', 10, 12, 80, ctx);
    assert.ok([...ctx.flags].some(s => s.startsWith('extrapolation:')));
    assert.ok(ctx.flags.has('not-modeled:transistor-electrical-temperature'));
});
test('LED low-current tail remains nonlinear and is explicitly outside the curve', () => {
    const ctx = context();
    const v = ledVoltage('APT2012SURCK', 1e-6, 25, 0, ctx);
    assert.ok(v > 1 && v < 1.75);
    assert.ok(ctx.flags.has('extrapolation:LED-low-current-tail'));
    const opticalCtx = context();
    const i = luminousIntensity('APT2012SURCK', .01, 40, opticalCtx);
    assert.ok(i > 0 && i < 115);
    assert.ok(opticalCtx.flags.has('approximation:optical-temperature-separable'));
});
