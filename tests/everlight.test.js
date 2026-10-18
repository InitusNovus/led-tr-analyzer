import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDS, ledModel, ledIntensityBins, SOURCES } from '../src/data/catalog.js';
import { ledVoltage, context } from '../src/core/devices.js';
import { opticalAtCurrent, opticalCapability, solveOpticalCurrent } from '../src/core/optics.js';
import { analyzePoint, selectResistance } from '../src/core/analysis.js';
import { freshConfig, transitionConfig } from '../src/core/topologies.js';

const EV = Object.values(LEDS).filter(l => l.source?.startsWith('ev'));
const bySize = s => EV.filter(l => l.package === s);
const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);

test('Everlight series: 0805 and 0603 and 0402 sets, each part pinned to its own datasheet', () => {
    assert.equal(bySize('0805').length, 6);
    assert.equal(bySize('0603').length, 7);
    assert.equal(bySize('0402').length, 5);
    for (const l of EV) {
        const src = SOURCES[l.source];
        assert.ok(src && /^DSE-\d{7} Rev\.\d+ \/ \d{4}-\d\d-\d\d$/.test(src.revision), l.id + ' revision ' + src?.revision);
        assert.ok(src.url.startsWith('https://') && src.url.endsWith('.pdf'), l.id);
        assert.equal(src.manufacturer, 'Everlight');
        assert.ok(l.group.startsWith('Everlight ') && l.lcscId, l.id);
    }
    // sources are one per part: no part borrows a sibling's sheet
    assert.equal(new Set(EV.map(l => l.source)).size, EV.length);
});

test('digitized Vf(I) agrees with the sheet table at the test current (cross-check of the chart reading)', () => {
    for (const l of EV) {
        const t = l.vfTest;
        assert.ok(t.current > 0 && (t.min != null || t.max != null), l.id);
        const v = ledVoltage(l.id, t.current, 25, 0, context());
        if (t.min != null) assert.ok(v >= t.min - 1e-9, `${l.id} Vf ${v} below table min ${t.min}`);
        if (t.max != null) assert.ok(v <= t.max + 1e-9, `${l.id} Vf ${v} above table max ${t.max}`);
        if (t.typ != null) close(v, t.typ, 0.08);
        if (l.vf) assert.ok(ledVoltage(l.id, 0.001, 25, 0, context()) < v, l.id + ' Vf rises with current');
    }
});

test('optical anchors are the sheet values; min/typ sheets are scalar+min, min/max sheets are ranges', () => {
    for (const l of EV) {
        const o = l.optical, cap = opticalCapability(l.id);
        assert.ok(o.testCurrent > 0 && cap.canInvert, l.id);
        const at = opticalAtCurrent(l.id, o.testCurrent, 25);
        if (Number.isFinite(o.maxMcd)) {
            assert.equal(cap.kind, 'range', l.id);
            assert.equal(o.nominalMcd, null, l.id + ': a min/max sheet has no typical anchor');
            close(at.minMcd, o.minMcd, 1e-6 * o.minMcd); close(at.maxMcd, o.maxMcd, 1e-6 * o.maxMcd);
        } else {
            assert.equal(cap.kind, 'scalar', l.id);
            assert.ok(cap.hasMin && !cap.hasRange && cap.hasTypical, l.id);
            assert.ok(o.nominalMcd > o.minMcd, l.id + ' typ above min');
            close(at.nominalMcd, o.nominalMcd, 1e-6 * o.nominalMcd); close(at.minMcd, o.minMcd, 1e-6 * o.minMcd);
            assert.equal(at.maxMcd, null);
        }
    }
});

test('min and typ scale together with the current and keep the sheet ratio', () => {
    for (const id of ['17-21SURC/S530-A2/4T', '16-213SYGC/S530-E3/TR8', '19-21SYGC/S530-E2/4T']) {
        const o = LEDS[id].optical, half = opticalAtCurrent(id, o.testCurrent / 2, 25);
        assert.ok(half.nominalMcd < o.nominalMcd * .8, id + ' half current is dimmer');
        close(half.minMcd / half.nominalMcd, o.minMcd / o.nominalMcd, 1e-9);
    }
});

test('the guaranteed-minimum basis solves back to the test current on a min/typ part', () => {
    const id = '17-21UYC/S530-A3/4T';   // Iv min 40 / typ 62 mcd @20mA
    const r = solveOpticalCurrent(id, 40, { basis: 'min' });
    close(r.current, 0.02, 2e-4);
    const t = solveOpticalCurrent(id, 62, { basis: 'typ' });
    close(t.current, 0.02, 2e-4);
    assert.throws(() => solveOpticalCurrent(id, 40, { basis: 'representative' }), /anchor/, 'no range, so no midpoint basis');
});

