import { LEDS, getDeviceModel } from '../data/catalog.js';

/**
 * Terminal-anchored schematic scene.
 *
 * Every part exposes its pins (absolute coordinates plus the terminal name used by circuitTemplates), and every wire
 * is built from those pins, so wire ends cannot drift away from a symbol. Nothing here knows about React or the DOM:
 * the same scene drives rendering and the geometry/netlist tests.
 */
export const VIEW = Object.freeze({ w: 720, h: 440 });
const LEAD = 34;            // pin distance from the centre of a vertical two-terminal part
const TR = 42;              // pin distance from the centre of a BJT/MOSFET
const FONT = { 'part-label': 14, 'terminal-label': 13, 'minor-label': 13, 'rail-label': 14 };

export const textWidth = (text, size) => [...String(text)].reduce((w, ch) => w + (ch.codePointAt(0) >= 0x1100 ? size : size * 0.6), 0);

const make = (kind, id, x, y, extra = {}) => ({ kind, id, x, y, pins: {}, boxes: [], labels: [], hit: id, ...extra });
const pin = (p, name, dx, dy, term = null) => { p.pins[name] = { x: p.x + dx, y: p.y + dy, term }; return p; };
const box = (p, dx, dy, w, h) => { p.boxes.push({ x: p.x + dx, y: p.y + dy, w, h }); return p; };
const label = (p, text, dx, dy, { anchor = 'start', cls = 'part-label' } = {}) => {
    const size = FONT[cls], width = textWidth(text, size);
    const left = anchor === 'middle' ? p.x + dx - width / 2 : anchor === 'end' ? p.x + dx - width : p.x + dx;
    p.labels.push({ text, x: p.x + dx, y: p.y + dy, anchor, cls, rect: { x: left, y: p.y + dy - size * 0.8, w: width, h: size * 1.05 } });
    return p;
};
const at = (p, name) => [p.pins[name].x, p.pins[name].y];

