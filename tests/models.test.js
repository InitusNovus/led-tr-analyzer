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
test('legacy models stay selectable, but do not invent optical/absolute-limit evidence', () => {
    for (const [id, p] of Object.entries(LEDS).filter(([, p]) => p.kind === 'legacy-unverified')) {
        const ctx = context();
        assert.ok(ledVoltage(id, .01, 25, 0, ctx) > 0);
        assert.equal(luminousIntensity(id, .01), null);
        assert.equal(p.limits.current, undefined);
        assert.ok(ctx.flags.has('legacy-led-unverified'));
    }
});
test('curve endpoints are preserved and provenance is resolvable', () => {
    const curves = [LEDS.APT2012SURCK.vf, LEDS.APT2012SURCK.optical.relative, LEDS.APT2012SURCK.optical.temperature,
        DIGITAL.on, DIGITAL.gain, GPIO.drop, ...Object.values(BJTS).flatMap(p => [p.gain, p.vbe, p.vbeSat, p.vceSat])];
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
