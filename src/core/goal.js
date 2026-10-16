import { ModelError, finite } from './math.js';
import { opticalValueForBasis } from './optics.js';

/** 'minimum': achieved >= target. 'approximate': |achieved - target| <= tolerancePct of target. */
export const GOAL_CRITERIA = Object.freeze(['minimum', 'approximate']);
export const DEFAULT_GOAL_TOLERANCE_PCT = 5;
const RELATIVE_SLACK = 1e-7;

export function normalizeCriterion(criterion, tolerancePct = DEFAULT_GOAL_TOLERANCE_PCT) {
    if (criterion == null) criterion = 'minimum';
    if (!GOAL_CRITERIA.includes(criterion)) throw new ModelError('invalid-input', '알 수 없는 목표 판정 기준입니다: ' + criterion);
    if (criterion === 'approximate') finite(tolerancePct, '목표 허용 오차(%)', 0, 100);
    return { criterion, tolerancePct: Number.isFinite(tolerancePct) ? tolerancePct : DEFAULT_GOAL_TOLERANCE_PCT };
}

/**
 * Judge one operating point against a design goal. Pure and shared by the sizing and verify views,
 * so the same configuration always yields the same verdict.
 * status: 'met' | 'missed' | 'unavailable' (model cannot express the goal) | 'not-computed' (no operating point).
 */
export function evaluateGoal(point, intent) {
    const optical = intent.kind === 'optical';
    const { criterion, tolerancePct } = normalizeCriterion(intent.criterion, intent.tolerancePct);
    const target = optical ? intent.targetMcd : intent.targetCurrent;
    const result = { ...intent, criterion, tolerancePct, target, unit: optical ? 'mcd' : 'A',
        achieved: null, error: null, errorPct: null, status: 'not-computed', met: false, reason: null };
    if (!point) { result.reason = 'operating-point-unavailable'; return result; }
    const achieved = optical ? opticalValueForBasis(point.optical, intent.basis) : point.current;
    if (!Number.isFinite(achieved)) { result.status = 'unavailable'; result.reason = 'optical-value-unavailable-for-basis'; return result; }
    const error = achieved - target;
    const met = criterion === 'minimum'
        ? achieved >= target * (1 - RELATIVE_SLACK)
        : Math.abs(error) <= target * tolerancePct / 100 * (1 + RELATIVE_SLACK);
    Object.assign(result, { achieved, error, errorPct: target > 0 ? error / target * 100 : null, status: met ? 'met' : 'missed', met });
    if (optical) result.achievedMcd = achieved; else result.achievedCurrent = achieved;
    return result;
}

/** Stable subset of a goal that is worth remembering after the sizing result is gone. */
export function intentFromGoal(goal, { series, strategy }) {
    const intent = { kind: goal.kind, criterion: goal.criterion, tolerancePct: goal.tolerancePct, series, strategy };
    if (goal.kind === 'optical') {
        Object.assign(intent, { targetMcd: goal.targetMcd, basis: goal.basis, desiredCurrent: goal.desiredCurrent,
            validity: goal.validity, assumptions: goal.assumptions });
    } else intent.targetCurrent = goal.targetCurrent;
    return intent;
}

const DRIFT_FIELDS = [
    ['topology', '토폴로지', ''], ['led', 'LED', ''], ['seriesCount', '직렬 LED', '개'], ['temperature', '전기 모델 온도', '°C'],
    ['vcc', 'VLED', 'V'], ['vdd', 'GPIO 전원', 'V'], ['resistance', 'RLED', 'Ω'], ['baseResistance', 'RB', 'Ω'],
    ['emitterResistance', 'RE', 'Ω'], ['gateResistance', 'RG', 'Ω'], ['gatePull', 'RGS', 'Ω'], ['pullResistance', 'GPIO pull', 'Ω'],
    ['sourceResistance', '제어원 Rout', 'Ω'], ['state', '출력 상태', ''], ['gpioMode', '출력 모드', ''], ['pull', 'Hi-Z pull', ''],
    ['vfShift', 'Vf 이동', 'V'], ['dtcR1Scale', 'DTC R1 배율', ''], ['dtcRatio', 'DTC R2/R1', ''],
];
/** Inputs that differ between the configuration a goal was applied to and the current one. */
export function goalDrift(snapshot, current) {
    if (!snapshot || !current) return [];
    const drift = [];
    for (const [key, label, unit] of DRIFT_FIELDS)
        if (snapshot[key] !== current[key]) drift.push({ key, label, unit, from: snapshot[key], to: current[key] });
    const slots = new Set([...Object.keys(snapshot.deviceModels ?? {}), ...Object.keys(current.deviceModels ?? {})]);
    for (const slot of [...slots].sort()) {
        const from = snapshot.deviceModels?.[slot], to = current.deviceModels?.[slot];
        if (from !== to) drift.push({ key: 'deviceModels.' + slot, label: slot + ' 부품', unit: '', from, to });
    }
    return drift;
}
