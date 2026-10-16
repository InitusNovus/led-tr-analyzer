import React from 'react';
import { buildWarnings } from '../core/warnings.js';
import { goalVerdict, CORNER_PHASE_TEXT } from '../ui/viewModel.js';

const amount = (v, scale = 1, unit = '') => v == null || !Number.isFinite(v) ? '—'
    : (v * scale).toLocaleString('en-US', { maximumSignificantDigits: 4 }) + (unit ? ' ' + unit : '');

function opticalText(optical) {
    if (!optical) return '—';
    if (optical.kind === 'range') return amount(optical.minMcd, 1, 'mcd') + ' … ' + amount(optical.maxMcd, 1, 'mcd');
    if (optical.kind === 'unavailable') return '미모델링';
    return amount(optical.nominalMcd, 1, 'mcd');
}

/** One-line result that stays visible while the controls below are edited. Every field repeats a value shown in the summary. */
export default function ResultStrip({ point, validation, corners, cornerPhase, goal, config, marginPct, error }) {
    if (!point) return <div className="result-strip" role="status" data-testid="result-strip" data-state="error">
        <span><small>결과</small><b>{error ? '계산할 수 없는 조건' : '동작점 미계산'}</b></span></div>;
    const cur = corners?.extrema?.current, ranged = cur && (cornerPhase === 'complete' || cornerPhase === 'partial');
    const w = buildWarnings({ config: point.config ?? config, point, validation, corners, cornerPhase, marginPct });
    const nominalOver = w.findings.filter(f => f.severity === 'exceeded' && f.scope === 'nominal').length;
    const sampledOver = w.findings.filter(f => f.severity === 'exceeded' && f.scope === 'sampled').length;
    const margin = w.findings.filter(f => f.severity === 'margin' || f.severity === 'unknown').length;
    const goToWarnings = () => {
        const el = document.querySelector('[data-testid="warnings"]');
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.setAttribute('data-focus-flash', '1'); setTimeout(() => el.removeAttribute('data-focus-flash'), 1800); }
    };
    const sampled = cornerPhase === 'complete' || cornerPhase === 'partial'
        ? (sampledOver ? '초과 ' + sampledOver + '건' : '초과 없음') : CORNER_PHASE_TEXT[cornerPhase ?? 'idle'];
    return <div className="result-strip" role="status" data-testid="result-strip" data-state={nominalOver || sampledOver ? 'exceeded' : 'ok'}>
        <span data-strip="current"><small>LED 전류</small><b>{amount(point.current, 1000, 'mA')}</b>
            {ranged && <em>sampled {amount(cur.min.value, 1000)}–{amount(cur.max.value, 1000, 'mA')}</em>}</span>
        <span data-strip="optical"><small>광도</small><b>{opticalText(point.optical)}</b></span>
        {goal && <span data-strip="goal" data-status={goal.status}><small>목표</small><b>{goalVerdict(goal)}</b></span>}
        <span data-strip="nominal"><small>Nominal</small><b>{validation?.label ?? '—'}</b></span>
        <span data-strip="sampled" data-over={sampledOver}><small>Sampled</small><b>{sampled}</b></span>
        {(nominalOver + sampledOver + margin) > 0 && <button type="button" className="link-button" data-action="strip-warnings" onClick={goToWarnings}>
            경고 {nominalOver + sampledOver + margin}건 ▸</button>}
    </div>;
}
