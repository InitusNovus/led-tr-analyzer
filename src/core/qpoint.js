import { topologyById } from './topologies.js';
import { getDeviceModel } from '../data/catalog.js';

/**
 * Operating-point voltage budget and drive description for one solved point.
 * Everything is read from the point the solver already produced: no new circuit equations, no pass/fail ratio.
 * Each path is a KVL loop (rail = sum of terms) so the budget can be checked against the solver's residual.
 */
const term = (id, label, value, extra = {}) => ({ id, label, value, ...extra });
const ledgerEntry = (point, id) => point.ledger.find(e => (e.instanceId ?? e.id) === id);
const device = (point, id) => point.semiconductors.find(q => (q.instanceId ?? q.id) === id);
const drop = (point, id, label = id) => {
    const e = ledgerEntry(point, id);
    return e ? term(id, label, e.voltage, { current: e.current, currentLabel: 'I', instanceId: id }) : null;
};
const path = (id, title, railLabel, rail, terms, extra = {}) => {
    const present = terms.filter(Boolean), sum = present.reduce((n, x) => n + x.value, 0);
    return { id, title, railLabel, rail, terms: present, sum, residual: rail - sum, ...extra };
};

const LOAD_DRIVER = { 'gpio-source': 'GPIO1', 'gpio-sink': 'GPIO1', 'npn-pnp': 'Q2', 'npn-pmos': 'Q2', 'nmos-pmos': 'Q2' };
const DRIVER_NAME = { 'gpio-source': 'GPIO 출력 전압강하', 'gpio-sink': 'GPIO 핀 전압' };

function loadPath(point) {
    const c = point.config, id = c.topology, driverId = LOAD_DRIVER[id] ?? 'Q1';
    const follower = id === 'npn-follower', sink = id === 'npn-current-sink';
    const terms = [];
    // Emitter follower: the LED/RLED carry IE, the collector (rail) carries IC. Everything else carries the LED current.
    const loadCurrent = point.current, loadLabel = follower ? 'IE' : sink ? 'IC' : 'I';
    if (follower && point.driverVoltage != null) {
        const q = device(point, 'Q1');
        terms.push(term('Q1', 'Q1 VCE', point.driverVoltage, { current: q.current, currentLabel: 'IC', instanceId: 'Q1' }));
    }
    terms.push(term('RLED', 'RLED', loadCurrent * c.resistance, { current: loadCurrent, currentLabel: loadLabel, instanceId: 'RLED' }),
        term('LED1', c.seriesCount > 1 ? 'LED × ' + c.seriesCount + ' Vf' : 'LED Vf', point.ledVf * c.seriesCount, { current: loadCurrent, currentLabel: loadLabel, instanceId: 'LED1' }));
    if (!follower && point.driverVoltage != null) {
        const q = device(point, driverId);
        const label = DRIVER_NAME[id] ?? (q?.kind === 'mosfet' ? driverId + ' VDS' : driverId + ' VCE');
        terms.push(term(driverId, label, point.driverVoltage, { current: q?.current ?? point.current, currentLabel: q?.kind === 'mosfet' ? 'ID' : 'IC', instanceId: driverId }));
    }
    if (sink) {
        const re = ledgerEntry(point, 'RE');
        terms.push(term('RE', 'RE (IE)', re.voltage, { current: re.current, currentLabel: 'IE', instanceId: 'RE' }));
    }
    const rail = id === 'gpio-source' ? c.vdd : c.vcc;
    return path('load', '부하 경로', id === 'gpio-source' ? 'GPIO VDD' : 'VLED', rail, terms);
}