/* ---------- symbols ---------- */
function resV(id, x, y, { value, name = id, terms = [id + '.1', id + '.2'], side = 'right', net = 'load' } = {}) {
    const p = make('resV', id, x, y, { net });
    pin(p, 'a', 0, -LEAD, terms[0]); pin(p, 'b', 0, LEAD, terms[1]); box(p, -10, -25, 20, 50);
    label(p, name + (value != null ? ` ${value}Ω` : ''), side === 'right' ? 20 : -20, 5, { anchor: side === 'right' ? 'start' : 'end' });
    return p;
}
function resH(id, x1, x2, y, { value, name = id, terms = [id + '.1', id + '.2'], labelAt = 'above', net = 'drive' } = {}) {
    const span = Math.abs(x2 - x1), width = Math.min(72, Math.max(24, Math.round(span * 0.45)), Math.max(12, span - 8));
    const mid = Math.round((x1 + x2) / 2), p = make('resH', id, mid, y, { net, x1, x2, width });
    pin(p, 'a', x1 - mid, 0, terms[0]); pin(p, 'b', x2 - mid, 0, terms[1]); box(p, -width / 2, -10, width, 20);
    label(p, name + (value != null ? ` ${value}Ω` : ''), 0, labelAt === 'above' ? -17 : 33, { anchor: 'middle' });
    return p;
}
function led(x, y, { color, name }) {
    const p = make('led', 'LED1', x, y, { color });
    pin(p, 'a', 0, -LEAD, 'LED1.A'); pin(p, 'k', 0, LEAD, 'LED1.K'); box(p, -20, -17, 40, 32); box(p, 23, -27, 24, 26);
    label(p, name, 52, -2); label(p, 'A', -30, -20, { cls: 'terminal-label' }); label(p, 'K', -30, 22, { cls: 'terminal-label' });
    return p;
}
const BJT_TERMS = { npn: ['C', 'E'], pnp: ['E', 'C'] };
function bjt(id, x, y, { polarity, name }) {
    const [top, bottom] = BJT_TERMS[polarity], p = make('bjt', id, x, y, { polarity });
    pin(p, 'b', -48, 0, id + '.B'); pin(p, 't', 0, -TR, `${id}.${top}`); pin(p, 'e', 0, TR, `${id}.${bottom}`); box(p, -35, -35, 70, 70);
    label(p, `${id} · ${name}`, 50, -2); label(p, top, 9, -30, { cls: 'terminal-label' }); label(p, bottom, 9, 40, { cls: 'terminal-label' });
    label(p, 'B', -56, -8, { cls: 'terminal-label' });
    return p;
}
const MOS_TERMS = { nmos: ['D', 'S'], pmos: ['S', 'D'] };
function mos(id, x, y, { polarity, name }) {
    const [top, bottom] = MOS_TERMS[polarity], p = make('mos', id, x, y, { polarity });
    pin(p, 'b', -48, 0, id + '.G'); pin(p, 't', 0, -TR, `${id}.${top}`); pin(p, 'e', 0, TR, `${id}.${bottom}`); box(p, -35, -35, 70, 70);
    label(p, `${id} · ${name}`, 50, -2); label(p, top, 9, -31, { cls: 'terminal-label' }); label(p, bottom, 9, 40, { cls: 'terminal-label' });
    label(p, 'G', -56, -8, { cls: 'terminal-label' });
    return p;
}
/** Digital transistor: a plain NPN with R1 in series with the base and R2 from base to emitter. No enclosing box. */
function dtc(id, x, y, { name }) {
    const p = make('dtc', id, x, y, { subHits: [id + '.R1', id + '.R2'] });
    pin(p, 'in', -96, 0, id + '.IN'); pin(p, 'b', -48, 0, id + '.B'); pin(p, 't', 0, -TR, id + '.C'); pin(p, 'e', 0, TR, id + '.E');
    pin(p, 'r1b', -48, 0, id + '.R1'); pin(p, 'r2b', -48, 54, id + '.R2');
    box(p, -35, -35, 70, 70); box(p, -84, -7, 26, 14); box(p, -55, 24, 14, 22);
    label(p, `${id} · ${name}`, 50, -8); label(p, 'digital NPN · R1/R2 내장', 50, 13, { cls: 'minor-label' });
    label(p, 'C', 9, -30, { cls: 'terminal-label' }); label(p, 'E', 9, 40, { cls: 'terminal-label' });
    label(p, 'R1', -71, -13, { cls: 'terminal-label', anchor: 'middle' }); label(p, 'R2', -62, 39, { cls: 'terminal-label', anchor: 'end' });
    label(p, 'IN', -96, 22, { cls: 'terminal-label' });
    return p;
}
function gpio(x, y, { model, state, notes = 'below' }) {
    const p = make('gpio', 'GPIO1', x, y);
    for (const [n, dx, dy] of [['r', 45, 0], ['l', -45, 0], ['t', 0, -19], ['b', 0, 19]]) pin(p, n, dx, dy, 'GPIO1.PIN');
    box(p, -45, -19, 90, 38); label(p, 'GPIO1', 0, 5, { anchor: 'middle' });
    const sub = [model, state].filter(Boolean);
    if (notes === 'left') sub.forEach((t, i) => label(p, t, -52, 0 + i * 17 - (sub.length - 1) * 8, { anchor: 'end', cls: 'minor-label' }));
    else {   // left-aligned at the canvas margin so a long model name never runs off the edge
        const first = notes === 'below' ? 36 : -38 - (sub.length - 1) * 17;
        sub.forEach((t, i) => label(p, t, 12 - x, first + i * 17, { anchor: 'start', cls: 'minor-label' }));
    }
    return p;
}
function rail(x, y) {   // y = the pin the wire starts from; the arrow points up
    const p = make('rail', 'VLED', x, y, { hit: null });
    pin(p, 'b', 0, 0, 'VLED'); label(p, 'VLED', 0, -26, { anchor: 'middle', cls: 'rail-label' });
    return p;
}
function ground(x, y) { // y = the pin the wire ends at; bars hang below it
    const p = make('ground', 'GND', x, y, { hit: null });
    pin(p, 't', 0, 0, 'GND'); label(p, 'GND', 0, 45, { anchor: 'middle', cls: 'minor-label' });
    return p;
}