test('rank tables stay inside the part range, are ascending and contiguous', () => {
    for (const l of EV) {
        const bins = ledIntensityBins(l.id);
        if (!bins.length) { assert.ok(!l.optical.binSource, l.id); continue; }
        assert.ok(l.optical.binSource && l.optical.binTolerance, l.id);
        assert.equal(bins[0].min, l.optical.minMcd, l.id + ' first rank starts at the part minimum');
        assert.equal(bins.at(-1).max, l.optical.maxMcd, l.id + ' last rank ends at the part maximum');
        for (let i = 1; i < bins.length; i++) assert.equal(bins[i].min, bins[i - 1].max, l.id + ' ' + bins[i].id);
    }
    // XL2M2TY prints a rank table that contradicts its own electro-optical row, so none is exposed
    assert.deepEqual(ledIntensityBins('17-21/BHC-XL2M2TY/4T'), []);
    // part-number grade: AQ2R2B = ranks Q2..R2
    const m = ledModel('16-213/R6C-AQ2R2B/3T', 'R1');
    assert.equal(m.optical.minMcd, 112); assert.equal(m.optical.maxMcd, 140); assert.equal(m.optical.nominalMcd, null);
    const lo = opticalAtCurrent('16-213/R6C-AQ2R2B/3T', 0.02, 25, undefined, 'Q2');
    close(lo.minMcd, 90, 1e-6); close(lo.maxMcd, 112, 1e-6);
});

test('relative-Iv, temperature and derating curves are physically ordered', () => {
    for (const l of EV) {
        const rel = l.optical.relative.points;
        for (let i = 1; i < rel.length; i++) assert.ok(rel[i][1] >= rel[i - 1][1] - 1e-9, `${l.id} Iv rises with current at ${rel[i][0]}`);
        const ref = opticalAtCurrent(l.id, l.optical.testCurrent, 25), hot = opticalAtCurrent(l.id, l.optical.testCurrent, 85);
        if (l.optical.temperature) {
            const ta = l.optical.temperature.points, at25 = ta.find(p => p[0] === 25)[1];
            close(at25, 1, 1e-9);
            assert.ok(ta[0][1] > 1 && ta.at(-1)[1] < 1, l.id + ' cooler brighter, hotter dimmer');
            const v = (hot.nominalMcd ?? hot.minMcd) / (ref.nominalMcd ?? ref.minMcd);
            assert.ok(v < 1 && v > .8, `${l.id} 85 °C factor ${v}`);
        }
        if (l.currentDerating) {
            const d = l.currentDerating.points;
            assert.equal(d[0][1], l.limits.current, l.id + ' derating starts at the DC rating');
            assert.ok(d.at(-1)[1] < l.limits.current && d.at(-1)[0] === 85, l.id);
            for (let i = 1; i < d.length; i++) assert.ok(d[i][1] <= d[i - 1][1] + 1e-9 && d[i][0] > d[i - 1][0], l.id);
        }
        const lim = l.limits;
        assert.ok(lim.current > 0 && lim.pulseCurrent >= lim.current && lim.power > 0 && lim.reverse === 5, l.id);
    }
});

test('sheets with unreadable or self-contradicting charts say so instead of inventing curves', () => {
    const blue = LEDS['16-213/BHC-AN1P2/3T'];
    assert.equal(blue.vf, undefined); assert.ok(blue.vfTableOnly && blue.vfTableOnly.nominalAssumption > 0);
    assert.equal(blue.currentDerating, undefined);
    // a chart that contradicts its own table is not used either: 19-21/GHC-YR1S2 reads 3.0 V at 20 mA but the table says typ 3.3 V
    const green = LEDS['19-21/GHC-YR1S2/4T'];
    assert.equal(green.vf, undefined); assert.equal(green.vfTableOnly.nominalAssumption, 3.3);
    const white = LEDS['17-21/T1D-CP2R1TY/4T'];
    assert.equal(white.optical.temperature, null);
    const ctx = context();
    const r = opticalAtCurrent(white.id, 0.005, 60, ctx);
    assert.equal(r.kind, 'unavailable'); assert.equal(r.reason, 'optical-temperature-unsupported');
});

test('an Everlight part runs through the whole analysis (operating point, limits, goal solve with min basis)', () => {
    const id = '17-21SURC/S530-A2/4T';   // Iv min 15 / typ 38 mcd @20mA
    const base = { ...transitionConfig(freshConfig(), 'npn-low'), led: id, resistance: 330 };
    const r = analyzePoint(base);
    assert.equal(r.ok, true);
    const p = r.point;
    assert.ok(p.current > 0 && p.optical.nominalMcd > 0 && p.optical.minMcd > 0, 'operating point and both optical numbers');
    assert.ok(p.optical.minMcd < p.optical.nominalMcd);
    const sized = selectResistance(base, .01, { targetMcd: 15, opticalBasis: 'min' });
    assert.ok(sized.selected > 0 && sized.goal.kind === 'optical', 'min-basis goal solves');
    assert.equal(sized.goal.basis, 'min');
    assert.equal(selectResistance(base, .01, { targetMcd: 15 }).goal.basis, 'min', 'auto picks the guaranteed minimum when the sheet gives one');
});
