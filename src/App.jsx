import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, RotateCcw, Zap } from 'lucide-react';
import { DEFAULT_CONFIG, TOPOLOGIES } from './core/topologies.js';
import { analyzePoint, analyzeCorners, selectResistance } from './core/analysis.js';
import { LEDS, SOURCES, BJTS, DIGITAL, MOSFETS, GPIO, PACKAGE_PRESETS } from './data/catalog.js';
import CircuitDiagram from './components/CircuitDiagram.jsx';
import './index.css';
const show = (v, scale = 1, unit = '') => v == null || !Number.isFinite(v) ? '—' : `${(v * scale).toLocaleString('en-US', { maximumSignificantDigits: 4 })}${unit ? ' ' + unit : ''}`;
const FLAGS = {
    'legacy-led-unverified': 'legacy LED 데이터입니다. 검증된 원문 모델이 있으면 그 모델을 선택하세요.',
    'approximation:LED-table-midpoint': 'LED: 데이터시트에 typ Vf가 없어 min/max 가운데값을 계산 가정으로 사용합니다.',
    'not-modeled:LED-absolute-optical-anchor': 'LED: 절대 광도는 min/max 범위만 있고 typ 기준값이 없어 단일 mcd 값을 만들지 않습니다.',
    'not-modeled:LED-optical-current-shape': 'LED: 해당 시험점의 광도는 있지만 같은 원문의 전류-광도 곡선을 모델링하지 않았습니다.',
    'approximation:GPIO-limit-points-not-typical': 'GPIO: 한계 시험점을 잇는 가정 곡선입니다. 전형적인 출력 특성으로 보증하지 않습니다.',
    'approximation:BJT-active-saturation-bridge': 'BJT: 활성/포화 곡선 사이와 다른 VCE 조건을 근사 연결합니다.',
    'approximation:BJT-strong-base-drive': 'BJT: 강한 베이스 구동 구간은 지정 강제 전류비 곡선 아래의 근사입니다.',
    'approximation:DTC-terminal-bridge-and-internal-Vbe': 'DTC: 외부 IO/II 곡선 기반 연결 근사이며 내부 VBE는 별도 가정입니다. GI ≠ 내부 hFE.',
    'not-modeled:self-heating-feedback': '자가발열에 따른 전기 특성 피드백은 계산하지 않습니다. 온도 입력과 전력 예산을 별도로 검사합니다.',
    'not-modeled:transistor-electrical-temperature': 'TR 곡선은 25°C 기준입니다. 선택 온도에서의 TR 전기 특성 변화는 아직 모델링되지 않았습니다.',
    'not-modeled:off-leakage': 'OFF는 DC 구동 해제 근사입니다. 누설 전류·역급전·과도 파형은 계산하지 않습니다.',
    'not-verified:direct-high-side-OFF-domain': '직접 하이사이드의 ON만 계산했습니다. 다른 전압 도메인에서 HIGH/Hi-Z OFF는 별도 모델이 필요합니다.',
};
function Flag({ value }) {
    return <li>{FLAGS[value] ?? (value.startsWith('extrapolation:') ? `곡선 범위 밖 외삽: ${value.slice(14)}` : value.replace('approximation:', '명시적 근사: ').replace('not-modeled:', '미모델화: '))}</li>;
}
function NumberField({ name, label, value, onChange, unit = '', step = 'any', disabled = false }) {
    return <label className="field" htmlFor={name}><span>{label}<small>{unit}</small></span>
    <input id={name} type="number" step={step} value={value} disabled={disabled} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}/></label>;
}
function Metric({ label, value, hint }) { return <div className="metric"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>; }
export default function App() {
    const [config, setConfig] = useState({ ...DEFAULT_CONFIG }), [mode, setMode] = useState('verify');
    const [target, setTarget] = useState(10), [targetKind, setTargetKind] = useState('current'), [series, setSeries] = useState('E24+E96'), [strategy, setStrategy] = useState('closest');
    const [cornerSnapshot, setCornerSnapshot] = useState(null), [includeDtc, setIncludeDtc] = useState(false);
    const set = (key, value) => setConfig(c => ({ ...c, [key]: value }));
    const result = useMemo(() => {
        if (mode === 'verify')
            return analyzePoint(config);
        try {
            const sizing = selectResistance(config, Number(target) / 1000, { series, strategy, targetMcd: targetKind === 'mcd' ? target : null });
            return { ...sizing.result, sizing };
        }
        catch (e) {
            return { ok: false, error: { code: e.code ?? 'calculation-error', message: e.message } };
        }
    }, [config, mode, target, series, strategy, targetKind]);
    const p = result.ok ? result.point : null, t = TOPOLOGIES.find(t => t.id === config.topology), led = LEDS[config.led];
    const configKey = JSON.stringify(p?.config), corners = cornerSnapshot && p && cornerSnapshot.key === configKey ? cornerSnapshot.result : null;
    const reset = () => { setConfig({ ...DEFAULT_CONFIG }); setMode('verify'); setTarget(10); setTargetKind('current'); setCornerSnapshot(null); };
    const exportResult = () => {
        const report = { schemaVersion: 1, application: 'LED-TR Analyzer', scope: 'datasheet-based reduced DC model, not SPICE', configuration: config, result, corners };
        const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'led-tr-analysis.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const number = (name, label, unit = '', step = 'any') => <NumberField key={name} name={name} label={label} unit={unit} step={step} value={config[name]} onChange={v => set(name, v)}/>;
    const usedModels = p ? [...new Map([GPIO, DIGITAL, ...Object.values(BJTS), ...Object.values(MOSFETS), led].filter(m => p.provenance.includes(m.source)).map(m => [m.source, m])).values()] : [];
    return <>
    <header className="topbar"><div className="top-inner"><a href="/" className="back"><ArrowLeft size={16}/> Home</a><a href="https://github.com/InitusNovus/led-tr-analyzer" target="_blank" rel="noreferrer">Source <ExternalLink size={14}/></a></div></header>
    <main className="shell">
      <div className="title-row"><div><div className="eyebrow"><Zap size={15}/> DATASHEET / DC</div><h1>LED-TR Analyzer</h1><p>특성곡선과 회로 조건으로 계산하는 LED 구동 동작점</p></div>
        <div className="actions"><button onClick={reset}><RotateCcw size={15}/> 초기화</button><button onClick={exportResult} disabled={!result.ok}><Download size={15}/> 결과 JSON</button></div></div>
      <div className="workspace">
        <aside className="controls">
          <section className="panel"><h2>회로와 부품</h2>
            <label className="field" htmlFor="topology"><span>토폴로지</span><select id="topology" value={config.topology} onChange={e => {
            const next = TOPOLOGIES.find(t => t.id === e.target.value);
            setConfig(c => ({ ...c, topology: next.id, state: next.active === 'LOW' ? 'LOW' : 'HIGH' }));
        }}>{TOPOLOGIES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <p className="subtle">{t.active === 'always' ? '항상 연결된 기준 회로' : `${t.active}로 켜지는 구성 · 반대 상태/Hi-Z도 검사하세요.`}</p>
            <label className="field" htmlFor="led"><span>LED</span><select id="led" value={config.led} onChange={e => { set('led', e.target.value); if (!Number.isFinite(LEDS[e.target.value].optical?.nominalMcd) || !LEDS[e.target.value].optical?.relative)
        setTargetKind('current'); }}>{Object.values(LEDS).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            <p className="subtle">KT-0805 7종은 원문 LCSC/KENTO 자료에 연결됩니다. Y/W는 이번 버전에서 table-only 근사이며, Kingbright는 별도 reference LED입니다.</p>
            <div className="fields two">{number('vcc', 'LED / 컬렉터 전원', 'V')}{number('vdd', 'GPIO 전원', 'V')}{number('seriesCount', '직렬 LED 개수', '개', 1)}{number('temperature', '전기 모델 온도', '°C')}</div>
            <CircuitDiagram config={config} point={p}/>
          </section>
          <section className="panel"><h2>GPIO 및 구동</h2><p className="subtle">STM32G0B1 일반 I/O 한계점 근사 · 2.7–3.6V. FT_c, PC13/14/15 제외.</p>
            <div className="fields two">
              <label className="field" htmlFor="state"><span>출력 상태</span><select id="state" value={config.state} onChange={e => set('state', e.target.value)}>{['HIGH', 'LOW', 'HI_Z'].map(s => <option key={s}>{s}</option>)}</select></label>
              <label className="field" htmlFor="gpio-mode"><span>출력 모드</span><select id="gpio-mode" value={config.gpioMode} onChange={e => set('gpioMode', e.target.value)}><option value="push-pull">Push-pull</option><option value="open-drain">Open-drain</option></select></label>
              <label className="field" htmlFor="pull"><span>GPIO Hi-Z pull</span><select id="pull" value={config.pull} onChange={e => set('pull', e.target.value)}><option value="none">없음</option><option value="up">Pull-up</option><option value="down">Pull-down</option></select></label>
              {number('pullResistance', 'GPIO pull 저항', 'Ω')}
            </div>
            {config.topology.includes('npn') || config.topology === 'pnp-high' ? <div className="fields two">{number('baseResistance', 'RB (일반 BJT)', 'Ω')}{config.topology === 'npn-current-sink' && number('emitterResistance', 'RE (센스)', 'Ω')}</div> : null}
            {(config.topology.includes('mos') || config.topology === 'npn-pnp') && <div className="fields two">{number('gateResistance', 'RG / Rdrive', 'Ω')}{number('gatePull', 'RGS / 상단 RBE', 'Ω')}</div>}
            {config.topology === 'digital-npn' && <div className="model-chip">DTC043ZEB · R1 4.7kΩ · R2/R1=10<br />내부 저항 공차는 감도 분석에서 별도 선택</div>}
            <details><summary>회로 조건 / 단자 정의</summary><div className="detail-body">
              <p>일반 NPN/PNP: 각각 onsemi MMBT3904LT1G / Nexperia BC857B. MOS: Nexperia 2N7002 / BSS84. 제조사별 모델은 호환으로 간주하지 않습니다.</p>
              <p>일반 BJT의 RB는 GPIO와 베이스 사이입니다. 기본 NPN과 직접 PNP에는 외부 RBE가 없으므로 부유 베이스는 계산하지 않습니다. 디지털 TR은 내장 R1/R2를 사용합니다.</p>
              <p>NMOS 게이트는 RG를 통해 GPIO에 연결되고 RGS로 GND에 당깁니다. PMOS 게이트는 RGS로 VLED에 당기며 RG/Rdrive를 통해 GPIO 또는 하단 TR에 연결됩니다.</p>
              <p>NPN→PNP: 상단 B–E에 RBE, 상단 베이스와 하단 컬렉터 사이에 Rdrive가 있습니다. 두 소자와 보조 저항의 DC 전력을 모두 계산합니다.</p>
              <p>전류 싱크의 LED에는 IC, RE에는 IE=IC+IB가 흐릅니다. 에미터 팔로워 LED 전류는 IE입니다.</p>
            </div></details>
          </section>
        </aside>
        <div className="results-column">
          <section className="panel">
            <div className="tabs" role="group" aria-label="계산 모드"><button className={mode === 'verify' ? 'active' : ''} onClick={() => setMode('verify')}>저항으로 검증</button><button className={mode === 'size' ? 'active' : ''} onClick={() => setMode('size')}>목표에서 저항 선정</button></div>
            {mode === 'verify' ? <NumberField name="resistance" label="RLED · LED 직렬저항" unit="Ω" value={config.resistance} onChange={v => set('resistance', v)}/> : <>
              <div className="fields two"><NumberField name="target" label={targetKind === 'mcd' ? '목표 광도 (선형 상대곡선)' : '목표 LED 전류'} unit={targetKind === 'mcd' ? 'mcd' : 'mA'} value={target} onChange={setTarget}/>
                <label className="field" htmlFor="target-kind"><span>목표 단위</span><select id="target-kind" value={targetKind} onChange={e => setTargetKind(e.target.value)}><option value="current">전류</option><option value="mcd" disabled={!Number.isFinite(led.optical?.nominalMcd) || !led.optical?.relative}>광도 · 근사</option></select></label></div>
              <div className="fields two"><label className="field" htmlFor="series"><span>E-series</span><select id="series" value={series} onChange={e => setSeries(e.target.value)}>{['E24', 'E96', 'E24+E96'].map(s => <option key={s}>{s}</option>)}</select></label>
                <label className="field" htmlFor="strategy"><span>표준값 선택</span><select id="strategy" value={strategy} onChange={e => setStrategy(e.target.value)}><option value="closest">가장 가까운 저항</option><option value="safe">큰 저항 (nominal 기준)</option><option value="bright">작은 저항</option></select></label></div>
              {result.sizing && <div className="selection" data-testid="selected-resistance"><span>선택 {show(result.sizing.selected, 1, 'Ω')}</span><small>연속값 {show(result.sizing.exact, 1, 'Ω')}</small><button onClick={() => { set('resistance', result.sizing.selected); setMode('verify'); }}>검증 모드에 적용</button></div>}
            </>}
            <p className="subtle">E-series와 저항 공차는 독립 설정입니다. 큰 저항 선택도 공차·구동·정격 안전을 보증하지 않습니다.</p>
          </section>
          {!result.ok ? <section className="notice error" role="alert"><h2>계산할 수 없는 조건</h2><p>{result.error.message}</p><small>{result.error.code}</small></section> : <>
            <section className="panel report" aria-label="동작점 결과" aria-live="polite">
              <div className="report-head"><h2>동작점</h2><span className={`status ${result.validation.status}`}>{result.validation.label}</span></div>
              <div className="metrics"><Metric label="LED 전류" value={show(p.current, 1000, 'mA')} hint={`${p.region} · DC`}/><Metric label="LED 전압 / 개" value={show(p.ledVf, 1, 'V')}/>
                <Metric label="GPIO 전류 (+source / −sink)" value={show(p.gpioCurrent, 1000, 'mA')}/><Metric label="GPIO 단자 전압" value={show(p.gpioVoltage, 1, 'V')}/>
                <Metric label="드라이버 전압 강하 / OFF 상한" value={show(p.driverVoltage, 1, 'V')}/><Metric label="추정 광도 / LED" value={show(p.luminousMcd, 1, 'mcd')} hint={p.luminousMcd == null ? '광학 근거 없음' : '전형값 곡선 추정 · 체감 밝기 아님'}/></div>
              {p.baseCurrent != null && <div className="inline-metrics"><span>IB {show(p.baseCurrent, 1000, 'mA')}</span><span>IE {show(p.emitterCurrent, 1000, 'mA')}</span><span>IC/IB {show(p.forcedBeta)}</span>{p.externalInputCurrent != null && <span>외부 II {show(p.externalInputCurrent, 1000, 'mA')} · IO/II {show(p.externalRatio)}</span>}</div>}
              {p.gateVoltage != null && <div className="inline-metrics"><span>상단/출력 MOS VGS {show(p.gateVoltage, 1, 'V')}</span></div>}
            </section>
            <section className="notice model-note"><strong>계산 모델의 가정을 확인하세요.</strong><p>특성곡선은 전형값이고 일부 영역은 명시적인 근사입니다. 정격을 넘는 결과를 잘라내거나 “안전 설계”로 판정하지 않습니다.</p>
              <details><summary>근사·외삽·미검증 항목 ({p.flags.length})</summary><ul>{p.flags.map(f => <Flag key={f} value={f}/>)}</ul></details>
            </section>
            <section className="panel"><h2>전력과 정격</h2><div className="fields two">
              <label className="field" htmlFor="package"><span>RLED 패키지 기본값 · 가정</span><select id="package" value={Object.keys(PACKAGE_PRESETS).find(k => PACKAGE_PRESETS[k] === config.resistorRating) ?? 'custom'} onChange={e => { if (e.target.value !== 'custom')
            set('resistorRating', PACKAGE_PRESETS[e.target.value]); }}>{Object.entries(PACKAGE_PRESETS).map(([k, v]) => <option key={k} value={k}>{k} · {v * 1000}mW</option>)}<option value="custom">직접 지정</option></select></label>
              {number('resistorRating', 'RLED 실제 정격 입력', 'W')}{number('auxRating', '보조 저항 정격 입력', 'W')}{number('derating', '사용 전력 비율', '0–1')}{number('ambient', '주변 온도 (전력 검사)', '°C')}
            </div><p className="subtle">패키지 기본값은 특정 저항 품번의 보증값이 아닙니다. TR 전력 예산도 데이터시트의 참조 실장 조건 기준이며 SOA 전체를 검증하지 않습니다.</p>
              <div className="table-scroll"><table><thead><tr><th>소자 / 경로</th><th>전류</th><th>전압</th><th>DC 전력</th></tr></thead><tbody>{p.ledger.map((e, i) => <tr key={`${e.id}-${i}`}><th>{e.id}</th><td>{show(e.current, 1000, 'mA')}</td><td>{show(e.voltage, 1, 'V')}</td><td>{show(e.power, 1000, 'mW')}</td></tr>)}</tbody></table></div>
              <details><summary>전체 한계 검사</summary><div className="table-scroll"><table><thead><tr><th>항목</th><th>계산값 (SI)</th><th>한계 (SI)</th><th>검사</th></tr></thead><tbody>{result.validation.checks.map(x => <tr key={x.id} className={x.status === 'exceeded' ? 'limit-error' : ''}><th title={x.condition}>{x.id}</th><td>{show(x.actual)}</td><td>{show(x.limit)}</td><td>{x.status}</td></tr>)}</tbody></table></div></details>
              <details><summary>다른 GPIO 부하 / 수치 잔차</summary><div className="detail-body fields two">{number('otherSourceCurrent', '다른 핀 source 합계', 'A')}{number('otherSinkCurrent', '다른 핀 sink 합계', 'A')}<p className="subtle">KVL 잔차 {show(p.solver.residual)}<br />전력 수지 오차 {show(p.powerResidual, 1000, 'mW')}<br />공급전류 전체나 실측 정확도를 뜻하지 않습니다.</p></div></details>
            </section>
          </>}
          <section className="panel"><h2>공차 · 감도 분석</h2><div className="fields two">{number('vccTolerance', 'VLED 변동', '±%')}{number('vddTolerance', 'GPIO 전원 변동', '±%')}{number('resistorTolerance', 'RLED 공차', '±%')}{number('vfSpread', 'LED Vf 이동 가정', '±V')}</div>
            <p className="subtle">최소·기준·최대 표본의 조합입니다. LED 이동량은 사용자의 감도 가정이며 제조사 min/max 곡선이 아닙니다. RB/RE 등 보조 저항은 기준값으로 유지합니다.</p>
            {config.topology === 'digital-npn' && <label className="check"><input type="checkbox" checked={includeDtc} onChange={e => { setIncludeDtc(e.target.checked); setCornerSnapshot(null); }}/> DTC R1 및 R2/R1 공차 포함 (최대 729개)</label>}
            <button className="primary" disabled={!p} onClick={() => { try {
        setCornerSnapshot({ key: configKey, result: analyzeCorners(p.config, { includeDtc }) });
    }
    catch (e) {
        setCornerSnapshot({ key: configKey, result: { error: e.message } });
    } }}>현재 조건 분석</button>
            {corners && (corners.error ? <p role="alert">{corners.error}</p> : <div className="corner-results"><p>{corners.validCount}/{corners.count} 조건 계산 · {corners.failures.length}개 미지원/실패 · {corners.anyExceeded ? '한계 초과 조건 있음' : '계산 가능한 표본의 검사 완료'}</p>
              {Object.entries(corners.extrema).map(([metric, e]) => e && <details key={metric}><summary>{metric}: {show(e.min.value, 1000)} – {show(e.max.value, 1000)} {metric === 'current' ? 'mA' : 'mW'}</summary><pre>{JSON.stringify({ minimum: e.min.scenario, maximum: e.max.scenario }, null, 2)}</pre><p className="subtle">최대값의 전류·전압·저항·전력은 같은 조건에서 계산합니다.</p></details>)}
              {corners.failures.length > 0 && <details><summary>실패 조건 보기</summary><pre>{JSON.stringify(corners.failures.slice(0, 8), null, 2)}</pre></details>}</div>)}
          </section>
          {p && <section className="panel"><h2>데이터 출처와 모델 범위</h2>{usedModels.map(m => <details key={m.source}><summary>{m.name ?? m.id}</summary><div className="detail-body"><a href={SOURCES[m.source].url} target="_blank" rel="noreferrer">{SOURCES[m.source].manufacturer} · {SOURCES[m.source].revision} <ExternalLink size={13}/></a>{m.notes?.map(n => <p key={n}>{n}</p>)}<p className="subtle">{m.figure ?? m.vf?.figure ?? m.gain?.figure ?? m.drop?.figure ?? '기존 AI 입력값 · 데이터시트 미검증'} · 곡선값은 수동으로 읽은 근사이며 실측 검증되지 않았습니다.</p></div></details>)}</section>}
        </div>
      </div>
      <footer>DC 모델 · SPICE/IBIS 없음 · 제작 전 데이터시트 및 실측 확인<br /><a href="https://github.com/InitusNovus/led-tr-analyzer/issues">모델·계산 문제 보고</a></footer>
    </main>
  </>;
}
