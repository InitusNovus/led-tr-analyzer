import test from 'node:test';
import assert from 'node:assert/strict';
import { freshConfig, transitionConfig } from '../src/core/topologies.js';
import { analyzeCorners } from '../src/core/analysis.js';
import { startCornerRun } from '../src/ui/cornerRunner.js';

const run = (config, opts = {}) => new Promise((resolve, reject) => {
    const progress = [];
    const cancel = startCornerRun(config, { ...opts, onProgress: p => progress.push(p), onDone: result => resolve({ result, progress, cancel }), onError: reject });
});
const tick = ms => new Promise(r => setTimeout(r, ms));

test('chunked run returns exactly what the synchronous analysis returns', async () => {
    const config = transitionConfig(freshConfig(), 'npn-low');
    const { result } = await run(config, { budgetMs: 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(result)), JSON.parse(JSON.stringify(analyzeCorners(config))));
});

test('the run yields between slices and reports monotonic progress', async () => {
    const { progress, result } = await run(freshConfig(), { budgetMs: 0 });
    assert.ok(progress.length > 10, 'many slices, got ' + progress.length);
    for (let i = 1; i < progress.length; i++) assert.ok(progress[i].done > progress[i - 1].done);
    assert.equal(progress.at(-1).total, 81);
    assert.ok(progress.at(-1).done < 81);
    assert.equal(result.count, 81);
});

test('a generous time budget finishes in fewer slices', async () => {
    const tight = await run(freshConfig(), { budgetMs: 0 }), loose = await run(freshConfig(), { budgetMs: 1000 });
    assert.ok(loose.progress.length < tight.progress.length);
    assert.equal(loose.progress.length, 0, 'one slice when the budget covers the whole run');
});

test('result is delivered asynchronously, never inside startCornerRun', async () => {
    let doneSync = false, returned = false;
    const done = new Promise(resolve => {
        startCornerRun(freshConfig(), { onDone: () => { doneSync = !returned; resolve(); } });
        returned = true;
    });
    await done;
    assert.equal(doneSync, false);
});

test('cancel stops the run: no further progress and no result', async () => {
    let doneCalled = false, progressAfterCancel = 0, cancelled = false;
    const cancel = startCornerRun(freshConfig(), {
        budgetMs: 0,
        onProgress: () => { if (cancelled) progressAfterCancel++; else { cancelled = true; cancel(); } },
        onDone: () => { doneCalled = true; },
    });
    await tick(100);
    assert.equal(doneCalled, false);
    assert.equal(progressAfterCancel, 0);
});

test('cancelling before the first slice runs never calls back', async () => {
    let called = false;
    const cancel = startCornerRun(freshConfig(), { onProgress: () => { called = true; }, onDone: () => { called = true; }, onError: () => { called = true; } });
    cancel();
    await tick(50);
    assert.equal(called, false);
});

test('invalid input is reported through onError', async () => {
    await assert.rejects(run({ ...freshConfig(), vcc: '' }), e => e.code === 'invalid-input');
});
