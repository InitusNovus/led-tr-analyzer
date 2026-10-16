import test from 'node:test';
import assert from 'node:assert/strict';
import { freshConfig, transitionConfig, solvePoint, TOPOLOGIES } from '../src/core/topologies.js';
import { buildScene, drawnNets, junctions, wireSegments, VIEW } from '../src/ui/schematic.js';
import { CIRCUIT_TEMPLATES } from '../src/ui/circuitTemplates.js';

const sceneFor = (id, extra = {}) => {
    const config = { ...transitionConfig(freshConfig(), id), ...extra };
    let point = null;
    try { point = solvePoint(config); } catch { /* an unsupported state still has to draw */ }
    return buildScene(config, point);
};
const SCENES = Object.fromEntries(TOPOLOGIES.map(t => [t.id, sceneFor(t.id)]));
const nets = list => list.map(n => [...n].sort().join('|')).sort();
function templateNets(connections) {
    const parent = new Map(), find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); return r; };
    for (const [a, b] of connections) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); }
    const groups = new Map();
    for (const k of parent.keys()) { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); }
    return [...groups.values()];
}
const inside = (v, lo, hi) => v > lo && v < hi;
const segHitsRect = ({ a, b }, r, eps = 1) => {
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    return x2 > r.x + eps && x1 < r.x + r.w - eps && y2 > r.y + eps && y1 < r.y + r.h - eps;
};
const rectsOverlap = (p, q, eps = 0.5) => p.x < q.x + q.w - eps && q.x < p.x + p.w - eps && p.y < q.y + q.h - eps && q.y < p.y + p.h - eps;

test('the drawn wires connect exactly what the circuit template says, for all 13 topologies', () => {
    assert.deepEqual(Object.keys(SCENES).sort(), Object.keys(CIRCUIT_TEMPLATES).sort());
    for (const [id, scene] of Object.entries(SCENES))
        assert.deepEqual(nets(drawnNets(scene)), nets(templateNets(CIRCUIT_TEMPLATES[id].connections)), id);
});

test('clickable parts are exactly the template instances', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
        const hits = scene.parts.flatMap(p => [p.hit, ...(p.subHits ?? [])]).filter(Boolean).sort();
        assert.deepEqual(hits, [...CIRCUIT_TEMPLATES[id].instances].sort(), id);
    }
});

test('every wire is orthogonal, has length, and ends on a pin or on another wire', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
        const pins = scene.parts.flatMap(p => Object.values(p.pins).map(q => [q.x, q.y]));
        const segs = wireSegments(scene);
        for (const w of scene.wires) {
            assert.ok(w.points.length >= 2, id + ' wire has points');
            for (let i = 1; i < w.points.length; i++) {
                const [a, b] = [w.points[i - 1], w.points[i]];
                assert.ok(a[0] === b[0] || a[1] === b[1], id + ' orthogonal ' + a + '->' + b);
                assert.ok(a[0] !== b[0] || a[1] !== b[1], id + ' zero-length wire at ' + a);
            }
            for (const end of [w.points[0], w.points.at(-1)]) {
                const onPin = pins.some(p => p[0] === end[0] && p[1] === end[1]);
                const onOther = segs.some(s => s.a !== end && s.b !== end && ((s.a[0] === s.b[0] && end[0] === s.a[0] && inside(end[1], Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])))
                    || (s.a[1] === s.b[1] && end[1] === s.a[1] && inside(end[0], Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])))));
                assert.ok(onPin || onOther, id + ' dangling wire end ' + end);
            }
        }
    }
});

test('junction dots appear exactly where wires meet in a T', () => {
    for (const [id, scene] of Object.entries(SCENES)) for (const j of junctions(scene)) {
        const touching = wireSegments(scene).filter(s => (s.a[0] === s.b[0] ? j[0] === s.a[0] && j[1] >= Math.min(s.a[1], s.b[1]) && j[1] <= Math.max(s.a[1], s.b[1])
            : j[1] === s.a[1] && j[0] >= Math.min(s.a[0], s.b[0]) && j[0] <= Math.max(s.a[0], s.b[0])));
        assert.ok(touching.length >= 2, id + ' junction at ' + j);
    }
    assert.ok(junctions(SCENES['nmos-low']).length >= 1 && junctions(SCENES['digital-npn']).length >= 1);
});

