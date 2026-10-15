import React from 'react';
import { buildWarnings, powerBudget } from '../core/warnings.js';
import { PACKAGE_PRESETS } from '../data/catalog.js';
import { CORNER_PHASE_TEXT, formatQuantity, formatSigned } from '../ui/viewModel.js';
import { axisValue } from './SensitivitySummary.jsx';

const SEVERITY_TEXT = { exceeded: '한계 초과', margin: '여유 부족', unknown: '정격 미확인', approximation: '모델 근사' };
const SCOPE_TEXT = { nominal: 'Nominal', sampled: 'Sampled' };
const pct = (r, digits = 0) => r == null ? '—' : (r * 100).toFixed(digits) + '%';

function Finding({ f, validCount, onInspect, onFocusInput }) {
    const q = v => formatQuantity(v, f.unit);
    const over = f.excess != null ? formatSigned(f.excess, f.unit) + (f.excessPct != null ? ' (' + (f.excessPct >= 0 ? '+' : '−') + Math.abs(f.excessPct).toFixed(1) + '%)' : '') : null;
    return <div className="design-alert warning" data-severity={f.severity} data-scope={f.scope} data-rule={f.ruleId} data-instance={f.instanceId}>
        <div className="warning-head">
            <b className="warning-badge severity">{SEVERITY_TEXT[f.severity]}</b><b className="warning-badge scope">{SCOPE_TEXT[f.scope]}</b>
            <span className="warning-title">{f.id}</span>
        </div>
        {f.severity === 'exceeded' && f.scope === 'nominal' && <span className="warning-measure">{q(f.actual)} &gt; 한계 {q(f.limit)} · 초과 {over}</span>}
        {f.severity === 'exceeded' && f.scope === 'sampled' && <>
            <span className="warning-measure">계산한 {validCount ?? f.total}개 조건 중 {f.count}개에서 초과 · 최악 {q(f.actual)} &gt; 한계 {q(f.limit)} · 초과 {over}</span>
            <span className="warning-cause">최악 조건: {f.scenario.length ? f.scenario.map(d => d.label + ' ' + axisValue(d, d.value) + ' (nominal ' + axisValue(d, d.nominal) + ')').join(' · ') : '공칭 조건과 같음'}</span>
        </>}
        {f.severity === 'margin' && <span className="warning-measure">{q(f.actual)} / {q(f.limit)} = {f.usagePct.toFixed(1)}% · 직접 정한 여유 경고 기준 {f.marginPct}% 이상 (한계 초과는 아님)</span>}
        {f.severity === 'unknown' && <span className="warning-measure">이 조건의 정격 데이터가 없어 검사하지 못했습니다.{f.condition ? ' ' + f.condition : ''}</span>}
        {(f.inputs.length > 0 || f.instanceId) && f.severity !== 'approximation' && <div className="warning-actions">
            {f.inputs.length > 0 && <button type="button" data-action="focus" data-input={f.inputs[0].id} onClick={() => onFocusInput(f.inputs.map(i => i.id))}>입력 수정: {f.inputs[0].label}</button>}
            {f.inputs.slice(1, 4).map(i => <button type="button" className="chip" key={i.id} data-input={i.id} onClick={() => onFocusInput([i.id])}>{i.label}</button>)}
            {f.instanceId && <button type="button" className="chip" data-action="inspect" onClick={() => onInspect(f.instanceId)}>{f.instanceId} 보기</button>}
        </div>}
    </div>;
}

export function WarningSummary({ config, point, validation, corners, cornerPhase, marginPct, view, onInspect, onFocusInput }) {
    if (!point) return null;
    const w = buildWarnings({ config, point, validation, corners, cornerPhase, marginPct, view });
    const cards = w.findings.filter(f => f.severity !== 'approximation'), approx = w.findings.filter(f => f.severity === 'approximation');
    const s = w.sampled;
    const sampledNote = s.phase === 'complete' ? (s.violationCount ? null : 'Sampled ' + s.count + '개 조건에서 한계 초과 없음 (보증 worst case 아님)')
        : s.phase === 'partial' ? s.excluded + '개 조건은 모델 적용범위 밖이라 제외했습니다. Sampled 항목은 계산된 ' + s.validCount + '개 기준이며 전체 범위의 보증이 아닙니다.'
        : 'Sampled 한계 검사: ' + CORNER_PHASE_TEXT[s.phase] + (s.phase === 'stale' ? ' — 이전 결과는 현재 입력에 맞지 않아 표시하지 않습니다.' : '');
    return <div className="design-warnings" data-testid="warnings">
        {cards.map(f => <Finding key={f.key} f={f} validCount={s.validCount} onInspect={onInspect} onFocusInput={onFocusInput} />)}
        {sampledNote && <p className="warning-scope-note" data-phase={s.phase} role="status">{sampledNote}</p>}
        {w.marginPct == null && <p className="warning-scope-note">여유 경고 기준이 비어 있어 여유 부족 경고를 표시하지 않습니다.</p>}
        {approx.length > 0 && <details className="warning-approx"><summary>모델 근사·외삽·미모델링 {approx.length}건</summary>
            <ul>{approx.map(f => <li key={f.key} data-severity="approximation">{f.text}</li>)}</ul></details>}
    </div>;
}

