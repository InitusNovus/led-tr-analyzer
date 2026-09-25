import { interpolate, clamp, finite } from './math.js';
import { LEDS, BJTS, DIGITAL, MOSFETS, GPIO } from '../data/catalog.js';
export function context() { return { flags: new Set(), sources: new Set() }; }
export function sample(curve, x, ctx, label) {
    const r = interpolate(curve.points, x, { logX: curve.logX, logY: curve.logY });
    ctx?.sources.add(curve.source);
    if (r.extrapolated)
        ctx?.flags.add(`extrapolation:${label}`);
    return r.value;
}
export function ledVoltage(id, current, temperature = 25, shift = 0, ctx) {
    finite(current, 'LED current', 0);
    const part = LEDS[id];
    if (!part)
        throw new Error('Unknown LED');
    ctx?.sources.add(part.source);
    if (part.kind === 'legacy-unverified')
        ctx?.flags.add('legacy-led-unverified');
    if (current === 0)
        return 0;
    let v;
    if (part.vf) {
        // Logarithmic low-current continuation matches the first two positive curve anchors.
        // This is extrapolation, not a datasheet leakage or low-current optical model.
        if (current < part.vf.domain[0]) {
            const [[i1, v1], [i2, v2]] = part.vf.points;
            const slope = (v2 - v1) / Math.log(i2 / i1);
            const scale = i1 / Math.expm1(v1 / slope);
            v = slope * Math.log1p(current / scale);
            ctx?.flags.add('extrapolation:LED-low-current-tail');
        }
        else
            v = sample(part.vf, current, ctx, 'LED-Vf');
        if (temperature !== 25) {
            v += part.vfTempCoefficient * (temperature - 25);
            ctx?.flags.add('approximation:LED-temperature-coefficient-at-other-current');
            if (temperature < part.tempRange[0] || temperature > part.tempRange[1])
                ctx?.flags.add('extrapolation:LED-temperature');
        }
    }
    else if (part.vfTableOnly) {
        const t = part.vfTableOnly;
        v = t.nominalAssumption;
        ctx?.flags.add('approximation:LED-table-midpoint');
        if (Math.abs(current - t.current) > Math.max(1e-9, t.current * .01))
            ctx?.flags.add('extrapolation:LED-table-only-current');
        if (temperature !== 25)
            ctx?.flags.add('not-modeled:LED-temperature');
    }
    else {
        const { intercept, resistance, domain } = part.linear;
        v = current < domain[0] ? (intercept + resistance * domain[0]) * current / domain[0] : intercept + resistance * current;
        if (current < domain[0] || current > domain[1])
            ctx?.flags.add('extrapolation:legacy-LED');
        if (temperature !== 25)
            ctx?.flags.add('not-modeled:LED-temperature');
    }
    // Shift is user-specified sensitivity, NOT a manufactured Vf min/max curve.
    v += shift * Math.min(1, current / .001);
    if (v < 0)
        ctx?.flags.add('approximation:nonnegative-LED-voltage');
    return Math.max(0, v);
}
export function luminousIntensity(id, current, temperature = 25, ctx) {
    const part = LEDS[id];
    if (!part.optical)
        return null;
    const o = part.optical;
    if (current === 0)
        return 0;
    if (!Number.isFinite(o.nominalMcd)) {
        ctx?.flags.add('not-modeled:LED-absolute-optical-anchor');
        return null;
    }
    if (!o.relative) {
        if (Math.abs(current - o.testCurrent) <= Math.max(1e-9, o.testCurrent * .01) && temperature === 25)
            return o.nominalMcd;
        ctx?.flags.add('not-modeled:LED-optical-current-shape');
        return null;
    }
    let relative = sample(o.relative, current, ctx, 'LED-optical-current');
    if (temperature !== 25) {
        if (!o.temperature) {
            ctx?.flags.add('not-modeled:LED-optical-temperature');
            return null;
        }
        relative *= sample(o.temperature, temperature, ctx, 'LED-optical-temperature');
        ctx?.flags.add('approximation:optical-temperature-separable');
    }
    return Math.max(0, o.nominalMcd * relative);
}
export function gpioState(config) {
    return config.gpioMode === 'open-drain' && config.state === 'HIGH' ? 'HI_Z' : config.state;
}
/** Signed current is positive out of the GPIO pin, negative into it. */
export function gpioVoltage(config, current, ctx) {
    finite(current, 'GPIO current');
    ctx?.sources.add('gpio');
    ctx?.flags.add('approximation:GPIO-limit-points-not-typical');
    const state = gpioState(config);
    if (state === 'HI_Z') {
        if (config.pull === 'none')
            return null;
        return (config.pull === 'up' ? config.vdd : 0) - current * config.pullResistance;
    }
    const drop = sample(GPIO.drop, Math.abs(current), ctx, 'GPIO-current');
    if (state === 'HIGH')
        return config.vdd - Math.sign(current) * drop;
    return -Math.sign(current) * drop;
}
export function driveHigh(config) {
    const s = gpioState(config);
    return s === 'HIGH' || (s === 'HI_Z' && config.pull === 'up');
}
export function driveLow(config) {
    const s = gpioState(config);
    return s === 'LOW' || (s === 'HI_Z' && config.pull === 'down');
}
function electricalTemperature(temperature, ctx) {
    if (temperature !== 25)
        ctx?.flags.add('not-modeled:transistor-electrical-temperature');
}
/** Required base current for a specified (IC,VCE) point, positive magnitudes.
 * The bridge joins published active gain and a fixed-ratio saturation curve.
 * It is intentionally identified as an approximation, not a full BJT model. */
