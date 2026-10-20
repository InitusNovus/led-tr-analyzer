import { freshConfig, topologyById, transitionConfig, resolveDeviceModels } from '../core/topologies.js';
import { LEDS, ledModel } from '../data/catalog.js';
import { opticalCapability } from '../core/optics.js';
import { initialDesignState } from './designState.js';

/**
 * Last-used settings, kept in the browser's localStorage (nothing leaves the device).
 * Only the inputs the user typed or picked are stored; results, applied goals and sampled corners are derived and are recomputed.
 * The stored shape is versioned and every field is validated on the way back in, so a stale or hand-edited entry falls back to defaults.
 */
export const STORAGE_KEY = 'led-tr-analyzer:design:v1';
const VERSION = 1;
const PLAIN = ['mode', 'targetMa', 'targetMcd', 'targetKind', 'opticalBasis', 'series', 'strategy', 'criterion', 'tolerancePct', 'marginPct', 'includeDtc', 'selectedInstance'];

export const serializeDesign = state => ({ v: VERSION, config: state.config, ...Object.fromEntries(PLAIN.map(k => [k, state[k]])) });

const sameType = (a, b) => typeof a === typeof b && (typeof a !== 'number' || Number.isFinite(a));

/** Turns a parsed storage entry into a design state, or returns null when it cannot be trusted at all. */
export function restoreDesign(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== VERSION || !raw.config || typeof raw.config !== 'object') return null;
    const base = initialDesignState(), fresh = freshConfig();
    if (!topologyById(raw.config.topology) || !LEDS[raw.config.led]) return null;
    let config = { ...fresh };
    for (const k of Object.keys(fresh)) if (k !== 'deviceModels' && k in raw.config && sameType(raw.config[k], fresh[k])) config[k] = raw.config[k];
    const topology = topologyById(config.topology);
    try { config.deviceModels = resolveDeviceModels(raw.config.deviceModels, topology); }
    catch { config = transitionConfig({ ...config, deviceModels: {} }, config.topology); }
    config.ledBin = raw.config.ledBin && ledModel(config.led, raw.config.ledBin) ? raw.config.ledBin : null;
    const state = { ...base, config };
    for (const k of PLAIN) if (k in raw && sameType(raw[k], base[k])) state[k] = raw[k];
    if (state.mode === 'size' && !topology.supportedOperations.includes('size')) state.mode = 'verify';
    if (state.targetKind === 'mcd' && !opticalCapability(LEDS[config.led]).canInvert) state.targetKind = 'current';
    const slots = topology.deviceSlots.map(s => s.id).concat('LED1');
    if (!slots.includes(state.selectedInstance)) state.selectedInstance = base.selectedInstance;
    return state;
}

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadDesignState() {
    try { return restoreDesign(JSON.parse(storage()?.getItem(STORAGE_KEY) ?? 'null')) ?? initialDesignState(); }
    catch { return initialDesignState(); }
}

/** Stores the state, or removes the entry when it equals the defaults so a later change of defaults still reaches that user. */
export function saveDesignState(state) {
    try {
        const s = storage(); if (!s) return;
        const now = JSON.stringify(serializeDesign(state));
        if (now === JSON.stringify(serializeDesign(initialDesignState()))) s.removeItem(STORAGE_KEY);
        else s.setItem(STORAGE_KEY, now);
    } catch { /* private mode, quota or blocked storage: the app works without it */ }
}