export function PowerBudget({ config, point, corners, cornerPhase, onApplyPreset }) {
    const b = powerBudget({ config, point, corners, presets: PACKAGE_PRESETS });
    if (!b) return null;
    const scale = Math.max(1.15, (b.nominalRatio ?? 0) * 1.1, (b.peakRatio ?? 0) * 1.1);
    const at = r => Math.min(100, Math.max(0, r / scale * 100)) + '%';
    const peakText = b.sampledPeak != null ? pct(b.peakRatio) + ' (' + formatQuantity(b.sampledPeak, 'W') + ')'
        + (b.peakRatio > 1 ? ' · 예산 초과 ' + formatSigned(b.sampledPeak - b.limit, 'W') : '') : CORNER_PHASE_TEXT[cornerPhase ?? 'idle'];
    const targetPreset = b.exceeds && b.recommendation && b.recommendation.rated > b.rated ? b.recommendation : null;
    return <div className="design-power" data-testid="power-budget" data-exceeds={b.exceeds ? 'yes' : 'no'}>
        <div className="design-power-head"><strong>RLED 전력 예산</strong>
            <span>{formatQuantity(b.nominal, 'W')} / {formatQuantity(b.limit, 'W')}</span></div>
        <small className="power-formula">입력 예산 {formatQuantity(b.limit, 'W')} = 정격 {formatQuantity(b.rated, 'W')} × 사용 비율 {b.derating}</small>
        <div role="img" className="power-meter" aria-label={'RLED 전력: nominal ' + pct(b.nominalRatio) + (b.sampledPeak != null ? ', sampled peak ' + pct(b.peakRatio) : '') + ', 입력 예산 100%'}>
            <span className="power-fill" data-marker="nominal" style={{ width: at(b.nominalRatio) }} />
            <i className="power-line" data-marker="budget" style={{ left: at(1) }} title="입력 예산 100%" />
            {b.ratedRatio != null && b.ratedRatio <= scale && <i className="power-line rated" data-marker="rated" style={{ left: at(b.ratedRatio) }} title="정격 (사용 비율 적용 전)" />}
            {b.sampledPeak != null && <i className="power-peak" data-marker="sampled" style={{ left: at(b.peakRatio) }} title="Sampled peak" />}
        </div>
        <div className="design-secondary">
            <span data-power="nominal">Nominal 사용률 <b>{pct(b.nominalRatio)}</b></span>
            <span data-power="sampled">Sampled peak <b>{peakText}</b></span>
        </div>
        {b.exceeds && b.requiredRated != null && <div className="power-need" data-power="required">
            {b.basisKind === 'sampled' ? 'Sampled peak' : 'Nominal'} 기준 필요 정격 ≥ <b>{formatQuantity(b.requiredRated, 'W')}</b> (사용 비율 {b.derating} 기준)</div>}
        <div className="subtle">Generic 패키지 비교(입력 예산 기준): {b.exceeds
            ? (b.recommendation ? b.recommendation.key + ' (' + formatQuantity(b.recommendation.rated, 'W') + ') 이상이면 예산 안' : '등록 preset 중 후보 없음')
            : '현재 입력 예산 안' + (b.recommendation ? ' · 최소 ' + b.recommendation.key : '')}.
            제조사 보증이나 실제 부품 정격이 아닙니다.</div>
        {targetPreset && <button type="button" className="primary" data-action="apply-preset" data-preset={targetPreset.key}
            onClick={() => onApplyPreset(targetPreset.rated)}>{targetPreset.key} ({formatQuantity(targetPreset.rated, 'W')})로 정격 설정하고 다시 검증</button>}
    </div>;
}
