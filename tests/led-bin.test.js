import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDS, ledModel, ledIntensityBins } from '../src/data/catalog.js';
import { opticalAtCurrent, opticalCapability, solveOpticalCurrent } from '../src/core/optics.js';
import { analyzePoint, selectResistance } from '../src/core/analysis.js';
import { freshConfig, normalizeConfig, transitionConfig } from '../src/core/topologies.js';
import { designReducer, initialDesignState } from '../src/ui/designState.js';
import { goalDrift } from '../src/core/goal.js';

const BINNED = ['KT-0805R', 'KT-0805G', 'KT-0805B', 'KT-0805YG', 'KT-0805Y', 'KT-0805O'];
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);

test('the datasheet intensity bins tile the whole documented range without gaps or overlaps', () => {
    for (const id of BINNED) {
        const o = LEDS[id].optical, bins = ledIntensityBins(id);
        assert.ok(bins.length >= 5, id);
        assert.equal(bins[0].min, o.minMcd, id + ' first bin starts at the sheet minimum');
        assert.equal(bins.at(-1).max, o.maxMcd, id + ' last bin ends at the sheet maximum');
        for (let i = 1; i < bins.length; i++) assert.equal(bins[i].min, bins[i - 1].max, `${id} ${bins[i].id}`);
        assert.equal(new Set(bins.map(b => b.id)).size, bins.length, id + ' bin ids are unique');
    }
    for (const id of ['APT2012SURCK', 'KT-0805W']) assert.deepEqual(ledIntensityBins(id), [], id + ' has no bin table of its own');
});

test('voltage and wavelength bins are kept as data with their conditions, and are contiguous', () => {
    for (const id of BINNED) {
        const { voltage, wavelength } = LEDS[id].bins;
        for (const t of [voltage, wavelength]) {
            assert.ok(Number.isFinite(t.current) && t.current > 0 && t.source && t.tolerance, id);
            for (let i = 1; i < t.rows.length; i++) assert.equal(t.rows[i].min, t.rows[i - 1].max, id + ' ' + t.rows[i].id);
        }
    }
    // The sheet defines R1–R5 as red WAVELENGTH bins (615–630 nm); they are not brightness classes.
    assert.deepEqual(LEDS['KT-0805R'].bins.wavelength.rows.map(r => r.id), ['R1', 'R2', 'R3', 'R4', 'R5']);
    assert.deepEqual([LEDS['KT-0805R'].bins.wavelength.rows[1].min, LEDS['KT-0805R'].bins.wavelength.rows[1].max], [618, 621]);
});

test('without a bin nothing changes, and an unknown bin is not invented', () => {
    for (const id of Object.keys(LEDS)) assert.equal(ledModel(id), LEDS[id]);
    assert.equal(ledModel('KT-0805R', ''), LEDS['KT-0805R']);
    assert.equal(ledModel('KT-0805R', 'P99'), undefined);
    assert.equal(ledModel('KT-0805R', 'P25'), undefined, 'a bin of another colour does not exist here');
    assert.equal(ledModel('APT2012SURCK', 'P21'), undefined);
    const a = opticalAtCurrent('KT-0805R', .02);
    assert.deepEqual([a.minMcd, a.maxMcd], [85, 210]);
    assert.throws(() => opticalAtCurrent('KT-0805R', .02, 25, undefined, 'P99'), { code: 'invalid-input' });
});

test('a selected bin narrows the range at the test current, drops the typical anchor and keeps the curve scaling', () => {
    const bin = opticalAtCurrent('KT-0805R', .02, 25, undefined, 'P21');
    assert.deepEqual([bin.minMcd, bin.maxMcd], [120, 145]);
    assert.equal(bin.nominalMcd, null);
    assert.equal(bin.scale, 1);
    const whole = opticalAtCurrent('KT-0805R', .01), part = opticalAtCurrent('KT-0805R', .01, 25, undefined, 'P21');
    close(part.scale, whole.scale);
    close(part.minMcd, 120 * whole.scale);
    close(part.maxMcd, 145 * whole.scale);
    assert.ok(part.maxMcd - part.minMcd < whole.maxMcd - whole.minMcd);
    const g = opticalAtCurrent('KT-0805G', .005, 25, undefined, 'P25');
    assert.deepEqual([g.minMcd, g.maxMcd], [250, 300], 'G bins are sheet values at 5 mA');
    const y = opticalAtCurrent('KT-0805Y', .02, 25, undefined, 'P20');
    assert.deepEqual([y.minMcd, y.maxMcd], [100, 120]);
    assert.equal(y.kind, 'range');
});

