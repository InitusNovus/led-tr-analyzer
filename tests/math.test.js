import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, bisect, standardResistor, finite, ModelError, E24, E96 } from '../src/core/math.js';
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);
test('curve linear/log interpolation reproduces anchors and midpoint', () => {
    near(interpolate([[1, 2], [3, 6]], 2).value, 4);
    near(interpolate([[1, 2], [100, 6]], 10, { logX: true }).value, 4);
    near(interpolate([[1, 1], [3, 100]], 2, { logY: true }).value, 10);
    assert.equal(interpolate([[1, 2], [3, 6]], 1).extrapolated, false);
});
test('curve domain policy is visible, never silent', () => {
    assert.equal(interpolate([[1, 2], [3, 6]], 4).extrapolated, true);
    assert.equal(interpolate([[1, 2], [3, 6]], 4, { outside: 'hold' }).value, 6);
    assert.throws(() => interpolate([[1, 2], [3, 6]], 4, { outside: 'reject' }), ModelError);
});
for (const points of [[], [[1, 1]], [[1, 1], [1, 2]], [[2, 1], [1, 2]], [[1, NaN], [2, 3]]])
    test(`invalid curve rejected ${JSON.stringify(points)}`, () => assert.throws(() => interpolate(points, 1)));
test('bisection solves a nonlinear function with diagnostics', () => {
    const r = bisect(x => x * x - 2, 0, 2);
    assert.equal(r.converged, true);
    near(r.value, Math.sqrt(2));
    assert.ok(Math.abs(r.residual) < 1e-9);
});
test('bisection endpoints, absent roots, non-finite functions and iteration exhaustion', () => {
    assert.equal(bisect(x => x, 0, 2).value, 0);
    assert.throws(() => bisect(x => x * x + 1, -1, 1), /닫히지/);
    assert.throws(() => bisect(() => NaN, 0, 2));
    assert.equal(bisect(x => x * x - 2, 0, 2, { iterations: 1 }).converged, false);
});
for (const series of ['E24', 'E96', 'E24+E96']) {
    test(`${series} decade boundary and exact-match strategies`, () => {
        assert.equal(standardResistor(990, series), 1000);
        for (const strategy of ['closest', 'safe', 'bright'])
            assert.equal(standardResistor(1000, series, strategy), 1000);
        assert.equal(standardResistor(.00001, series), .00001);
        assert.ok(standardResistor(990, series, 'bright') < 990);
        assert.ok(standardResistor(990, series, 'safe') >= 990);
    });
}
test('E-series exhaustive anchors survive across decades', () => {
    for (const [name, values] of [['E24', E24], ['E96', E96]])
        for (let d = -5; d <= 9; d++)
            for (const v of values) {
                const r = v * 10 ** d;
                near(standardResistor(r, name), r, Math.max(1e-14, r * 1e-11));
            }
});
for (const x of [0, -1, NaN, Infinity, '3', '', null, undefined])
    test(`invalid resistance/input ${String(x)}`, () => {
        assert.throws(() => standardResistor(x));
        if (x !== 0 && x !== -1)
            assert.throws(() => finite(x));
    });
test('unknown series/strategy rejected', () => {
    assert.throws(() => standardResistor(123, 'E12'));
    assert.throws(() => standardResistor(123, 'E24', 'fake'));
});
