import { topologyById, activeParameterNames } from './topologies.js';
import { flagText } from './flags.js';

/**
 * Turns the limit checks the solver already produced (nominal) and the grouped sampled violations into warnings with
 * a severity, a scope and the inputs that can change them. It adds no electrical pass/fail rule of its own:
 * 'margin' is a heads-up against a threshold the user sets, never a verdict.
 */
export const DEFAULT_MARGIN_PCT = 90;
const MARGIN_UNITS = new Set(['A', 'W', 'V']);   // a ratio of two temperatures is meaningless
const FLAG_PREFIXES = ['extrapolation:', 'approximation:', 'not-modeled:', 'not-verified:', 'assumption:'];

const AUX_PARAMETER = { RB: 'baseResistance', RE: 'emitterResistance', RG: 'gateResistance', Rdrive: 'gateResistance',
    RGS: 'gatePull', RGS_IN: 'gatePull', RGS_OUT: 'gatePull', RBE: 'gatePull' };
export const INPUT_LABEL = {
    resistance: 'RLED', targetMa: '목표 전류', targetMcd: '목표 광도', resistorRating: 'RLED 실제 정격', derating: '입력한 사용 비율',
    auxRating: '보조 저항 정격', vcc: 'VLED', vdd: 'GPIO 전원', ambient: '주변 온도', seriesCount: '직렬 LED 수',
    baseResistance: 'RB', emitterResistance: 'RE', gateResistance: 'RG / Rdrive', gatePull: 'RGS / pull-up',
    otherSourceCurrent: '다른 핀 source 합계', otherSinkCurrent: '다른 핀 sink 합계',
};
const isModelInput = id => id.startsWith('model-');
const passThrough = id => id === 'targetMa' || id === 'targetMcd' || isModelInput(id);

/** Inputs that can change a check, most direct fix first, limited to the ones the current topology actually shows. */
export function relatedInputs(check, config, view = {}) {
    const topology = topologyById(config.topology), active = activeParameterNames(topology, config);
    const gpioLoad = config.topology === 'gpio-source' || config.topology === 'gpio-sink';
    const current = active.has('emitterResistance') ? ['emitterResistance', 'resistance', 'targetMa', 'targetMcd'] : ['resistance', 'targetMa', 'targetMcd'];
    const drive = gpioLoad ? ['resistance', 'targetMa', 'targetMcd'] : ['baseResistance', 'gateResistance', 'gatePull'];
    const model = 'model-' + check.instanceId;
    let list;
    switch (check.ruleId) {
        case 'led-forward-current': case 'led-power': list = [...current, 'vcc', 'seriesCount']; break;
        case 'led-current-derated': list = ['resistance', 'targetMa', 'targetMcd', 'ambient', 'vcc']; break;
        case 'led-ambient': list = ['ambient']; break;
        case 'resistor-power-budget':
            list = check.instanceId === 'RLED' ? ['resistorRating', 'derating', 'resistance', 'targetMa', 'targetMcd', 'vcc']
                : ['auxRating', 'derating', AUX_PARAMETER[check.instanceId] ?? 'gatePull', 'vcc'];
            break;
        case 'driver-pin-current': list = [...drive, 'vdd', 'vcc', 'model-GPIO1']; break;
        case 'driver-total-source': list = ['otherSourceCurrent', ...drive, 'vdd', 'model-GPIO1']; break;
        case 'driver-total-sink': list = ['otherSinkCurrent', ...drive, 'vdd', 'model-GPIO1']; break;
        case 'transistor-current': list = [...current, 'vcc', model]; break;
        case 'transistor-voltage': list = ['vcc', model]; break;
        case 'gate-source-voltage': list = ['gatePull', 'gateResistance', 'vdd', 'vcc', model]; break;
        case 'digital-input-voltage': list = ['vdd', model]; break;
        case 'transistor-power-budget': list = [...current, 'vcc', 'ambient', model]; break;
        default: list = [model];
    }
    // RLED is an input only in verify mode; in size mode the target field takes its place.
    const sizing = view.mode === 'size', hidden = id => (id === 'resistance' && sizing) || (id === 'targetMa' && !(sizing && view.targetKind !== 'mcd'))
        || (id === 'targetMcd' && !(sizing && view.targetKind === 'mcd'));
    return [...new Set(list)].filter(id => !hidden(id) && (passThrough(id) || active.has(id)))
        .map(id => ({ id, label: isModelInput(id) ? id.slice(6) + ' 부품 선택' : INPUT_LABEL[id] ?? id }));
}

/** Axes of the worst sampled scenario that differ from nominal, with both values. */
export function scenarioDiffs(corners, scenario) {
    return (corners?.axes?.swept ?? []).filter(a => scenario?.[a.key] !== undefined && scenario[a.key] !== a.nominal)
        .map(a => ({ key: a.key, label: a.label, unit: a.unit, nominal: a.nominal, value: scenario[a.key] }));
}

