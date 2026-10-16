import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeOf, toleranceReadout, seriesAdvice, exploreScale, TOLERANCE_GRADES } from '../src/ui/tolerance.js';
import { LEDS } from '../src/data/catalog.js';

test('grades and values agree in both directions', () => {
    for (const g of TOLERANCE_GRADES) assert.equal(gradeOf(g.pct).letter, g.letter);
    assert.match(toleranceReadout(1).text, /F 등급/);
    assert.equal(toleranceReadout(3).grade, null);
    assert.match(toleranceReadout(3).text, /직접 입력/);
    assert.equal(toleranceReadout('').grade, null);
});

test('the series advice only offers a tolerance and never carries one that is already set', () => {
    assert.equal(seriesAdvice('E24', 5).suggestion, null);
    assert.equal(seriesAdvice('E24', 1).suggestion.letter, 'J');
    assert.equal(seriesAdvice('E96', 5).suggestion.pct, 1);
    assert.equal(seriesAdvice('E96', 1).suggestion, null);
    assert.equal(seriesAdvice('nope', 1), null);
    assert.ok(seriesAdvice('E96', 5).note.includes('E96'));
});

test('advice is data only: asking for it does not mutate its inputs', () => {
    const before = JSON.stringify(TOLERANCE_GRADES);
    seriesAdvice('E96', 5); toleranceReadout(5);
    assert.equal(JSON.stringify(TOLERANCE_GRADES), before);
});

test('explore scales separate the slider range from datasheet numbers', () => {
    const c = exploreScale('current', LEDS['KT-0805R']);
    assert.equal(c.range, '0.5–25 mA');
    assert.ok(c.rated == null || c.rated > 0);
    const kt = exploreScale('mcd', LEDS['KT-0805R']);
    assert.deepEqual(kt.datasheet, { min: 85, max: 210 });
    assert.equal(kt.testCurrent, 0.02);
    assert.match(kt.note, /보증이 아님/);
    assert.deepEqual(exploreScale('mcd', LEDS['APT2012SURCK']).datasheet, { typ: 230 });
    assert.equal(exploreScale('mcd', LEDS['KT-0805Y']).datasheet?.min, undefined);
});
