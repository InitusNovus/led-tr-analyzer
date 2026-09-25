/** Small, dependency-free numerical helpers. All electrical quantities use SI units. */
export class ModelError extends Error {
    constructor(code, message) { super(message); this.name = 'ModelError'; this.code = code; }
}
export function finite(value, name = 'value', min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new ModelError('invalid-input', `${name}: ${min} … ${max} 범위의 유한한 숫자가 필요합니다.`);
    return value;
}
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const unique = (items) => [...new Set(items)];
/** Piecewise interpolation. Domain policy is explicit, and every extrapolation is reported.
 * logX/logY refer to the numerical coordinates, not the artwork's pixel coordinates. */
export function interpolate(points, x, { logX = false, logY = false, outside = 'extend' } = {}) {
    finite(x);
    if (!['extend', 'reject', 'hold'].includes(outside))
        throw new ModelError('invalid-curve', 'Unknown domain policy');
    if (!Array.isArray(points) || points.length < 2)
        throw new ModelError('invalid-curve', 'At least two points required');
    for (let i = 0; i < points.length; i++) {
        if (!Array.isArray(points[i]) || points[i].length !== 2)
            throw new ModelError('invalid-curve', 'Invalid point');
        const [a, b] = points[i];
        finite(a);
        finite(b);
        if ((i && a <= points[i - 1][0]) || (logX && a <= 0) || (logY && b <= 0))
            throw new ModelError('invalid-curve', 'Curve coordinates must be ordered and logarithmic values positive');
    }
    if (logX && x <= 0)
        throw new ModelError('invalid-input', 'Logarithmic current must be positive');
    const extrapolated = x < points[0][0] || x > points.at(-1)[0];
    if (extrapolated && outside === 'reject')
        throw new ModelError('out-of-domain', 'Outside measured curve domain');
    if (extrapolated && outside === 'hold')
        return { value: x < points[0][0] ? points[0][1] : points.at(-1)[1], extrapolated };
    let j = 1;
    while (j < points.length - 1 && x > points[j][0])
        j++;
    const [a, c] = points[j - 1], [b, d] = points[j];
    const transformX = logX ? Math.log : (v) => v;
    const transformY = logY ? Math.log : (v) => v;
    const fraction = (transformX(x) - transformX(a)) / (transformX(b) - transformX(a));
    const y = transformY(c) + fraction * (transformY(d) - transformY(c));
    const value = logY ? Math.exp(y) : y;
    finite(value, 'interpolated value');
    return { value, extrapolated };
}
/** Bracket-preserving bisection. Does not turn a missing root into a valid boundary solution. */
export function bisect(fn, lo, hi, { xTolerance = 1e-12, fTolerance = 1e-10, iterations = 100 } = {}) {
    finite(lo);
    finite(hi);
    finite(xTolerance, 'xTolerance', Number.MIN_VALUE);
    finite(fTolerance, 'fTolerance', 0);
    finite(iterations, 'iterations', 1, 10000);
    if (lo > hi || !Number.isInteger(iterations))
        throw new ModelError('invalid-input', 'Invalid root bounds/options');
    let a = fn(lo), b = fn(hi);
    finite(a, 'residual');
    finite(b, 'residual');
    if (Math.abs(a) <= fTolerance)
        return { value: lo, residual: a, converged: true, iterations: 0 };
    if (Math.abs(b) <= fTolerance)
        return { value: hi, residual: b, converged: true, iterations: 0 };
    if (Math.sign(a) === Math.sign(b))
        throw new ModelError('no-bracket', '동작점이 계산 구간에서 닫히지 않습니다.');
    let x = lo, f = a;
    for (let i = 1; i <= iterations; i++) {
        x = lo + (hi - lo) / 2;
        f = fn(x);
        finite(f, 'residual');
        if (Math.abs(f) <= fTolerance || hi - lo <= xTolerance)
            return { value: x, residual: f, converged: true, iterations: i };
        if (Math.sign(f) === Math.sign(a)) {
            lo = x;
            a = f;
        }
        else {
            hi = x;
            b = f;
        }
    }
    return { value: x, residual: f, converged: false, iterations };
}
export const E24 = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
export const E96 = [1, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76];
export function standardResistor(target, series = 'E24+E96', strategy = 'closest') {
    finite(target, 'target resistance', 1e-6, 1e12);
    if (!['closest', 'safe', 'bright'].includes(strategy))
        throw new ModelError('invalid-input', 'Unknown selection strategy');
    const values = { E24, E96, 'E24+E96': unique([...E24, ...E96]).sort((a, b) => a - b) }[series];
    if (!values)
        throw new ModelError('invalid-input', 'Unknown E-series');
    const decade = Math.floor(Math.log10(target));
    const choices = [-1, 0, 1].flatMap(d => values.map(v => Number((v * 10 ** (decade + d)).toPrecision(12)))).sort((a, b) => a - b);
    const eps = target * 1e-12;
    const lower = choices.filter(v => v <= target + eps).at(-1);
    const upper = choices.find(v => v >= target - eps);
    if (strategy === 'safe')
        return upper;
    if (strategy === 'bright')
        return lower;
    return target - lower < upper - target ? lower : upper;
}
