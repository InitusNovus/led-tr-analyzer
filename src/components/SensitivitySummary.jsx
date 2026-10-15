import React from 'react';
import { LEDS, getDeviceModel } from '../data/catalog.js';
import { CORNER_PHASE_TEXT } from '../ui/viewModel.js';

const amount = (v, scale = 1, unit = '') => v == null || !Number.isFinite(v) ? '—'
    : (v * scale).toLocaleString('en-US', { maximumSignificantDigits: 4 }) + (unit ? ' ' + unit : '');
const AXIS_FORMAT = { V: v => amount(v, 1, 'V'), 'Ω': v => amount(v, 1, 'Ω'), '×': v => '×' + amount(v), '': v => amount(v) };
export const axisValue = (axis, v) => (AXIS_FORMAT[axis.unit] ?? AXIS_FORMAT[''])(v);
const METRICS = {
    current: ['LED 전류', 'mA'], resistorPower: ['RLED 전력', 'mW'],
    driverPower: ['Driver 손실', 'mW'], inputPower: ['입력 전력', 'mW'],
};
const sweptText = corners => corners.axes.swept.map(a =>
    a.label + ' ' + axisValue(a, Math.min(...a.values)) + '–' + axisValue(a, Math.max(...a.values))).join(' · ');

/** Nominal current next to the sampled extrema. Says what was sampled; never a guaranteed worst case. */
export function SensitivityRibbon({ point, corners, phase, progress }) {
    const cur = corners?.extrema?.current;
    const showRange = cur && (phase === 'complete' || phase === 'partial');
    const nominal = point?.current;
    let marks = null;
    if (showRange && Number.isFinite(nominal)) {
        // Pad the scale so the sampled span reads as a range inside the track instead of filling it.
        const low = Math.min(cur.min.value, nominal), high = Math.max(cur.max.value, nominal), pad = (high - low || high || 1) * 0.25;
        const lo = Math.max(0, low - pad), span = high + pad - lo;
        marks = { from: (cur.min.value - lo) / span * 100, to: (cur.max.value - lo) / span * 100, nominal: (nominal - lo) / span * 100 };
    }
    const failureMessages = phase === 'partial' ? [...new Set(corners.failures.map(f => f.error?.message))].filter(Boolean).slice(0, 3) : [];
    const spread = corners?.opticalSpread;
    return <div className="sensitivity-ribbon" data-phase={phase} data-testid="sensitivity-ribbon">
        <div className="ribbon-head"><strong>LED 전류 · Nominal과 sampled Min–Max</strong><em>{CORNER_PHASE_TEXT[phase]}{phase === 'running' && progress ? ' ' + progress.done + '/' + progress.total : ''}</em></div>
        {showRange ? <>
            <div className="ribbon-track" role="img"
                aria-label={'sampled 최소 ' + amount(cur.min.value, 1000, 'mA') + ', nominal ' + amount(nominal, 1000, 'mA') + ', sampled 최대 ' + amount(cur.max.value, 1000, 'mA')}>
                {marks && <><i className="ribbon-span" style={{ left: marks.from + '%', width: Math.max(marks.to - marks.from, 0.8) + '%' }} />
                    <i className="ribbon-nominal" style={{ left: marks.nominal + '%' }} /></>}
            </div>
            <div className="ribbon-values">
                <span><small>Sampled Min</small><b data-ribbon="min">{amount(cur.min.value, 1000, 'mA')}</b></span>
                <span><small>Nominal</small><b data-ribbon="nominal">{amount(nominal, 1000, 'mA')}</b></span>
                <span><small>Sampled Max</small><b data-ribbon="max">{amount(cur.max.value, 1000, 'mA')}</b></span>
            </div>
            <small>{corners.validCount}/{corners.count}개 지정 시나리오의 sampled extrema이며 보증 worst case가 아닙니다. 스윕: {sweptText(corners)}</small>
        </> : <p className="subtle">{phase === 'stale' ? '입력이 바뀌어 이전 sampled 결과를 버렸습니다. 다시 실행하면 현재 값으로 계산합니다.'
            : phase === 'running' ? '입력이 멈추면 표본을 자동으로 계산합니다. 계산 중에도 입력할 수 있습니다.'
            : phase === 'error' ? corners.error
            : phase === 'idle' ? '아직 sampled 분석을 실행하지 않았습니다. Nominal 값만 표시됩니다.' : '동작점이 없어 sampled 분석을 할 수 없습니다.'}</p>}
        {phase === 'partial' && <small className="ribbon-partial" role="status">
            {corners.failures.length}/{corners.count}개 조건은 모델 적용범위 밖이라 제외했습니다. 위 범위는 계산된 {corners.validCount}개만의 결과입니다.
            {failureMessages.length > 0 && ' (' + failureMessages.join(' / ') + ')'}</small>}
        {spread && (spread.binAtNominal || spread.electricalOnly) && <div className="ribbon-optical">
            {spread.binAtNominal && <span>광도 bin 범위(공칭 전류): {amount(spread.binAtNominal.min, 1, 'mcd')} … {amount(spread.binAtNominal.max, 1, 'mcd')}</span>}
            {spread.electricalOnly && <span>전기 조건 변동만({spread.electricalOnly.basis === 'typ' ? 'typ' : '중간 대표값'} 기준): {amount(spread.electricalOnly.min, 1, 'mcd')} … {amount(spread.electricalOnly.max, 1, 'mcd')}</span>}
            {spread.combined && Number.isFinite(spread.combined.min) && <span>둘을 결합한 추정: {amount(spread.combined.min, 1, 'mcd')} … {amount(spread.combined.max, 1, 'mcd')}</span>}
            <small>bin 범위와 전기 변동은 서로 다른 불확실성입니다. 확률·제조 보증이 아닙니다.</small>
        </div>}
    </div>;
}

