// Measures the synchronous cost of the sampled sensitivity run (not part of CI: timings depend on the machine).
// Usage: node scripts/measure_sensitivity.mjs
import { analyzeCorners, analyzePoint } from '../src/core/analysis.js';
import { freshConfig, transitionConfig, TOPOLOGIES } from '../src/core/topologies.js';

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
function time(fn, runs = 7) {
    fn(); // warm-up
    const t = [];
    for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); }
    return { median: median(t), max: Math.max(...t) };
}
const rows = [];
for (const topology of TOPOLOGIES) {
    const config = transitionConfig(freshConfig(), topology.id);
    if (!analyzePoint(config).ok) { rows.push({ topology: topology.id, note: 'nominal not computable at defaults' }); continue; }
    const r = time(() => analyzeCorners(config)), count = analyzeCorners(config).count;
    rows.push({ topology: topology.id, scenarios: count, 'median ms': +r.median.toFixed(1), 'max ms': +r.max.toFixed(1) });
}
const dtc = time(() => analyzeCorners(freshConfig(), { includeDtc: true }));
rows.push({ topology: 'digital-npn + DTC sweep', scenarios: 729, 'median ms': +dtc.median.toFixed(1), 'max ms': +dtc.max.toFixed(1) });
console.table(rows);
