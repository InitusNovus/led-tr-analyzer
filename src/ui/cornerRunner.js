import { planCorners, evaluateCorner, summarizeCorners } from '../core/analysis.js';

/**
 * Runs a sampled sensitivity analysis in time-boxed slices so the UI thread is released between slices,
 * and returns a cancel function. The result is identical to the synchronous analyzeCorners().
 * Some topologies need ~4 ms per scenario (emitter follower, current sink), so one 81-scenario pass would
 * otherwise block input for 0.25-0.4 s.
 */
export function startCornerRun(config, { includeDtc = false, budgetMs = 12, onProgress, onDone, onError,
    schedule = setTimeout, cancelScheduled = clearTimeout, now = () => performance.now() } = {}) {
    let cancelled = false, timer = null;
    const fail = e => { if (!cancelled) onError?.(e); };
    let plan;
    try { plan = planCorners(config, { includeDtc }); } catch (e) { timer = schedule(() => fail(e), 0); return () => { cancelled = true; cancelScheduled(timer); }; }
    const outcomes = [], total = plan.scenarios.length;
    const step = () => {
        timer = null;
        if (cancelled) return;
        try {
            const start = now();
            do outcomes.push(evaluateCorner(plan, outcomes.length));
            while (outcomes.length < total && now() - start < budgetMs);
            if (outcomes.length < total) {
                onProgress?.({ done: outcomes.length, total });
                timer = schedule(step, 0);
                return;
            }
            onDone?.(summarizeCorners(plan, outcomes));
        } catch (e) { fail(e); }
    };
    timer = schedule(step, 0);
    return () => { cancelled = true; if (timer !== null) cancelScheduled(timer); };
}
