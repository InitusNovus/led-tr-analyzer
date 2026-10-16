import Help from './Help.jsx';
import React from 'react';
import { qPointSummary } from '../core/qpoint.js';
import { SOURCES, getDeviceModel } from '../data/catalog.js';

const amount = (v, scale = 1, unit = '') => v == null || !Number.isFinite(v) ? '—'
    : (v * scale).toLocaleString('en-US', { maximumSignificantDigits: 4 }) + (unit ? ' ' + unit : '');
const mA = v => amount(v, 1000, 'mA');
const ratio = v => amount(v);

function KvlPath({ path, kind }) {
    const widest = Math.max(path.rail, ...path.terms.map(t => t.value), 1e-9);
    return <div className={'qpoint-path ' + kind} data-path={path.id}>
        <div className="qpoint-path-head"><strong>{path.title}</strong>
            <span>{path.railLabel} {amount(path.rail, 1, 'V')} = Σ {amount(path.sum, 1, 'V')}</span></div>
        <div className="voltage-segments">
            {path.terms.map(t => <div key={t.id} className="voltage-segment" data-term={t.id} style={{ flexGrow: Math.max(1, t.value / widest * 100) }}>
                <span>{t.label}</span><b>{amount(t.value, 1, 'V')}</b>{t.current != null && <small>{t.currentLabel} {mA(t.current)}</small>}
            </div>)}
        </div>
        {Math.abs(path.residual) > 1e-6 && <small className="qpoint-residual" role="status">전압 합 잔차 {amount(path.residual, 1, 'V')}</small>}
    </div>;
}

function Figures({ list }) {
    if (!list?.length) return null;
    return <small className="qpoint-figures">근거: {list.map(f => f.label + ' ' + f.figure + ' (' + f.conditions + ')').join(' · ')}</small>;
}

function BjtRow({ d, onInspect }) {
    const part = getDeviceModel(d.modelId), src = part ? SOURCES[part.source] : null;
    const regionText = d.region === 'active' ? '활성 영역: IC/IB가 hFE를 따릅니다. 이 회로에서 의도된 동작일 수 있어 자동으로 불량 판정하지 않습니다.'
        : d.region === 'transition' ? '활성↔포화 전이: 두 앵커를 로그 보간한 근사입니다.'
        : d.region === 'saturated' ? '포화 영역: 시험 IC/IB 조건의 VCE(sat) 곡선과 비교하는 값입니다.' : null;
    return <div className="qpoint-device" data-device={d.instanceId} data-kind="bjt">
        <div className="qpoint-device-head"><b>{d.instanceId}</b><span>{d.role}</span><em>{d.region}</em>
            <button type="button" className="link-button" onClick={() => onInspect?.(d.instanceId)}>부품 상세</button></div>
        <div className="qpoint-metrics">
            <span><small>IC</small><b>{mA(d.ic)}</b></span><span><small>IB</small><b>{mA(d.ib)}</b></span><span><small>IE</small><b>{mA(d.ie)}</b></span>
            <span><small>IC/IB (실제)</small><b data-metric="forced-ratio">{ratio(d.forcedRatio)}</b></span>
            <span><small>hFE (이 IC)</small><b>{ratio(d.activeGain)}</b></span>
            <span><small>시험 IC/IB</small><b>{ratio(d.testRatio)}</b></span>
        </div>
        {regionText && <small>{regionText}</small>}
        {d.ratioMismatch && <small className="qpoint-warn">이 모델의 VCE(sat)와 VBE(sat) 그래프는 서로 다른 IC/IB 조건입니다(근사 anchor).</small>}
        <Figures list={d.figures} />
        {src?.url && <a href={src.url} target="_blank" rel="noreferrer">데이터시트: {src.manufacturer} · {src.revision}</a>}
    </div>;
}

