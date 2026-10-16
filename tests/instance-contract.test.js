import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePoint } from '../src/core/analysis.js';
import { freshConfig, transitionConfig, TOPOLOGIES } from '../src/core/topologies.js';
import { CIRCUIT_TEMPLATES } from '../src/ui/circuitTemplates.js';
import { buildInstanceViews } from '../src/ui/viewModel.js';

const close = (a, b) => Math.abs(a - b) <= 1e-12 + 1e-9 * Math.max(Math.abs(a), Math.abs(b));
const configFor = (id, extra = {}) => ({ ...transitionConfig(freshConfig(), id), ...extra });
const STATES = [
    ['default', {}],
    ['opposite output state', t => ({ state: t.active === 'LOW' ? 'HIGH' : 'LOW' })],
    ['series LEDs at a higher supply', { seriesCount: 2, vcc: 9 }],
];
const solved = [];
for (const t of TOPOLOGIES) for (const [name, extra] of STATES) {
    const config = configFor(t.id, typeof extra === 'function' ? extra(t) : extra), r = analyzePoint(config);
    if (r.ok) solved.push({ t, name, config, point: r.point, validation: r.validation, views: buildInstanceViews(r.point.config, r.point, r.validation) });
}

test('the contract is checked in enough states: every topology is solved at least twice', () => {
    for (const t of TOPOLOGIES) assert.ok(solved.filter(s => s.t.id === t.id).length >= 2, t.id);
});

test('every clickable instance has exactly one inspector view, and nothing else has one', () => {
    for (const s of solved) {
        assert.deepEqual(s.views.map(v => v.instanceId).sort(), [...CIRCUIT_TEMPLATES[s.t.id].instances].sort(), `${s.t.id} / ${s.name}`);
    }
});

test('every check is shown on the instance it names, and names no instance that is not drawn', () => {
    for (const s of solved) {
        const drawn = new Set(CIRCUIT_TEMPLATES[s.t.id].instances);
        for (const c of s.validation.checks) {
            assert.ok(drawn.has(c.instanceId), `${s.t.id} / ${s.name}: check "${c.id}" names ${c.instanceId}, which is not drawn`);
            assert.ok(s.views.find(v => v.instanceId === c.instanceId).checks.includes(c), `${s.t.id} / ${s.name}: ${c.instanceId} does not list "${c.id}"`);
        }
        assert.equal(s.views.reduce((n, v) => n + v.checks.length, 0), s.validation.checks.length, `${s.t.id} / ${s.name}: a check is listed twice or not at all`);
    }
});

test('every ledger row reaches its own instance with its current and power', () => {
    for (const s of solved) for (const e of s.point.ledger) {
        const view = s.views.find(v => v.instanceId === (e.instanceId ?? e.id));
        assert.ok(view, `${s.t.id} / ${s.name}: ledger row ${e.id} has no view`);
        for (const [what, value] of [['current', e.current], ['power', e.power]]) {
            if (!Number.isFinite(value)) continue;
            assert.ok(view.metrics.some(m => Number.isFinite(m.value) && close(m.value, value)),
                `${s.t.id} / ${s.name}: ${view.instanceId} does not show the ledger ${what} ${value}`);
        }
    }
});

test('semiconductor views carry their own model, region and part', () => {
    for (const s of solved) for (const q of s.point.semiconductors) {
        const view = s.views.find(v => v.instanceId === (q.instanceId ?? q.id));
        assert.equal(view.modelId, q.modelId, `${s.t.id}: ${view.instanceId}`);
        assert.ok(view.part, `${s.t.id}: ${view.instanceId} has no part`);
    }
});

test('when the operating point fails, every instance still has a view, with its static part and without invented numbers', () => {
    for (const t of TOPOLOGIES) {
        const config = configFor(t.id, { resistance: '' });
        assert.equal(analyzePoint(config).ok, false, `${t.id} should fail with an empty RLED`);
        const views = buildInstanceViews(config, null, null);
        assert.deepEqual(views.map(v => v.instanceId).sort(), [...CIRCUIT_TEMPLATES[t.id].instances].sort(), t.id);
        for (const v of views) {
            assert.deepEqual(v.metrics, [], `${t.id}/${v.instanceId} must not show numbers without an operating point`);
            assert.deepEqual(v.checks, [], `${t.id}/${v.instanceId}`);
        }
        for (const id of ['LED1', ...Object.keys(config.deviceModels ?? {})])
            assert.ok(views.find(v => v.instanceId === id)?.part, `${t.id}/${id} keeps its static part`);
        for (const id of CIRCUIT_TEMPLATES[t.id].instances.filter(i => i.startsWith('Q1.')))
            assert.equal(views.find(v => v.instanceId === id).parentInstanceId, 'Q1', `${t.id}/${id} names its parent`);
    }
});
