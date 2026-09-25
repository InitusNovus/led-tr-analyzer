import { ModelError, finite, bisect } from './math.js';
import { context, ledVoltage, luminousIntensity, gpioVoltage, gpioState, driveHigh, driveLow, bjtAt, digitalAt, mosCurrent } from './devices.js';
import { LEDS, BJTS, DIGITAL, MOSFETS, GPIO } from '../data/catalog.js';
export const TOPOLOGIES = [
    { id: 'resistor', name: '저항 직결', family: '기준 회로', path: 'VLED → RLED → LED → GND', active: 'always' },
    { id: 'gpio-source', name: 'GPIO Source', family: 'GPIO', path: 'GPIO → RLED → LED → GND', active: 'HIGH' },
    { id: 'gpio-sink', name: 'GPIO Sink / Open-drain', family: 'GPIO', path: 'VLED → RLED → LED → GPIO', active: 'LOW' },
    { id: 'digital-npn', name: '디지털 NPN 로우사이드', family: 'BJT', path: 'VLED → RLED → LED → DTC043ZEB → GND', active: 'HIGH' },
    { id: 'npn-low', name: '일반 NPN 로우사이드', family: 'BJT', path: 'VLED → RLED → LED → NPN(C–E) → GND', active: 'HIGH' },
    { id: 'npn-follower', name: 'NPN 에미터 팔로워', family: 'BJT', path: 'VLED → NPN(C–E) → RLED → LED → GND', active: 'HIGH' },
    { id: 'npn-current-sink', name: 'NPN 에미터 저항 전류 싱크', family: 'BJT', path: 'VLED → RLED → LED → NPN(C–E) → RE → GND', active: 'HIGH' },
    { id: 'nmos-low', name: 'NMOS 로우사이드', family: 'MOSFET', path: 'VLED → RLED → LED → NMOS(D–S) → GND', active: 'HIGH' },
    { id: 'pnp-high', name: 'PNP 하이사이드 (직접)', family: 'High-side', path: 'VLED → PNP(E–C) → RLED → LED → GND', active: 'LOW' },
    { id: 'pmos-high', name: 'PMOS 하이사이드 (직접)', family: 'High-side', path: 'VLED → PMOS(S–D) → RLED → LED → GND', active: 'LOW' },
    { id: 'npn-pnp', name: 'NPN → PNP 레벨 시프트', family: 'High-side', path: 'VLED → PNP(E–C) → RLED → LED → GND; NPN 베이스 구동', active: 'HIGH' },
    { id: 'npn-pmos', name: 'NPN → PMOS 레벨 시프트', family: 'High-side', path: 'VLED → PMOS(S–D) → RLED → LED → GND; NPN 게이트 구동', active: 'HIGH' },
    { id: 'nmos-pmos', name: 'NMOS → PMOS 레벨 시프트', family: 'High-side', path: 'VLED → PMOS(S–D) → RLED → LED → GND; NMOS 게이트 구동', active: 'HIGH' },
];
export const DEFAULT_CONFIG = Object.freeze({
    topology: 'digital-npn', led: 'APT2012SURCK', vcc: 5, vdd: 3.3, resistance: 330,
    baseResistance: 4700, emitterResistance: 220, gateResistance: 1000, pullResistance: 40000, gatePull: 100000,
    state: 'HIGH', gpioMode: 'push-pull', pull: 'none', temperature: 25, ambient: 25, seriesCount: 1,
    vfShift: 0, dtcR1Scale: 1, dtcRatio: 10, vccTolerance: 5, vddTolerance: 3, resistorTolerance: 1, vfSpread: .1,
    resistorRating: .125, auxRating: .1, derating: .7, otherSourceCurrent: 0, otherSinkCurrent: 0,
});
export function normalizeConfig(input = {}) {
    const c = { ...DEFAULT_CONFIG, ...input };
    if (!TOPOLOGIES.some(t => t.id === c.topology) || !LEDS[c.led])
        throw new ModelError('invalid-input', '회로/LED 선택이 유효하지 않습니다.');
    for (const [key, min, max] of [
        ['vcc', 0, 60], ['vdd', 0, 5.5], ['resistance', .001, 1e7], ['baseResistance', 1, 1e7], ['emitterResistance', .001, 1e7],
        ['gateResistance', 1, 1e7], ['pullResistance', 1, 1e8], ['gatePull', 1, 1e8], ['temperature', -40, 125], ['ambient', -40, 125],
        ['seriesCount', 1, 12], ['vfShift', -.5, .5], ['dtcR1Scale', .7, 1.3], ['dtcRatio', 8, 12],
        ['vccTolerance', 0, 30], ['vddTolerance', 0, 30], ['resistorTolerance', 0, 30], ['vfSpread', 0, .5],
        ['resistorRating', .001, 10], ['auxRating', .001, 10], ['derating', .01, 1], ['otherSourceCurrent', 0, 1], ['otherSinkCurrent', 0, 1],
    ])
        finite(c[key], key, min, max);
    if (!Number.isInteger(c.seriesCount))
        throw new ModelError('invalid-input', 'LED 개수는 정수여야 합니다.');
    for (const [key, allowed] of [['state', ['HIGH', 'LOW', 'HI_Z']], ['gpioMode', ['push-pull', 'open-drain']], ['pull', ['none', 'up', 'down']]])
        if (!allowed.includes(c[key]))
            throw new ModelError('invalid-input', `${key} 설정이 유효하지 않습니다.`);
    return c;
}
const power = (id, current, voltage, kind = 'resistor') => ({ id, current, voltage, power: current * voltage, kind });
const resistor = (id, current, resistance) => ({ ...power(id, current, current * resistance), resistance });
const source = (id, current, voltage) => ({ id, current, voltage, power: current * voltage });
const qPower = (id, q, partKey = 'npn') => ({ id, kind: 'bjt', partKey, current: q.collector, base: q.base, voltage: q.voltage, vbe: q.vbe,
    power: q.collector * q.voltage + q.base * q.vbe, region: q.region });