const appliedDevices = config => [
    ['LED1', LEDS[config.led]?.name ?? config.led],
    ...Object.entries(config.deviceModels ?? {}).map(([slot, id]) => [slot, getDeviceModel(id)?.name ?? id]),
];

/** Which input values produced each sampled extreme, next to nominal, plus everything that was not swept. */
export function SensitivityWitness({ corners, point, config }) {
    if (!corners || corners.error) return null;
    return <div className="witness" data-testid="sensitivity-witness">
        {Object.entries(corners.extrema).map(([metric, e]) => {
            if (!e || (e.min.value === 0 && e.max.value === 0)) return null;
            const [label, unit] = METRICS[metric];
            return <details key={metric} data-metric={metric}>
                <summary>{label}: {amount(e.min.value, 1000)} – {amount(e.max.value, 1000)} {unit}</summary>
                <div className="table-scroll"><table><thead><tr><th>조건</th><th>Nominal</th><th>최소가 나온 조건</th><th>최대가 나온 조건</th></tr></thead><tbody>
                    {corners.axes.swept.map(a => <tr key={a.key}>
                        <th>{a.label}</th><td>{axisValue(a, a.nominal)}</td>
                        <td className={e.min.scenario[a.key] !== a.nominal ? 'witness-moved' : ''}>{axisValue(a, e.min.scenario[a.key])}</td>
                        <td className={e.max.scenario[a.key] !== a.nominal ? 'witness-moved' : ''}>{axisValue(a, e.max.scenario[a.key])}</td></tr>)}
                    <tr className="witness-result"><th>{label}</th><td>{amount(point?.[metric], 1000, unit)}</td>
                        <td>{amount(e.min.value, 1000, unit)}</td><td>{amount(e.max.value, 1000, unit)}</td></tr>
                </tbody></table></div>
            </details>;
        })}
        <p className="subtle">스윕하지 않은 조건(공칭값 유지): {corners.axes.fixed.map(f => f.label + (f.value != null ? ' ' + amount(f.value, 1, f.unit) : '')).join(' · ')}</p>
        <p className="subtle">적용된 소자: {appliedDevices(config).map(([slot, name]) => slot + ' ' + name).join(' · ')}</p>
        <p className="subtle">{corners.note}</p>
    </div>;
}
