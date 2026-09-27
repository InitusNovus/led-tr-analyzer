import { interpolate, clamp, finite } from './math.js';
import { LEDS, DEFAULT_MODEL_BY_FAMILY, getDeviceModel } from '../data/catalog.js';

const LEGACY_MODEL_ALIASES = Object.freeze({
    npn: DEFAULT_MODEL_BY_FAMILY.npn,
    pnp: DEFAULT_MODEL_BY_FAMILY.pnp,
    nmos: DEFAULT_MODEL_BY_FAMILY.nmos,
    pmos: DEFAULT_MODEL_BY_FAMILY.pmos,
    digital: DEFAULT_MODEL_BY_FAMILY['digital-npn'],
    gpio: DEFAULT_MODEL_BY_FAMILY.gpio,
});
function modelFor(ref, expectedFamily = null) {
    const id = LEGACY_MODEL_ALIASES[ref] ?? ref;
    const part = getDeviceModel(id);
    if (!part || (expectedFamily && part.family !== expectedFamily))
        throw new Error('Unknown/incompatible device model: ' + String(ref));
    return part;
}
export function context() { return { flags: new Set(), sources: new Set() }; }
export function sample(curve, x, ctx, label) {
    const r = interpolate(curve.points, x, { logX: curve.logX, logY: curve.logY });
    ctx?.sources.add(curve.source);
    if (r.extrapolated)
        ctx?.flags.add('extrapolation:' + label);
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
            if (Number.isFinite(part.vfTempCoefficient)) {
                v += part.vfTempCoefficient * (temperature - 25);
                ctx?.flags.add('approximation:LED-temperature-coefficient-at-other-current');
                if (Array.isArray(part.tempRange) && (temperature < part.tempRange[0] || temperature > part.tempRange[1]))
                    ctx?.flags.add('extrapolation:LED-temperature');
            }
            else {
                ctx?.flags.add('not-modeled:LED-temperature');
            }
        }
    }
    else if (part.vfTableOnly) {
        const t = part.vfTableOnly;
        v = t.nominalAssumption;
        ctx?.flags.add('approximation:LED-table-midpoint');
        if (!Number.isFinite(t.current))
            ctx?.flags.add('not-modeled:LED-vf-current-shape');
        else if (Math.abs(current - t.current) > Math.max(1e-9, t.current * .01))
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
    v += shift * Math.min(1, current / .001);
    if (v < 0)
        ctx?.flags.add('approximation:nonnegative-LED-voltage');
    return Math.max(0, v);
}
export function luminousIntensity(id, current, temperature = 25, ctx) {
    const part = LEDS[id];
    if (!part?.optical)
        return null;
    const o = part.optical;
    if (current === 0)
        return 0;
    if (!Number.isFinite(o.nominalMcd)) {
        ctx?.flags.add('not-modeled:LED-absolute-optical-anchor');
        return null;
    }
    if (!o.relative) {
        if (Number.isFinite(o.testCurrent) && Math.abs(current - o.testCurrent) <= Math.max(1e-9, o.testCurrent * .01) && temperature === 25)
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
export function gpioModel(config) {
    return modelFor(config.deviceModels?.GPIO1 ?? DEFAULT_MODEL_BY_FAMILY.gpio, 'gpio');
}
/** Signed current is positive out of the GPIO pin, negative into it. */
export function gpioVoltage(config, current, ctx) {
    finite(current, 'GPIO current');
    const part = gpioModel(config);
    ctx?.sources.add(part.source);
    if (part.modelKind === 'limit-derived-approximation')
        ctx?.flags.add('approximation:GPIO-limit-points-not-typical');
    const state = gpioState(config);
    if (state === 'HI_Z') {
        if (config.pull === 'none')
            return null;
        return (config.pull === 'up' ? config.vdd : 0) - current * config.pullResistance;
    }
    const drop = sample(part.drop, Math.abs(current), ctx, part.id + '-current');
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
export function bjtAt(modelRef, collector, voltage, temperature = 25, ctx) {
    finite(collector, 'collector current', 0);
    const part = modelFor(modelRef);
    if (!['npn','pnp'].includes(part.family))
        throw new Error('BJT model required');
    ctx?.sources.add(part.source);
    electricalTemperature(temperature, ctx);
    ctx?.flags.add('approximation:BJT-active-saturation-bridge');
    if (part.notes?.some(x => x.includes('Fig.8 uses IC/IB=20')))
        ctx?.flags.add('approximation:BJT-saturation-drive-ratio-mismatch');
    const c = Math.max(collector, 1e-12);
    const beta = Math.max(1, sample(part.gain, c, ctx, part.id + '-gain'));
    const vbeActive = Math.max(.05, sample(part.vbe, c, ctx, part.id + '-Vbe'));
    const vbeSat = Math.max(vbeActive, sample(part.vbeSat, c, ctx, part.id + '-VbeSat'));
    const vceSat = Math.max(.001, sample(part.vceSat, c, ctx, part.id + '-VceSat'));
    let gain, weight, region;
    if (voltage >= vbeActive) {
        gain = beta; weight = 0; region = 'active';
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
    return { modelId: part.modelId, collector, base: collector / gain, emitter: collector * (1 + 1 / gain),
        vbe: vbeActive + (vbeSat - vbeActive) * weight, voltage, region, forcedBeta: gain, gainAtTest: beta, vceSat };
}
export function digitalAt(a, b, c, d, e) {
    let modelRef, collector, voltage, config, ctx;
    if (typeof a === 'string') { modelRef = a; collector = b; voltage = c; config = d; ctx = e; }
    else { modelRef = DEFAULT_MODEL_BY_FAMILY['digital-npn']; collector = a; voltage = b; config = c; ctx = d; }
    const p = modelFor(modelRef, 'digital-npn'), current = Math.max(collector, 1e-12);
    ctx?.sources.add(p.source);
    electricalTemperature(config.temperature, ctx);
    ctx?.flags.add('approximation:DTC-terminal-bridge-and-internal-Vbe');
    const gi = Math.max(p.outputRatio, sample(p.gain, current, ctx, p.id + '-GI'));
    const on = Math.max(.001, sample(p.on, current, ctx, p.id + '-VO-on'));
    const vbe = clamp(.7 + .06 * Math.log10(current / .005), .1, 1.2);
    const weight = clamp((.7 - voltage) / Math.max(.001, .7 - on), 0, 1);
    const effective = voltage < on ? p.outputRatio * Math.max(voltage, 1e-9) / on
        : Math.exp(Math.log(gi) * (1 - weight) + Math.log(p.outputRatio) * weight);
    const nominalInput = collector / effective;
    const nominalShunt = vbe / (p.r1 * p.ratio);
    const base = Math.max(0, nominalInput - nominalShunt);
    const r1 = p.r1 * config.dtcR1Scale, r2 = r1 * config.dtcRatio;
    const input = base + vbe / r2;
    return { modelId: p.modelId, collector, base, input, emitter: collector + base, vbe, r1, r2,
        inputVoltage: vbe + input * r1, voltage, region: voltage < on ? 'saturated' : voltage < .7 ? 'transition' : 'active',
        externalRatio: input > 0 ? collector / input : null, forcedBeta: base > 0 ? collector / base : null };
}
export function mosCurrent(modelRef, voltage, gate, temperature = 25, ctx) {
    const part = modelFor(modelRef);
    if (!['nmos','pmos'].includes(part.family))
        throw new Error('MOSFET model required');
    ctx?.sources.add(part.source);
    electricalTemperature(temperature, ctx);
    if (voltage <= 0 || gate <= 0)
        return 0;
    const surfaces = part.output;
    const v = Math.max(0, voltage);
    const curveAt = s => {
        const r = interpolate(s.points, v);
        if (r.extrapolated)
            ctx?.flags.add('extrapolation:' + part.id + '-Vds');
        return Math.max(0, r.value);
    };
    if (gate < surfaces[0].gate) {
        ctx?.flags.add('approximation:' + part.id + '-weak-gate-shape');
        const t = sample(part.transfer, gate, ctx, part.id + '-transfer');
        return curveAt(surfaces[0]) * Math.max(0, t) / part.transfer.points.at(-1)[1];
    }
    let j = 1;
    while (j < surfaces.length - 1 && gate > surfaces[j].gate)
        j++;
    if (gate > surfaces.at(-1).gate)
        ctx?.flags.add('extrapolation:' + part.id + '-Vgs');
    const a = surfaces[j - 1], b = surfaces[j];
    return Math.max(0, curveAt(a) + (curveAt(b) - curveAt(a)) * (gate - a.gate) / (b.gate - a.gate));
}