/* ---------- scene builder ---------- */
class Scene {
    constructor() { this.parts = []; this.wires = []; }
    add(p) { this.parts.push(p); return p; }
    /** Polyline through the given points; the first and last must be pins (or points on another wire). */
    wire(net, ...pts) { this.wires.push({ net, points: pts.map(p => [p[0], p[1]]) }); }
}
export function buildScene(config, point) {
    const s = new Scene(), led1 = LEDS[config.led], id = config.topology, resistance = point?.config.resistance ?? config.resistance;
    const model = i => getDeviceModel(config.deviceModels?.[i])?.id ?? i;
    const stateText = config.deviceModels?.GPIO1 ? `요청 ${config.state} · 유효 ${point?.effectiveGpioState ?? '—'}` : null;
    const gpioPart = (x, y, notes) => s.add(gpio(x, y, { model: model('GPIO1'), state: stateText, notes }));
    const RLED = (x, y) => s.add(resV('RLED', x, y, { value: resistance, name: 'RLED' }));
    const LED = (x, y) => s.add(led(x, y, { color: led1.color, name: led1.id }));
    const X = 470, RAIL_Y = 44;
    let G = 14;
    // next centre below a previous pin
    const below = (prevY, lead) => prevY + G + lead;

    if (id === 'resistor' || id === 'gpio-source' || id === 'gpio-sink') {
        G = 16;
        let top, y0;
        if (id === 'gpio-source') { top = gpioPart(X, 45, 'left'); y0 = at(top, 'b')[1]; } else { top = s.add(rail(X, RAIL_Y)); y0 = RAIL_Y; }
        const r = RLED(X, below(y0, LEAD)), l = LED(X, below(r.pins.b.y, LEAD));
        s.wire('load', at(top, 'b'), at(r, 'a')); s.wire('load', at(r, 'b'), at(l, 'a'));
        if (id === 'gpio-sink') {
            const g = gpioPart(X, l.pins.k.y + 16 + 19, 'left');
            s.wire('load', at(l, 'k'), at(g, 't'));
        } else {
            const gnd = s.add(ground(X, l.pins.k.y + 70)); s.wire('load', at(l, 'k'), at(gnd, 't'));
        }
        return finish(s, id);
    }

    if (id === 'npn-follower') {
        const rl = s.add(rail(X, RAIL_Y)), q = s.add(bjt('Q1', X, below(RAIL_Y, TR), { polarity: 'npn', name: model('Q1') }));
        const r = RLED(X, below(q.pins.e.y, LEAD)), l = LED(X, below(r.pins.b.y, LEAD)), gnd = s.add(ground(X, l.pins.k.y + 56));
        s.wire('load', at(rl, 'b'), at(q, 't')); s.wire('load', at(q, 'e'), at(r, 'a')); s.wire('load', at(r, 'b'), at(l, 'a')); s.wire('load', at(l, 'k'), at(gnd, 't'));
        baseDrive(s, gpioPart, q, 'RB', config.baseResistance);
        return finish(s, id);
    }

    if (id === 'pnp-high' || id === 'pmos-high') {
        const rl = s.add(rail(X, RAIL_Y)), q = s.add((id === 'pnp-high' ? bjt : mos)('Q1', X, RAIL_Y + 80, { polarity: id === 'pnp-high' ? 'pnp' : 'pmos', name: model('Q1') }));
        const r = RLED(X, below(q.pins.e.y, LEAD)), l = LED(X, below(r.pins.b.y, LEAD)), gnd = s.add(ground(X, l.pins.k.y + 22));
        s.wire('load', at(rl, 'b'), at(q, 't')); s.wire('load', at(q, 'e'), at(r, 'a')); s.wire('load', at(r, 'b'), at(l, 'a')); s.wire('load', at(l, 'k'), at(gnd, 't'));
        if (id === 'pnp-high') baseDrive(s, gpioPart, q, 'RB', config.baseResistance);
        else {
            const g = baseDrive(s, gpioPart, q, 'RG', config.gateResistance), nodeX = 375;
            // RGS pulls the gate up to VLED: its top pin meets the rail-to-source wire
            const rgs = s.add(resV('RGS', nodeX, q.y - LEAD, { value: config.gatePull, name: 'RGS', terms: ['RGS.2', 'RGS.1'], side: 'left', net: 'drive' }));
            s.wire('drive', at(rgs, 'a'), [X, rgs.pins.a.y]);   // its bottom pin already sits on the gate wire
        }
        return finish(s, id);
    }

    if (id === 'npn-pnp' || id === 'npn-pmos' || id === 'nmos-pmos') return compound(s, config, point, { model, gpioPart, RLED, LED, id });

    // low-side family: digital-npn, npn-low, nmos-low, npn-current-sink
    G = id === 'npn-current-sink' ? 10 : 14;
    const rl = s.add(rail(X, RAIL_Y)), r = RLED(X, below(RAIL_Y, LEAD)), l = LED(X, below(r.pins.b.y, LEAD));
    const q = s.add(id === 'digital-npn' ? dtc('Q1', X, below(l.pins.k.y, TR), { name: model('Q1') })
        : id === 'nmos-low' ? mos('Q1', X, below(l.pins.k.y, TR), { polarity: 'nmos', name: model('Q1') })
        : bjt('Q1', X, below(l.pins.k.y, TR), { polarity: 'npn', name: model('Q1') }));
    s.wire('load', at(rl, 'b'), at(r, 'a')); s.wire('load', at(r, 'b'), at(l, 'a')); s.wire('load', at(l, 'k'), at(q, 't'));
    let bottom = q;
    if (id === 'npn-current-sink') {
        const re = s.add(resV('RE', X, below(q.pins.e.y, LEAD), { value: config.emitterResistance, name: 'RE' }));
        s.wire('load', at(q, 'e'), at(re, 'a')); bottom = re;
    }
    const exit = at(bottom, bottom.kind === 'resV' ? 'b' : 'e'), gnd = s.add(ground(X, exit[1] + (id === 'nmos-low' ? 40 : id === 'npn-current-sink' ? 10 : id === 'digital-npn' ? 40 : 22)));
    s.wire('load', exit, at(gnd, 't'));
    if (id === 'digital-npn') {
        const g = gpioPart(75, q.y, 'above');
        s.wire('drive', at(g, 'r'), at(q, 'in'));
        s.wire('drive', at(q, 'r2b'), [X, q.pins.r2b.y]);           // R2 returns to the emitter line
    } else if (id === 'nmos-low') {
        const g = baseDrive(s, gpioPart, q, 'RG', config.gateResistance), nodeX = 375;
        const rgs = s.add(resV('RGS', nodeX, g.y + LEAD, { value: config.gatePull, name: 'RGS', side: 'left', net: 'drive' }));
        s.wire('drive', at(rgs, 'b'), [X, rgs.pins.b.y]);   // its top pin already sits on the gate wire
    } else baseDrive(s, gpioPart, q, 'RB', config.baseResistance);
    return finish(s, id);
}

