import { freshConfig, transitionConfig, topologyById } from '../core/topologies.js';
import { LEDS } from '../data/catalog.js';
import { opticalCapability } from '../core/optics.js';
import { DEFAULT_GOAL_TOLERANCE_PCT } from '../core/goal.js';

/**
 * Single source of truth for the workbench state.
 * Anything derived from a computation result (sizing, validation, sampled corners)
 * is keyed against this state, so keep input-changing transitions here and pure.
 */
export function initialDesignState() {
    return {
        config: freshConfig(), mode: 'verify',
        targetMa: 10, targetMcd: 60, targetKind: 'current', opticalBasis: 'typ', opticalNotice: '',
        series: 'E24+E96', strategy: 'closest',
        // Editing-time judgement rule vs. the goal the user actually applied to verify mode.
        criterion: 'minimum', tolerancePct: DEFAULT_GOAL_TOLERANCE_PCT, appliedGoal: null,
        includeDtc: false, cornerSnapshot: null, selectedInstance: 'Q1',
    };
}
const defaultSelection = topology => topology.deviceSlots.some(s => s.id === 'Q1') ? 'Q1' : 'LED1';
/** Changing any electrical input makes a previous sampled-corner result stale. */
const withConfig = (state, config, extra = {}) => ({ ...state, ...extra, config, cornerSnapshot: null });

export function designReducer(state, action) {
    switch (action.type) {
        case 'config':
            return withConfig(state, { ...state.config, [action.key]: action.value });
        case 'device':
            return withConfig(state, { ...state.config, deviceModels: { ...(state.config.deviceModels ?? {}), [action.id]: action.value } },
                { selectedInstance: action.id });
        case 'topology': {
            const next = topologyById(action.id);
            return withConfig(state, transitionConfig(state.config, action.id), {
                mode: next.supportedOperations.includes('size') ? state.mode : 'verify',
                selectedInstance: defaultSelection(next),
            });
        }
        case 'led': {
            const cap = opticalCapability(LEDS[action.id]);
            const fallback = state.targetKind === 'mcd' && !cap.canInvert;
            return withConfig(state, { ...state.config, led: action.id }, {
                selectedInstance: 'LED1', opticalBasis: cap.hasRange ? 'min' : 'typ',
                targetKind: fallback ? 'current' : state.targetKind,
                opticalNotice: fallback ? '선택 LED에 광도 역산 근거가 없어 전류 목표로 돌아왔습니다. 이전 mcd 입력값은 보존했습니다.' : '',
            });
        }
        case 'targetKind':
            if (action.kind === 'mcd' && !opticalCapability(LEDS[state.config.led]).canInvert) return state;
            return { ...state, cornerSnapshot: null, targetKind: action.kind, opticalNotice: '' };
        case 'applyGoal': {
            // Keeps the intent and the configuration it was applied to; verify mode re-evaluates against the live point.
            const config = { ...state.config, resistance: action.selectedResistance };
            return withConfig(state, config, {
                mode: 'verify',
                appliedGoal: { intent: action.intent, selectedResistance: action.selectedResistance,
                    exactResistance: action.exactResistance, snapshot: config },
            });
        }
        case 'reset':
            return initialDesignState();
        case 'patch':
            return { ...state, ...action.patch, ...(action.invalidate ? { cornerSnapshot: null } : {}) };
        default:
            return state;
    }
}