export function bjtAt(partKey, collector, voltage, temperature = 25, ctx) {
    finite(collector, 'collector current', 0);
    const part = BJTS[partKey];
    ctx?.sources.add(part.source);
    electricalTemperature(temperature, ctx);
    ctx?.flags.add('approximation:BJT-active-saturation-bridge');
    const c = Math.max(collector, 1e-12);
    const beta = Math.max(1, sample(part.gain, c, ctx, `${part.id}-gain`));
    const vbeActive = Math.max(.05, sample(part.vbe, c, ctx, `${part.id}-Vbe`));
    const vbeSat = Math.max(vbeActive, sample(part.vbeSat, c, ctx, `${part.id}-VbeSat`));
    const vceSat = Math.max(.001, sample(part.vceSat, c, ctx, `${part.id}-VceSat`));
    let gain, weight, region;
    if (voltage >= vbeActive) {
        gain = beta;
        weight = 0;
        region = 'active';
    }
    else if (voltage >= vceSat) {
        weight = clamp((vbeActive - voltage) / Math.max(.001, vbeActive - vceSat), 0, 1);
        gain = Math.exp(Math.log(beta) * (1 - weight) + Math.log(part.ratio) * weight);
        region = 'transition';
    }
    else {
        weight = 1;
        gain = part.ratio * Math.max(voltage, 1e-9) / vceSat;
        region = 'saturated';
        ctx?.flags.add('approximation:BJT-strong-base-drive');
    }
    return { collector, base: collector / gain, emitter: collector * (1 + 1 / gain),
        vbe: vbeActive + (vbeSat - vbeActive) * weight, voltage, region, forcedBeta: gain, gainAtTest: beta, vceSat };
}
/** External-terminal model. GI is IO/II; the internal base current is a separate KCL quantity. */
export function digitalAt(collector, voltage, config, ctx) {
    const p = DIGITAL, c = Math.max(collector, 1e-12);
    ctx?.sources.add(p.source);
    electricalTemperature(config.temperature, ctx);
    ctx?.flags.add('approximation:DTC-terminal-bridge-and-internal-Vbe');
    const gi = Math.max(p.outputRatio, sample(p.gain, c, ctx, 'DTC-GI'));
    const on = Math.max(.001, sample(p.on, c, ctx, 'DTC-VO-on'));
    const vbe = clamp(.7 + .06 * Math.log10(c / .005), .1, 1.2); // explicitly assumed, not a ROHM curve
    const weight = clamp((.7 - voltage) / Math.max(.001, .7 - on), 0, 1);
    const effective = voltage < on ? p.outputRatio * Math.max(voltage, 1e-9) / on
        : Math.exp(Math.log(gi) * (1 - weight) + Math.log(p.outputRatio) * weight);
    const nominalInput = collector / effective;
    const nominalShunt = vbe / (p.r1 * p.ratio);
    // The measured terminal gain already includes nominal shunt current. Do not add it twice.
    const base = Math.max(0, nominalInput - nominalShunt);
    const r1 = p.r1 * config.dtcR1Scale, r2 = r1 * config.dtcRatio;
    const input = base + vbe / r2;
    return { collector, base, input, emitter: collector + base, vbe, r1, r2,
        inputVoltage: vbe + input * r1, voltage, region: voltage < on ? 'saturated' : voltage < .7 ? 'transition' : 'active',
        externalRatio: input > 0 ? collector / input : null, forcedBeta: base > 0 ? collector / base : null };
}
/** Output-curve interpolation in positive magnitudes. No Id absolute-rating clamp. */
export function mosCurrent(key, voltage, gate, temperature = 25, ctx) {
    const part = MOSFETS[key];
    ctx?.sources.add(part.source);
    electricalTemperature(temperature, ctx);
    if (voltage <= 0 || gate <= 0)
        return 0;
    const surfaces = part.output;
    let v = Math.max(0, voltage);
    const curveAt = (s) => {
        const r = interpolate(s.points, v);
        if (r.extrapolated)
            ctx?.flags.add(`extrapolation:${part.id}-Vds`);
        return Math.max(0, r.value);
    };
    if (gate < surfaces[0].gate) {
        ctx?.flags.add(`approximation:${part.id}-weak-gate-shape`);
        const t = sample(part.transfer, gate, ctx, `${part.id}-transfer`);
        return curveAt(surfaces[0]) * Math.max(0, t) / part.transfer.points.at(-1)[1];
    }
    let j = 1;
    while (j < surfaces.length - 1 && gate > surfaces[j].gate)
        j++;
    if (gate > surfaces.at(-1).gate)
        ctx?.flags.add(`extrapolation:${part.id}-Vgs`);
    const a = surfaces[j - 1], b = surfaces[j];
    return Math.max(0, curveAt(a) + (curveAt(b) - curveAt(a)) * (gate - a.gate) / (b.gate - a.gate));
}