/** GPIO box on the left, a series resistor, and an explicit wire on to the base/gate pin. Returns the base pin. */
function baseDrive(s, gpioPart, q, name, value) {
    const g = gpioPart(75, q.y, 'above'), [bx, by] = at(q, 'b');
    const r = s.add(resH(name, 160, 250, by, { value, name }));
    s.wire('drive', at(g, 'r'), at(r, 'a')); s.wire('drive', at(r, 'b'), [bx, by]);
    return { x: bx, y: by };
}

function compound(s, config, point, { model, gpioPart, RLED, LED, id }) {
    const outputBjt = id === 'npn-pnp', inputBjt = id !== 'nmos-pmos', X2 = 540, JY = 56, YJ = JY + 68;
    const rl = s.add(rail(X2, 44));
    const q2 = s.add((outputBjt ? bjt : mos)('Q2', X2, YJ, { polarity: outputBjt ? 'pnp' : 'pmos', name: model('Q2') }));
    const r = RLED(X2, q2.pins.e.y + 14 + LEAD), l = LED(X2, r.pins.b.y + 14 + LEAD), gnd2 = s.add(ground(X2, l.pins.k.y + 22));
    s.wire('load', at(rl, 'b'), at(q2, 't')); s.wire('load', at(q2, 'e'), at(r, 'a')); s.wire('load', at(r, 'b'), at(l, 'a')); s.wire('load', at(l, 'k'), at(gnd2, 't'));

    const rbe = s.add(resV(outputBjt ? 'RBE' : 'RGS_OUT', 450, YJ - LEAD, { value: config.gatePull, name: outputBjt ? 'RBE' : 'RGS(out)', terms: [(outputBjt ? 'RBE' : 'RGS_OUT') + '.2', (outputBjt ? 'RBE' : 'RGS_OUT') + '.1'], side: 'left', net: 'drive' }));
    s.wire('drive', at(rbe, 'a'), [X2, rbe.pins.a.y]);                          // top pin meets the rail wire
    const drive = s.add(resH('Rdrive', 330, 410, YJ, { value: config.gateResistance, name: 'Rdrive', labelAt: 'below' }));
    s.wire('drive', at(drive, 'b'), [450, YJ], [q2.pins.b.x, YJ]);               // to the Q2 base/gate, passing the RBE bottom pin

    const q1y = 300, Q1X = 275, q1 = s.add((inputBjt ? bjt : mos)('Q1', Q1X, q1y, { polarity: inputBjt ? 'npn' : 'nmos', name: model('Q1') }));
    s.wire('drive', at(q1, 't'), [Q1X, YJ], at(drive, 'a'));
    const gnd1 = s.add(ground(Q1X, q1.pins.e.y + (inputBjt ? 22 : 40))); s.wire('load', at(q1, 'e'), at(gnd1, 't'));
    const g = gpioPart(70, q1y, 'above');
    if (inputBjt) {
        const rb = s.add(resH('RB', 140, 200, q1y, { value: config.baseResistance, name: 'RB' }));
        s.wire('drive', at(g, 'r'), at(rb, 'a')); s.wire('drive', at(rb, 'b'), at(q1, 'b'));
    } else {
        const nodeX = 213, rg = s.add(resH('RG', 140, 200, q1y, { value: config.gateResistance, name: 'RG' }));
        s.wire('drive', at(g, 'r'), at(rg, 'a')); s.wire('drive', at(rg, 'b'), [nodeX, q1y], at(q1, 'b'));
        const rgs = s.add(resV('RGS_IN', nodeX, q1y + LEAD, { value: config.gatePull, name: 'RGS(in)', terms: ['RGS_IN.1', 'RGS_IN.2'], side: 'left', net: 'drive' }));
        s.wire('drive', at(rgs, 'b'), [Q1X, rgs.pins.b.y]);
    }
    return finish(s, id);
}