function DigitalRow({ d, onInspect }) {
    const part = getDeviceModel(d.modelId), src = part ? SOURCES[part.source] : null;
    return <div className="qpoint-device" data-device={d.instanceId} data-kind="digital">
        <div className="qpoint-device-head"><b>{d.instanceId}</b><span>{d.role}</span><em>{d.region}</em>
            <button type="button" className="link-button" onClick={() => onInspect?.(d.instanceId)}>부품 상세</button></div>
        <div className="qpoint-group"><strong>외부 단자 (데이터시트 GI·VO(on) 기준)</strong>
            <div className="qpoint-metrics">
                <span><small>IO (출력)</small><b>{mA(d.io)}</b></span><span><small>II (외부 입력)</small><b data-metric="ii">{mA(d.ii)}</b></span>
                <span><small>IO/II (외부)</small><b data-metric="external-ratio">{ratio(d.externalRatio)}</b></span>
                <span><small>곡선 시험 IO/II</small><b>{ratio(d.testRatio)}</b></span></div></div>
        <div className="qpoint-group"><strong>내부 트랜지스터 (R2 분류 후)</strong>
            <div className="qpoint-metrics">
                <span><small>IB (내부)</small><b data-metric="ib">{mA(d.ib)}</b></span>
                <span><small>IC/IB (내부)</small><b data-metric="internal-ratio">{ratio(d.internalRatio)}</b></span>
                <span><small>내장 R1 / R2</small><b>{amount(d.r1, 1, 'Ω')} / {amount(d.r2, 1, 'Ω')}</b></span>
                <span><small>입력 단자 전압</small><b>{amount(d.inputVoltage, 1, 'V')}</b></span></div></div>
        <Help label="IO/II 설명">IO/II는 외부 단자 전류비이고 IC/IB는 내부 베이스 전류비입니다. 두 값은 R2로 빠지는 전류만큼 달라 서로 대체할 수 없습니다.</Help>
        <Figures list={d.figures} />
        {src?.url && <a href={src.url} target="_blank" rel="noreferrer">데이터시트: {src.manufacturer} · {src.revision}</a>}
    </div>;
}

function MosRow({ d, onInspect }) {
    return <div className="qpoint-device" data-device={d.instanceId} data-kind="mosfet">
        <div className="qpoint-device-head"><b>{d.instanceId}</b><span>{d.role}</span><em>{d.region}</em>
            <button type="button" className="link-button" onClick={() => onInspect?.(d.instanceId)}>부품 상세</button></div>
        <div className="qpoint-metrics">
            <span><small>ID</small><b>{mA(d.id)}</b></span><span><small>|VGS|</small><b>{amount(d.vgs, 1, 'V')}</b></span><span><small>|VDS|</small><b>{amount(d.vds, 1, 'V')}</b></span>
        </div>
        {d.weakDrive && <small className="qpoint-warn">게이트 전압이 출력 곡선의 최저 VGS보다 낮아 약한 게이트 근사를 사용합니다.</small>}
    </div>;
}

export default function QPointSummary({ point, onInspect }) {
    if (!point) return null;
    const s = qPointSummary(point);
    return <div className="qpoint" data-status={s.status} data-testid="qpoint">
        <div className="qpoint-title"><strong>동작점 전압 예산과 구동</strong></div>
        {s.status === 'off' ? <p className="subtle" role="status">{s.note}</p> : <>
            <KvlPath path={s.load} kind="load" />
            {s.drive.map(p => <KvlPath key={p.id} path={p} kind="drive" />)}
            {s.devices.length > 0 && <div className="qpoint-devices">
                {s.devices.map(d => d.kind === 'bjt' ? <BjtRow key={d.instanceId} d={d} onInspect={onInspect} />
                    : d.kind === 'digital' ? <DigitalRow key={d.instanceId} d={d} onInspect={onInspect} />
                    : <MosRow key={d.instanceId} d={d} onInspect={onInspect} />)}
            </div>}
            {point.config.topology === 'npn-follower' && <Help label="에미터 팔로워 설명">에미터 팔로워: LED와 RLED에는 IE가 흐르고 VLED 공급은 IC입니다. 두 값은 IB만큼 다릅니다.</Help>}
            {point.config.topology === 'npn-current-sink' && <Help label="전류 싱크 설명">전류 싱크: RLED·LED·Q1 VCE에는 IC가, RE에는 IE가 흐릅니다. RE 전압은 IE×RE입니다.</Help>}
        </>}
        <details className="qpoint-help">
            <summary>ⓘ IC/IB(강제 β)와 구동 경로 읽는 법</summary>
            <ul>
                <li><b>IC/IB</b>는 계산된 동작점의 컬렉터 전류 ÷ 베이스 전류입니다. 데이터시트의 <b>hFE</b>(활성 영역 DC 전류이득)나 <b>시험 IC/IB</b>(VCE(sat) 그래프를 측정한 조건)와 다른 값입니다.</li>
                <li>IC/IB가 hFE에 가까우면 활성 영역, 시험 IC/IB 쪽으로 내려가면 포화 쪽입니다. <b>합격선(예: β≤10 또는 20)은 없습니다.</b> 에미터 팔로워·전류 싱크에서는 활성 영역이 의도된 동작입니다.</li>
                <li>DTC는 <b>IO/II</b>(외부 단자 전류비, 데이터시트 GI)와 <b>IC/IB</b>(내부 베이스 기준)가 다릅니다.</li>
                <li>부하 경로와 구동 경로는 별도의 전압 루프이며, 각 루프의 합은 해당 전원 또는 단자 전압과 같습니다.</li>
                <li>OFF·Hi-Z·전원 도메인 불일치처럼 모델이 값을 정하지 못하는 조건은 임의의 0 V나 β를 표시하지 않습니다.</li>
            </ul>
        </details>
    </div>;
}