test('the target inverse follows the bin: a bin whose minimum equals the target needs exactly the test current', () => {
    const whole = solveOpticalCurrent('KT-0805R', 100, { basis: 'min' });
    const p20 = solveOpticalCurrent('KT-0805R', 100, { basis: 'min', bin: 'P20' });
    close(p20.current, .02, 1e-6);
    assert.ok(whole.current > p20.current, 'the whole-range minimum (85) needs more current for 100 mcd than the 100–120 bin');
    const p23 = solveOpticalCurrent('KT-0805R', 100, { basis: 'min', bin: 'P23' });
    assert.ok(p23.current < p20.current);
    assert.equal(opticalCapability('KT-0805R', 'P21').canInvert, true);
    assert.equal(opticalCapability('KT-0805Y', 'P21').canInvert, true, 'Y now has its own relative-current curve');
    assert.equal(opticalCapability('KT-0805W', null).canInvert, false, 'W is a single test point');
});

test('the whole analysis uses the bin: operating point, sizing and goal', () => {
    const base = { ...transitionConfig(freshConfig(), 'npn-low'), led: 'KT-0805R' };
    const whole = analyzePoint(base).point, binned = analyzePoint({ ...base, ledBin: 'P21' }).point;
    close(binned.current, whole.current, 1e-12);               // the bin changes the optical estimate, not the electrical point
    assert.ok(binned.optical.maxMcd - binned.optical.minMcd < whole.optical.maxMcd - whole.optical.minMcd);
    const sized = selectResistance({ ...base, ledBin: 'P21' }, .01, { targetMcd: 100, opticalBasis: 'min' });
    const sizedWhole = selectResistance(base, .01, { targetMcd: 100, opticalBasis: 'min' });
    assert.notEqual(sized.selected, sizedWhole.selected);
    assert.equal(sized.result.point.config.ledBin, 'P21');
    assert.equal(sized.goal.status, 'met');
});

test('configuration: empty means none, unknown bins are refused with a reason', () => {
    const c = { ...transitionConfig(freshConfig(), 'npn-low'), led: 'KT-0805R' };
    assert.equal(normalizeConfig({ ...c, ledBin: '' }).ledBin, null);
    assert.equal(normalizeConfig(c).ledBin, null);
    assert.equal(normalizeConfig({ ...c, ledBin: 'P22' }).ledBin, 'P22');
    assert.throws(() => normalizeConfig({ ...c, ledBin: 'R2' }), /광도 등급/);
    const r = analyzePoint({ ...c, ledBin: 'P99' });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'invalid-input');
});

test('state: choosing a bin is explicit, an LED change forgets it, and drift names it', () => {
    let s = designReducer(initialDesignState(), { type: 'led', id: 'KT-0805R' });
    s = designReducer(s, { type: 'ledBin', bin: 'P21' });
    assert.equal(s.config.ledBin, 'P21');
    const unchanged = designReducer(s, { type: 'ledBin', bin: 'P99' });
    assert.equal(unchanged, s, 'an unknown bin is ignored, not stored');
    assert.deepEqual(goalDrift({ ...s.config, ledBin: null }, s.config).map(d => d.key), ['ledBin']);
    const other = designReducer(s, { type: 'led', id: 'KT-0805G' });
    assert.equal(other.config.ledBin, null, 'bins differ per LED, so a new LED starts unbinned');
    assert.equal(designReducer(s, { type: 'reset' }).config.ledBin, null);
    assert.equal(s.cornerSnapshot, null);
});