const excessOf = (actual, limit) => ({ excess: actual - limit, excessPct: limit > 0 ? (actual - limit) / limit * 100 : null });
const SEVERITY_ORDER = { exceeded: 0, margin: 1, unknown: 2, approximation: 3 };

export function buildWarnings({ config, point, validation, corners, cornerPhase, marginPct = DEFAULT_MARGIN_PCT, view = {} }) {
    const findings = [];
    const marginOn = Number.isFinite(marginPct) && marginPct > 0;
    for (const c of validation?.checks ?? []) {
        const base = { ruleId: c.ruleId, instanceId: c.instanceId, id: c.id, metric: c.metric, unit: c.unit, actual: c.actual, limit: c.limit, condition: c.condition ?? '' };
        if (c.status === 'exceeded') {
            findings.push({ ...base, key: 'nominal|' + c.ruleId + '|' + c.instanceId + '|' + c.id, severity: 'exceeded', scope: 'nominal',
                ...excessOf(c.actual, c.limit), inputs: relatedInputs(c, config, view) });
        } else if (c.status === 'unknown') {
            findings.push({ ...base, key: 'unknown|' + c.ruleId + '|' + c.instanceId + '|' + c.id, severity: 'unknown', scope: 'nominal', inputs: [] });
        } else if (marginOn && c.status === 'within' && MARGIN_UNITS.has(c.unit) && c.limit > 0 && c.actual / c.limit >= marginPct / 100) {
            findings.push({ ...base, key: 'margin|' + c.ruleId + '|' + c.instanceId + '|' + c.id, severity: 'margin', scope: 'nominal',
                usagePct: c.actual / c.limit * 100, marginPct, inputs: relatedInputs(c, config, view) });
        }
    }
    for (const g of corners?.violationGroups ?? []) {
        findings.push({ key: 'sampled|' + g.key, severity: 'exceeded', scope: 'sampled', ruleId: g.ruleId, instanceId: g.instanceId, id: g.id,
            metric: g.metric, unit: g.unit, actual: g.worst.actual, limit: g.limit, condition: g.condition ?? '', ...excessOf(g.worst.actual, g.limit),
            count: g.count, total: corners.count, scenario: scenarioDiffs(corners, g.worst.scenario),
            inputs: relatedInputs({ ruleId: g.ruleId, instanceId: g.instanceId }, config, view) });
    }
    for (const flag of point?.flags ?? []) if (FLAG_PREFIXES.some(p => flag.startsWith(p)))
        findings.push({ key: 'approximation|' + flag, severity: 'approximation', scope: 'nominal', id: flag, text: flagText(flag), inputs: [] });
    findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        || (a.scope === b.scope ? 0 : a.scope === 'nominal' ? -1 : 1)
        || (b.excessPct ?? 0) - (a.excessPct ?? 0));
    const failures = corners?.failures?.length ?? 0;
    return { findings, marginPct: marginOn ? marginPct : null,
        sampled: { phase: cornerPhase ?? 'idle', count: corners?.count ?? null, validCount: corners?.validCount ?? null, excluded: failures,
            complete: cornerPhase === 'complete', violationCount: corners?.violationCount ?? 0 } };
}

/** Presets by rated power, smallest first. Object order is not usable: the integer-like key '1206' is iterated first. */
export const sortedPresets = presets => Object.entries(presets).sort((a, b) => a[1] - b[1]);

/** RLED power against the budget the user entered, with nominal and sampled peak kept apart. */
export function powerBudget({ config, point, corners, presets }) {
    if (!point) return null;
    const limit = config.resistorRating * config.derating, nominal = point.resistorPower;
    const peak = corners?.extrema?.resistorPower?.max ?? null;
    const basisKind = peak ? 'sampled' : 'nominal', basis = peak ? peak.value : nominal;
    const fits = rated => rated * config.derating >= basis * (1 - 1e-9);
    const smallestFit = sortedPresets(presets).find(([, rated]) => fits(rated)) ?? null;
    return { limit, rated: config.resistorRating, derating: config.derating, nominal, sampledPeak: peak?.value ?? null,
        nominalRatio: limit > 0 ? nominal / limit : null, peakRatio: peak && limit > 0 ? peak.value / limit : null,
        ratedRatio: config.derating > 0 ? 1 / config.derating : null,
        basisKind, basis, exceeds: limit > 0 ? basis > limit * (1 + 1e-8) : basis > 0,
        requiredRated: config.derating > 0 ? basis / config.derating : null,
        currentPreset: sortedPresets(presets).find(([, r]) => r === config.resistorRating)?.[0] ?? null,
        recommendation: smallestFit ? { key: smallestFit[0], rated: smallestFit[1] } : null };
}
