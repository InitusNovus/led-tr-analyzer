import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDS, SOURCES } from '../src/data/catalog.js';
import { ledVoltage, context } from '../src/core/devices.js';
import { opticalAtCurrent, opticalCapability } from '../src/core/optics.js';

const KB = Object.values(LEDS).filter(l => l.id.startsWith('APT2012'));
const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);

test('Kingbright APT2012 set: six colours, each pinned to its own sheet, one family group', () => {
    assert.deepEqual(KB.map(l => l.id), ['APT2012SURCK', 'APT2012SYCK', 'APT2012CGCK', 'APT2012SECK', 'APT2012ZGCK', 'APT2012QBC-D']);
    for (const l of KB) {
        const src = SOURCES[l.source];
        assert.ok(/^V\.\d+[A-Z] \/ \d{4}-\d\d-\d\d$/.test(src.revision) && src.manufacturer === 'Kingbright' && src.url.endsWith(l.id.replace('-D', '-D') + '.pdf'), l.id);
        assert.equal(l.group, 'Kingbright 0805'); assert.equal(l.package, '0805');
    }
    assert.equal(new Set(KB.map(l => l.source)).size, KB.length);
});

test('Vf at the test current sits at the sheet typ (±0.1 V sheet tolerance) and below the sheet max', () => {
    for (const l of KB) {
        const v = ledVoltage(l.id, l.vfTest.current, 25, 0, context());
        close(v, l.vfTest.typ, 0.1); assert.ok(v <= l.vfTest.max, l.id);
    }
});

test('optical anchors are the sheet Min./Typ. rows (non-star), scaling together with current', () => {
    const want = { APT2012SURCK: [120, 230], APT2012SYCK: [80, 150], APT2012CGCK: [20, 50], APT2012SECK: [120, 250], APT2012ZGCK: [300, 550], 'APT2012QBC-D': [40, 100] };
    for (const l of KB) {
        const [mn, ty] = want[l.id], cap = opticalCapability(l.id);
        assert.ok(cap.kind === 'scalar' && cap.hasMin && cap.hasTypical && cap.canInvert, l.id);
        const at = opticalAtCurrent(l.id, .02, 25), half = opticalAtCurrent(l.id, .01, 25);
        close(at.minMcd, mn, 1e-6 * mn); close(at.nominalMcd, ty, 1e-6 * ty);
        close(half.minMcd / half.nominalMcd, mn / ty, 1e-9);
    }
    assert.ok(LEDS.APT2012SURCK.notes.some(n => /\*40/.test(n)) && LEDS.APT2012SECK.notes.some(n => /\*80/.test(n)), 'starred CIE127 rows are documented, not mixed in');
});

test('curves are ordered and the temperature coefficient follows the chip material', () => {
    for (const l of KB) {
        const rel = l.optical.relative.points;
        for (let i = 1; i < rel.length; i++) assert.ok(rel[i][1] > rel[i - 1][1], l.id);
        const ta = l.optical.temperature.points;
        close(ta.find(p => p[0] === 25)[1], 1, 1e-9);
        assert.ok(ta[0][1] > 1 && ta.at(-1)[1] < 1, l.id);
        const d = l.currentDerating.points;
        assert.equal(d[0][1], l.limits.current); assert.equal(d.at(-1)[0], 85);
        for (let i = 1; i < d.length; i++) assert.ok(d[i][1] <= d[i - 1][1] && d[i][0] > d[i - 1][0], l.id);
        assert.ok(l.limits.pulseCurrent >= l.limits.current && l.limits.power > 0 && l.limits.reverse === 5, l.id);
    }
    // AlGaInP chips −1.9 mV/°C, InGaN −2.9 mV/°C
    for (const id of ['APT2012SURCK', 'APT2012SYCK', 'APT2012CGCK', 'APT2012SECK']) assert.equal(LEDS[id].vfTempCoefficient, -.0019);
    for (const id of ['APT2012ZGCK', 'APT2012QBC-D']) assert.equal(LEDS[id].vfTempCoefficient, -.0029);
    assert.equal(LEDS.APT2012ZGCK.limits.current, .025); assert.equal(LEDS.APT2012ZGCK.limits.power, .1025);
});