function finish(s, id) { return { topology: id, view: VIEW, parts: s.parts, wires: s.wires }; }

/* ---------- derived geometry (also used by the tests) ---------- */
const segments = pts => pts.slice(1).map((b, i) => [pts[i], b]);
export const wireSegments = scene => scene.wires.flatMap(w => segments(w.points).map(([a, b]) => ({ a, b, net: w.net })));
const onSegment = (pt, [a, b]) => (a[0] === b[0] ? pt[0] === a[0] && pt[1] >= Math.min(a[1], b[1]) && pt[1] <= Math.max(a[1], b[1])
    : a[1] === b[1] ? pt[1] === a[1] && pt[0] >= Math.min(a[0], b[0]) && pt[0] <= Math.max(a[0], b[0]) : false);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Points where three or more wire ends/passes meet (drawn as a dot). */
export function junctions(scene) {
    const ends = scene.wires.flatMap(w => [w.points[0], w.points.at(-1)]), segs = wireSegments(scene).map(s => [s.a, s.b]), out = [];
    for (const e of ends) {
        if (out.some(p => same(p, e))) continue;
        const touching = scene.wires.filter(w => w.points.some(p => same(p, e)) || segments(w.points).some(sg => onSegment(e, sg))).length;
        const pins = scene.parts.flatMap(p => Object.values(p.pins)).filter(p => p.x === e[0] && p.y === e[1]).length;
        if (touching + pins >= 3 || (touching >= 2 && segs.some(sg => onSegment(e, sg) && !sg.some(p => same(p, e))))) out.push(e);
    }
    return out;
}

/** Connectivity drawn by the wires, as groups of template terminal names. */
export function drawnNets(scene) {
    const parent = new Map(), key = p => p[0] + ',' + p[1];
    const find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); parent.set(k, r); return r; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    const segs = wireSegments(scene);
    for (const w of scene.wires) segments(w.points).forEach(([a, b]) => union(key(a), key(b)));
    const nodes = [...scene.wires.flatMap(w => w.points), ...scene.parts.flatMap(p => Object.values(p.pins).map(q => [q.x, q.y]))];
    // a wire end or a pin that lies on a wire is connected to it (T-junctions); a plain crossing is not a node
    for (const pt of nodes) for (const sg of segs) if (onSegment(pt, [sg.a, sg.b])) union(key(pt), key(sg.a));
    // Terminals with the same name are one node in the template (every GND, every side of the GPIO box), so merge them.
    const byTerm = new Map(), tfind = t => { if (!byTerm.has(t)) byTerm.set(t, t); let r = t; while (byTerm.get(r) !== r) r = byTerm.get(r); byTerm.set(t, r); return r; };
    const rootTerm = new Map();
    for (const p of scene.parts) for (const q of Object.values(p.pins)) {
        if (!q.term) continue;
        const root = find(key([q.x, q.y]));
        if (rootTerm.has(root)) { const ra = tfind(rootTerm.get(root)), rb = tfind(q.term); if (ra !== rb) byTerm.set(ra, rb); } else rootTerm.set(root, q.term);
        tfind(q.term);
    }
    const groups = new Map();
    for (const t of byTerm.keys()) { const r = tfind(t); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
    return [...groups.values()].map(g => g.sort()).sort((a, b) => a.join().localeCompare(b.join()));
}