const mosPower = (id, current, voltage, gate, partKey) => ({ ...power(id, current, voltage, 'mosfet'), gate, partKey, region: Math.abs(gate) < MOSFETS[partKey].output[0].gate ? 'weak-drive' : 'conducting' });
const finishRoot = (fn, lo, hi, maxResidual = 1e-7) => {
    const r = bisect(fn, lo, hi, { fTolerance: 1e-11, xTolerance: 1e-24, iterations: 110 });
    if (Math.abs(r.residual) > maxResidual)
        throw new ModelError('nonconvergence', '동작점 잔차가 허용오차를 넘었습니다. 이 조건은 계산 결과를 보증하지 못합니다.');
    return { ...r, converged: true, residualTolerance: maxResidual };
};
function passiveLimit(c, voltage = c.vcc) {
    if (voltage <= 0)
        return 0;
    return finishRoot(i => ledVoltage(c.led, i, c.temperature, c.vfShift) * c.seriesCount + i * c.resistance - voltage, 0, voltage / c.resistance).value;
}
function baseResult(c, ctx) {
    return { config: c, current: 0, ledVf: 0, loadVoltage: 0, driverVoltage: null, gpioVoltage: null, gpioCurrent: 0,
        baseCurrent: null, emitterCurrent: null, externalInputCurrent: null, forcedBeta: null, region: 'off',
        ledger: [], semiconductors: [], sources: [], solver: { converged: true, residual: 0, iterations: 0 }, ctx };
}
function finalize(r) {
    const { config: c, ctx } = r;
    r.ledVf = ledVoltage(c.led, r.current, c.temperature, c.vfShift, ctx);
    r.loadVoltage = r.ledVf * c.seriesCount + r.current * c.resistance;
    r.luminousMcd = luminousIntensity(c.led, r.current, c.temperature, ctx); // per LED, not incorrectly summed angular intensity
    r.ledger.unshift(resistor('RLED', r.current, c.resistance), power('LED string', r.current, r.ledVf * c.seriesCount, 'led'));
    r.resistorPower = r.current * r.current * c.resistance;
    r.driverPower = r.semiconductors.reduce((sum, q) => sum + q.power, 0);
    r.inputPower = r.sources.reduce((sum, s) => sum + s.power, 0);
    r.dissipatedPower = r.ledger.reduce((sum, p) => sum + p.power, 0);
    r.powerResidual = r.inputPower - r.dissipatedPower;
    if (r.region === 'off')
        ctx.flags.add('not-modeled:off-leakage');
    ctx.flags.add('not-modeled:self-heating-feedback');
    r.flags = [...ctx.flags];
    r.provenance = [...ctx.sources];
    delete r.ctx;
    for (const key of ['current', 'ledVf', 'resistorPower', 'driverPower', 'powerResidual'])
        finite(r[key], key);
    const balanceTolerance = 2e-8 + 1e-6 * Math.abs(r.inputPower);
    if (r.current < 0 || Math.abs(r.powerResidual) > balanceTolerance ||
        [...r.ledger, ...r.sources].some(e => !Number.isFinite(e.power) || e.power < -1e-10) ||
        r.semiconductors.some(q => q.voltage < -1e-8))
        throw new ModelError('inconsistent-point', '전력 수지/소자 방향 조건이 맞지 않습니다. 저전압·역방향·곡선 외삽 범위의 모델을 확인하세요.');
    return r;
}
function off(c, ctx, devices = []) {
    if (c.topology !== 'resistor')
        ctx.sources.add('gpio');
    for (const d of devices)
        ctx.sources.add(d.partKey === 'digital' ? 'dtc' : d.partKey);
    const r = baseResult(c, ctx);
    r.semiconductors = devices;
    r.driverVoltage = c.vcc;
    r.gpioVoltage = gpioState(c) === 'HI_Z' ? null : gpioState(c) === 'HIGH' ? c.vdd : 0;
    return finalize(r);
}
const offQ = (key, c) => ({ id: `${key} (OFF bound)`, partKey: key, kind: key === 'digital' ? 'digital' : key.includes('mos') ? 'mosfet' : 'bjt', current: 0, power: 0, voltage: c.vcc, voltageIsBound: true, region: 'off', gate: 0 });
function gpioDirect(c, ctx, sink) {
    if (sink && !driveLow(c)) {
        if (c.vcc > c.vdd + .05)
            throw new ModelError('unsupported', '외부 LED 전원이 높은 GPIO의 OFF/Hi-Z: injection/5V-tolerance 모델이 없습니다.');
        return off(c, ctx);
    }
    if (!sink && !driveHigh(c))
        return off(c, ctx);
    const max = passiveLimit(c, sink ? c.vcc : c.vdd), sgn = sink ? -1 : 1;
    const eq = i => (sink ? c.vcc - gpioVoltage(c, -i) : gpioVoltage(c, i)) - ledVoltage(c.led, i, c.temperature, c.vfShift) * c.seriesCount - i * c.resistance;
    const r = baseResult(c, ctx);
    r.solver = finishRoot(eq, 0, max);
    r.current = r.solver.value;
    r.gpioCurrent = sgn * r.current;
    r.gpioVoltage = gpioVoltage(c, r.gpioCurrent, ctx);
    r.driverVoltage = sink ? r.gpioVoltage : c.vdd - r.gpioVoltage;
    r.region = r.current > 1e-12 ? 'conducting' : 'off';
    if (sink) {
        r.sources = [source('VLED', r.current, c.vcc)];
        r.ledger.push(power('GPIO sink', r.current, r.gpioVoltage, 'gpio'));
    }
    else
        r.sources = [source('GPIO pin', r.current, r.gpioVoltage)];
    return finalize(r);
}
function npnLow(c, ctx, digital = false) {
    if (!driveHigh(c))
        return off(c, ctx, [offQ(digital ? 'digital' : 'npn', c)]);
    const qAt = (i, trace) => {
        const v = c.vcc - ledVoltage(c.led, i, c.temperature, c.vfShift) * c.seriesCount - i * c.resistance;
        return digital ? digitalAt(i, v, c, trace) : bjtAt('npn', i, v, c.temperature, trace);
    };
    const equation = i => { const q = qAt(i); return digital ? gpioVoltage(c, q.input) - q.inputVoltage : gpioVoltage(c, q.base) - q.base * c.baseResistance - q.vbe; };
    if (equation(0) <= 0)
        return off(c, ctx, [offQ(digital ? 'digital' : 'npn', c)]);
    const r = baseResult(c, ctx);
    r.solver = finishRoot(equation, 0, passiveLimit(c));
    r.current = r.solver.value;
    const q = qAt(r.current, ctx);
    r.region = q.region;
    r.driverVoltage = q.voltage;
    r.baseCurrent = q.base;
    r.emitterCurrent = q.emitter;
    r.forcedBeta = q.forcedBeta;
    r.gpioCurrent = digital ? q.input : q.base;
    r.gpioVoltage = gpioVoltage(c, r.gpioCurrent, ctx);
    r.sources = [source('VLED', r.current, c.vcc), source('GPIO pin', r.gpioCurrent, r.gpioVoltage)];
    if (digital) {
        r.externalInputCurrent = q.input;
        r.externalRatio = q.externalRatio;
        const die = power('Q1 die', q.collector, q.voltage, 'bjt');
        die.power += q.base * q.vbe;
        r.ledger.push(die, resistor('R1 internal', q.input, q.r1), resistor('R2 internal', q.vbe / q.r2, q.r2));
        r.semiconductors.push({ id: 'DTC043ZEB package', partKey: 'digital', kind: 'digital', current: q.collector, voltage: q.voltage, inputVoltage: q.inputVoltage,
            power: die.power + q.input ** 2 * q.r1 + q.vbe ** 2 / q.r2, region: q.region });
    }
    else {
        const qp = qPower('Q1', q);
        r.semiconductors.push(qp);
        r.ledger.push(qp, resistor('RB', q.base, c.baseResistance));
    }
    return finalize(r);
}
/** Follower and emitter-resistor sink share KCL IE=IC+IB, but their LED currents differ. */
function emitterStage(c, ctx, currentSink) {
    if (!driveHigh(c))
        return off(c, ctx, [offQ('npn', c)]);
    const solveAtEmitter = (ie, trace) => {
        const qAt = ic => {
            const ve = currentSink ? ie * c.emitterResistance : ledVoltage(c.led, ie, c.temperature, c.vfShift) * c.seriesCount + ie * c.resistance;
            const vc = currentSink ? c.vcc - ledVoltage(c.led, ic, c.temperature, c.vfShift) * c.seriesCount - ic * c.resistance : c.vcc;
            return { ...bjtAt('npn', ic, vc - ve, c.temperature), ve, vc };
        };
        const ic = ie === 0 ? 0 : finishRoot(ic => qAt(ic).emitter - ie, 0, ie, 1e-11).value;
        const q = qAt(ic);
        if (trace) {
            bjtAt('npn', ic, q.voltage, c.temperature, trace);
        }
        return { ...q, emitter: ie };
    };
    const equation = ie => { const q = solveAtEmitter(ie); return gpioVoltage(c, q.base) - q.base * c.baseResistance - q.ve - q.vbe; };
    if (equation(0) <= 0)
        return off(c, ctx, [offQ('npn', c)]);
    const hi = currentSink ? c.vcc / c.emitterResistance : passiveLimit(c);
    const r = baseResult(c, ctx);
    r.solver = finishRoot(equation, 0, hi);
    const q = solveAtEmitter(r.solver.value, ctx);
    r.current = currentSink ? q.collector : q.emitter;
    r.baseCurrent = q.base;
    r.emitterCurrent = q.emitter;
    r.driverVoltage = q.voltage;
    r.forcedBeta = q.forcedBeta;
    r.gpioCurrent = q.base;
    r.gpioVoltage = gpioVoltage(c, q.base, ctx);
    r.region = q.region;
    r.nodes = { base: q.ve + q.vbe, emitter: q.ve, collector: q.vc };
    const qp = qPower('Q1', q);
    r.semiconductors.push(qp);
    r.ledger.push(qp, resistor('RB', q.base, c.baseResistance));
    if (currentSink)
        r.ledger.push(resistor('RE', q.emitter, c.emitterResistance));
    r.sources = [source('VLED', q.collector, c.vcc), source('GPIO pin', q.base, r.gpioVoltage)];
    return finalize(r);
}
function pnpHigh(c, ctx, levelShift = false) {
    if (levelShift && !driveHigh(c))
        return off(c, ctx, [offQ('pnp', c), offQ('npn', c)]);
    if (!levelShift && !driveLow(c)) {
        if (Math.abs(c.vcc - c.vdd) > .05)
            throw new ModelError('unsupported', '직접 PNP의 서로 다른 전원 HIGH/Hi-Z는 GPIO injection/reverse-BE 모델이 필요합니다.');
        return off(c, ctx, [offQ('pnp', c)]);
    }
    const get = i => {
        const v = c.vcc - ledVoltage(c.led, i, c.temperature, c.vfShift) * c.seriesCount - i * c.resistance;
        const q = bjtAt('pnp', i, v, c.temperature);
        if (!levelShift)
            return { q, ib: q.base };
        const shunt = q.vbe / c.gatePull, j = q.base + shunt;
        const q1 = bjtAt('npn', j, c.vcc - q.vbe - j * c.gateResistance, c.temperature);
        return { q, q1, j, shunt, ib: q1.base };
    };
    const equation = i => {
        const a = get(i);
        return levelShift ? gpioVoltage(c, a.ib) - a.ib * c.baseResistance - a.q1.vbe
            : c.vcc - a.q.vbe - a.ib * c.baseResistance - gpioVoltage(c, -a.ib);
    };
    if (equation(0) <= 0)
        return off(c, ctx, [offQ('pnp', c)]);
    const r = baseResult(c, ctx);
    r.solver = finishRoot(equation, 0, passiveLimit(c));
    r.current = r.solver.value;
    const a = get(r.current), q = a.q;
    bjtAt('pnp', q.collector, q.voltage, c.temperature, ctx);
    r.driverVoltage = q.voltage;
    r.baseCurrent = q.base;
    r.emitterCurrent = q.emitter;
    r.forcedBeta = q.forcedBeta;
    r.region = q.region;
    r.gpioCurrent = levelShift ? a.ib : -a.ib;
    r.gpioVoltage = gpioVoltage(c, r.gpioCurrent, ctx);
    const qp = qPower('Q2 PNP', q, 'pnp');
    r.semiconductors.push(qp);
    r.ledger.push(qp);
    if (levelShift) {
        bjtAt('npn', a.j, a.q1.voltage, c.temperature, ctx);
        const q1 = qPower('Q1 NPN', a.q1);
        r.semiconductors.push(q1);
        r.ledger.push(q1, resistor('RB', a.ib, c.baseResistance), resistor('Rdrive', a.j, c.gateResistance), resistor('RBE pull-up', a.shunt, c.gatePull));
        r.sources = [source('VLED', r.current + a.j, c.vcc), source('GPIO pin', a.ib, r.gpioVoltage)];
    }
    else {
        r.ledger.push(resistor('RB', a.ib, c.baseResistance), power('GPIO sink', a.ib, r.gpioVoltage, 'gpio'));
        r.sources = [source('VLED', q.emitter, c.vcc)];
        if (Math.abs(c.vcc - c.vdd) > .05)
            ctx.flags.add('not-verified:direct-high-side-OFF-domain');
    }
    return finalize(r);
}
/** A gate-to-source pull is part of each MOS template. Its DC load is not discarded. */
function directNmosBias(c, ctx) {
    if (!driveHigh(c))
        return { gate: 0, current: 0, pin: gpioVoltage(c, 0, ctx), ledger: [], sources: [], semiconductors: [] };
    const current = finishRoot(i => gpioVoltage(c, i) - i * (c.gateResistance + c.gatePull), 0, c.vdd / (c.gateResistance + c.gatePull)).value;
    const pin = gpioVoltage(c, current, ctx), gate = current * c.gatePull;
    return { gate, current, pin, ledger: [resistor('RG', current, c.gateResistance), resistor('RGS pull-down', current, c.gatePull)], sources: [source('GPIO pin', current, pin)], semiconductors: [] };
}
function pmosBias(c, ctx, kind) {
    if (kind === 'direct') {
        if (!driveLow(c)) {
            if (Math.abs(c.vcc - c.vdd) > .05)
                throw new ModelError('unsupported', '직접 PMOS의 HIGH/Hi-Z 전압 도메인이 다릅니다. injection 모델 없이 OFF를 보증하지 않습니다.');
            return { gate: 0, current: 0, pin: gpioVoltage(c, 0, ctx), ledger: [], sources: [], semiconductors: [] };
        }
        const j = finishRoot(i => c.vcc - i * (c.gatePull + c.gateResistance) - gpioVoltage(c, -i), 0, c.vcc / (c.gatePull + c.gateResistance)).value;
        const pin = gpioVoltage(c, -j, ctx);
        if (Math.abs(c.vcc - c.vdd) > .05)
            ctx.flags.add('not-verified:direct-high-side-OFF-domain');
        return { gate: j * c.gatePull, current: -j, pin, ledger: [resistor('RGS pull-up', j, c.gatePull), resistor('RG', j, c.gateResistance), power('GPIO sink', j, pin, 'gpio')], sources: [source('VLED bias', j, c.vcc)], semiconductors: [] };
    }
    if (!driveHigh(c))
        return { gate: 0, current: 0, pin: gpioVoltage(c, 0, ctx), ledger: [], sources: [], semiconductors: [offQ(kind === 'npn' ? 'npn' : 'nmos', c)] };
    const total = c.gatePull + c.gateResistance;
    if (kind === 'npn') {
        const qAt = j => bjtAt('npn', j, c.vcc - j * total, c.temperature);
        const j = finishRoot(j => { const q = qAt(j); return gpioVoltage(c, q.base) - q.base * c.baseResistance - q.vbe; }, 0, c.vcc / total).value;
        const q = bjtAt('npn', j, c.vcc - j * total, c.temperature, ctx), pin = gpioVoltage(c, q.base, ctx), qp = qPower('Q1 NPN', q);
        return { gate: j * c.gatePull, current: q.base, pin, ledger: [qp, resistor('RB', q.base, c.baseResistance), resistor('RG', j, c.gateResistance), resistor('RGS pull-up', j, c.gatePull)],
            sources: [source('VLED bias', j, c.vcc), source('GPIO pin', q.base, pin)], semiconductors: [qp] };
    }
    const bias = directNmosBias(c, ctx);
    const j = finishRoot(j => mosCurrent('nmos', c.vcc - j * total, bias.gate, c.temperature) - j, 0, c.vcc / total, 1e-11).value;
    const voltage = c.vcc - j * total;
    mosCurrent('nmos', voltage, bias.gate, c.temperature, ctx);
    const qp = mosPower('Q1 NMOS', j, voltage, bias.gate, 'nmos');
    return { gate: j * c.gatePull, current: bias.current, pin: bias.pin,
        ledger: [...bias.ledger, qp, resistor('Rdrive', j, c.gateResistance), resistor('RGS high-side', j, c.gatePull)],
        sources: [...bias.sources, source('VLED bias', j, c.vcc)], semiconductors: [qp] };
}
function mosStage(c, ctx, highSide, kind = 'direct') {
    const key = highSide ? 'pmos' : 'nmos', bias = highSide ? pmosBias(c, ctx, kind) : directNmosBias(c, ctx);
    const r = baseResult(c, ctx);
    r.ledger.push(...bias.ledger);
    r.sources.push(...bias.sources);
    r.semiconductors.push(...bias.semiconductors);
    r.gpioCurrent = bias.current;
    r.gpioVoltage = bias.pin;
    r.gateVoltage = highSide ? -bias.gate : bias.gate;
    const getVoltage = i => c.vcc - ledVoltage(c.led, i, c.temperature, c.vfShift) * c.seriesCount - i * c.resistance;
    const max = passiveLimit(c);
    r.solver = finishRoot(i => mosCurrent(key, getVoltage(i), bias.gate, c.temperature) - i, 0, max, 1e-11);
    r.current = r.solver.value;
    r.driverVoltage = getVoltage(r.current);
    mosCurrent(key, r.driverVoltage, bias.gate, c.temperature, ctx);
    const qp = mosPower(highSide ? 'Q2 PMOS' : 'Q1 NMOS', r.current, r.driverVoltage, bias.gate, key);
    r.region = r.current < 1e-12 ? 'off' : qp.region;
    qp.region = r.region;
    r.semiconductors.push(qp);
    r.ledger.push(qp);
    r.sources.push(source('VLED load', r.current, c.vcc));
    return finalize(r);
}
export function solvePoint(input) {
    const c = normalizeConfig(input), ctx = context();
    if (gpioState(c) === 'HI_Z' && c.pull === 'none' && ['npn-low', 'npn-follower', 'npn-current-sink', 'pnp-high', 'npn-pnp', 'npn-pmos'].includes(c.topology))
        throw new ModelError('unsupported', '베이스가 부유합니다. 이 회로에는 베이스 풀 저항이 없으므로 Hi-Z를 OFF로 가정하지 않습니다. GPIO pull을 지정하세요.');
    if (c.topology !== 'resistor' && (c.vdd < GPIO.voltageRange[0] || c.vdd > GPIO.voltageRange[1]))
        throw new ModelError('unsupported', '이 GPIO 모델은 VDD=2.7…3.6V만 지원합니다. 무전원/다른 MCU 특성은 추정하지 않습니다.');
    if (c.vcc === 0 && c.topology !== 'gpio-source' && c.topology !== 'resistor')
        throw new ModelError('unsupported', 'VLED=0에서의 역급전/접합 전류는 이 모델 범위 밖입니다.');
    switch (c.topology) {
        case 'resistor': {
            const r = baseResult(c, ctx);
            r.current = passiveLimit(c);
            r.region = r.current > 0 ? 'conducting' : 'off';
            r.sources = [source('VLED', r.current, c.vcc)];
            return finalize(r);
        }
        case 'gpio-source': return gpioDirect(c, ctx, false);
        case 'gpio-sink': return gpioDirect(c, ctx, true);
        case 'digital-npn': return npnLow(c, ctx, true);
        case 'npn-low': return npnLow(c, ctx, false);
        case 'npn-follower': return emitterStage(c, ctx, false);
        case 'npn-current-sink': return emitterStage(c, ctx, true);
        case 'nmos-low': return mosStage(c, ctx, false);
        case 'pnp-high': return pnpHigh(c, ctx, false);
        case 'pmos-high': return mosStage(c, ctx, true);
        case 'npn-pnp': return pnpHigh(c, ctx, true);
        case 'npn-pmos': return mosStage(c, ctx, true, 'npn');
        case 'nmos-pmos': return mosStage(c, ctx, true, 'nmos');
        default: throw new ModelError('invalid-input', 'Unknown topology');
    }
}