test('wires never cross each other or run on top of each other', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
        const segs = wireSegments(scene);
        for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
            const p = segs[i], q = segs[j], ph = p.a[1] === p.b[1], qh = q.a[1] === q.b[1];
            if (ph !== qh) {
                const h = ph ? p : q, v = ph ? q : p;
                assert.ok(!(inside(v.a[0], Math.min(h.a[0], h.b[0]), Math.max(h.a[0], h.b[0])) && inside(h.a[1], Math.min(v.a[1], v.b[1]), Math.max(v.a[1], v.b[1]))),
                    id + ' wires cross at ' + [v.a[0], h.a[1]]);
            } else if (ph ? p.a[1] === q.a[1] : p.a[0] === q.a[0]) {
                const k = ph ? 0 : 1, lo = Math.max(Math.min(p.a[k], p.b[k]), Math.min(q.a[k], q.b[k])), hi = Math.min(Math.max(p.a[k], p.b[k]), Math.max(q.a[k], q.b[k]));
                assert.ok(hi - lo <= 0, id + ' collinear wires overlap near ' + p.a);
            }
        }
    }
});

test('wires do not cut through another part, and parts do not overlap', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
        const segs = wireSegments(scene);
        for (const p of scene.parts) {
            for (const b of p.boxes) for (const s of segs) assert.ok(!segHitsRect(s, b), `${id}: wire ${s.a}->${s.b} cuts through ${p.id}`);
        }
        const boxes = scene.parts.flatMap(p => p.boxes.map(b => ({ ...b, owner: p.id })));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
            if (boxes[i].owner !== boxes[j].owner) assert.ok(!rectsOverlap(boxes[i], boxes[j]), `${id}: ${boxes[i].owner} overlaps ${boxes[j].owner}`);
    }
});

test('text stays inside the canvas and never sits on a wire or another part or label', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
        const segs = wireSegments(scene), labels = scene.parts.flatMap(p => p.labels.map(l => ({ ...l, owner: p.id })));
        for (const l of labels) {
            const r = l.rect;
            assert.ok(r.x >= 4 && r.y >= 4 && r.x + r.w <= VIEW.w - 4 && r.y + r.h <= VIEW.h - 4, `${id}: "${l.text}" leaves the canvas ${JSON.stringify(r)}`);
            for (const s of segs) assert.ok(!segHitsRect(s, r, 1), `${id}: wire ${s.a}->${s.b} runs through "${l.text}"`);
            for (const p of scene.parts) if (p.id !== l.owner) for (const b of p.boxes) assert.ok(!rectsOverlap(r, b), `${id}: "${l.text}" overlaps ${p.id}`);
        }
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++)
            assert.ok(!rectsOverlap(labels[i].rect, labels[j].rect), `${id}: "${labels[i].text}" overlaps "${labels[j].text}"`);
    }
});

test('the digital transistor has no enclosing box and keeps R1 / R2 as separate clickable parts', () => {
    const scene = SCENES['digital-npn'], dtc = scene.parts.find(p => p.kind === 'dtc');
    assert.deepEqual(dtc.subHits, ['Q1.R1', 'Q1.R2']);
    assert.ok(dtc.boxes.every(b => b.w <= 70 && b.h <= 70), 'no package-sized rectangle');
    const nets_ = drawnNets(scene).map(n => n.join('|'));
    assert.ok(nets_.includes('GND|Q1.E|Q1.R2'), 'R2 returns to the emitter: ' + nets_);
    assert.ok(nets_.includes('Q1.B|Q1.R1'), 'R1 feeds the base');
});

test('scenes also work for other LEDs, supplies and series counts', () => {
    for (const id of ['npn-pnp', 'nmos-pmos', 'npn-current-sink', 'digital-npn'])
        for (const extra of [{ led: 'KT-0805R', seriesCount: 3, vcc: 12 }, { resistance: 100000, baseResistance: 100, gateResistance: 100000 }]) {
            const scene = sceneFor(id, extra);
            assert.deepEqual(nets(drawnNets(scene)), nets(templateNets(CIRCUIT_TEMPLATES[id].connections)), id);
        }
});