const gpioRail = point => point.gpioVoltage;
function drivePaths(point) {
    const c = point.config, id = c.topology, out = [];
    const pin = { railLabel: 'GPIO 단자 전압', rail: gpioRail(point) };
    const vbe = qid => device(point, qid) && term(qid + '.VBE', qid + ' VBE', device(point, qid).vbe, { instanceId: qid });
    switch (id) {
        case 'digital-npn': {
            const q = device(point, 'Q1');
            out.push(path('drive', 'GPIO → Q1 입력 (내장 R1 → B-E)', pin.railLabel, pin.rail,
                [term('Q1.R1', 'Q1 R1 (II)', q.input * q.r1, { current: q.input, currentLabel: 'II', instanceId: 'Q1.R1' }), vbe('Q1')]));
            break;
        }
        case 'npn-low':
            out.push(path('drive', 'GPIO → RB → Q1 B-E', pin.railLabel, pin.rail, [drop(point, 'RB', 'RB (IB)'), vbe('Q1')]));
            break;
        case 'npn-follower':
        case 'npn-current-sink':
            out.push(path('drive', 'GPIO → RB → Q1 B-E → 에미터 노드', pin.railLabel, pin.rail,
                [drop(point, 'RB', 'RB (IB)'), vbe('Q1'), term('VE', '에미터 노드 전압', point.nodes.emitter)]));
            break;
        case 'nmos-low':
            out.push(path('drive', 'GPIO → RG → 게이트 (RGS 분압)', pin.railLabel, pin.rail, [drop(point, 'RG'), drop(point, 'RGS', 'RGS (= VGS)')]));
            break;
        case 'pnp-high':
            out.push(path('drive', 'VLED → Q1 E-B → RB → GPIO(LOW)', 'VLED', c.vcc, [vbe('Q1'), drop(point, 'RB', 'RB (IB)'), term('GPIO1', 'GPIO 핀 전압', point.gpioVoltage, { instanceId: 'GPIO1' })]));
            break;
        case 'pmos-high':
            out.push(path('drive', 'VLED → RGS → RG → GPIO(LOW)', 'VLED', c.vcc, [drop(point, 'RGS', 'RGS (= |VGS|)'), drop(point, 'RG'), term('GPIO1', 'GPIO 핀 전압', point.gpioVoltage, { instanceId: 'GPIO1' })]));
            break;
        case 'npn-pnp':
            out.push(path('drive-input', 'GPIO → RB → Q1 B-E', pin.railLabel, pin.rail, [drop(point, 'RB', 'RB (IB)'), vbe('Q1')]),
                path('drive-output', 'Q2 베이스 구동: VLED → Q2 E-B → Rdrive → Q1 C-E', 'VLED', c.vcc,
                    [vbe('Q2'), drop(point, 'Rdrive', 'Rdrive (j)'), term('Q1.VCE', 'Q1 VCE', device(point, 'Q1').voltage, { instanceId: 'Q1' })]));
            break;
        case 'npn-pmos':
            out.push(path('drive-input', 'GPIO → RB → Q1 B-E', pin.railLabel, pin.rail, [drop(point, 'RB', 'RB (IB)'), vbe('Q1')]),
                path('drive-output', 'Q2 게이트 구동: VLED → RGS_OUT → Rdrive → Q1 C-E', 'VLED', c.vcc,
                    [drop(point, 'RGS_OUT', 'RGS_OUT (= |VGS|)'), drop(point, 'Rdrive', 'Rdrive (j)'), term('Q1.VCE', 'Q1 VCE', device(point, 'Q1').voltage, { instanceId: 'Q1' })]));
            break;
        case 'nmos-pmos':
            out.push(path('drive-input', 'GPIO → RG → Q1 게이트 (RGS_IN 분압)', pin.railLabel, pin.rail, [drop(point, 'RG'), drop(point, 'RGS_IN', 'RGS_IN (= VGS)')]),
                path('drive-output', 'Q2 게이트 구동: VLED → RGS_OUT → Rdrive → Q1 D-S', 'VLED', c.vcc,
                    [drop(point, 'RGS_OUT', 'RGS_OUT (= |VGS|)'), drop(point, 'Rdrive', 'Rdrive (j)'), term('Q1.VDS', 'Q1 VDS', device(point, 'Q1').voltage, { instanceId: 'Q1' })]));
            break;
        default: break; // resistor, gpio-source, gpio-sink: the GPIO is part of the load path
    }
    return out;
}

const figureOf = (label, g) => g ? { label, figure: g.figure, conditions: g.conditions } : null;
function transistorSummary(point, q, slotRole) {
    const part = getDeviceModel(q.modelId), base = { instanceId: q.instanceId ?? q.id, role: slotRole ?? null, region: q.region ?? null, modelId: q.modelId };
    if (q.kind === 'mosfet') return { ...base, kind: 'mosfet', id: q.current, vds: q.voltage, vgs: Math.abs(q.gate), weakDrive: q.region === 'weak-drive' };
    if (q.kind === 'digital') {
        return { ...base, kind: 'digital', io: q.current, ii: q.input, ib: q.base, ie: q.emitter, vbe: q.vbe, inputVoltage: q.inputVoltage, r1: q.r1, r2: q.r2,
            externalRatio: q.externalRatio, internalRatio: q.base > 0 ? q.current / q.base : null,
            testRatio: part?.outputRatio ?? null,
            figures: [figureOf('VO(on) (외부 IO/II 기준)', part?.on), figureOf('GI = IO/II (외부)', part?.gain)].filter(Boolean) };
    }
    return { ...base, kind: 'bjt', ic: q.current, ib: q.base, ie: q.emitter, vce: q.voltage, vbe: q.vbe,
        forcedRatio: q.base > 0 ? q.current / q.base : null, activeGain: q.gainAtTest ?? null, testRatio: part?.ratio ?? null,
        ratioMismatch: point.flags?.includes('approximation:BJT-saturation-drive-ratio-mismatch') ?? false,
        figures: [figureOf('hFE', part?.gain), figureOf('VCE(sat)', part?.vceSat), figureOf('VBE(sat)', part?.vbeSat)].filter(Boolean) };
}

export function qPointSummary(point) {
    const c = point.config, topology = topologyById(c.topology);
    if (point.region === 'off') {
        return { topologyId: c.topology, status: 'off', load: null, drive: [], devices: [],
            note: 'OFF 상태입니다. 전류는 0이고 누설 전류는 모델링하지 않았으며, 소자 전압은 상한(공급 전압)만 알 수 있어 분담과 구동비를 표시하지 않습니다.' };
    }
    const role = id => topology.deviceSlots.find(s => s.id === id)?.role ?? null;
    return { topologyId: c.topology, status: 'on', load: loadPath(point), drive: drivePaths(point),
        devices: point.semiconductors.map(q => transistorSummary(point, q, role(q.instanceId ?? q.id))), note: null };
}
