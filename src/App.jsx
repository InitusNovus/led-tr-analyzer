import React,{useMemo,useState}from'react';
import{ArrowLeft,Download,ExternalLink,RotateCcw,Zap,ChevronRight}from'lucide-react';
import{DEFAULT_CONFIG,TOPOLOGIES,freshConfig,transitionConfig,topologyById,topologyUsesGPIO}from'./core/topologies.js';
import{analyzePoint,analyzeCorners,selectResistance}from'./core/analysis.js';
import{LEDS,SOURCES,PACKAGE_PRESETS,modelsForFamily,getDeviceModel}from'./data/catalog.js';
import{selectedParts,partEvidence,opticalEvidence,buildInstanceViews}from'./ui/viewModel.js';
import CircuitDiagram from'./components/CircuitDiagram.jsx';
import'./index.css';

const show=(v,scale=1,unit='')=>v==null||!Number.isFinite(v)?'—':(v*scale).toLocaleString('en-US',{maximumSignificantDigits:4})+(unit?' '+unit:'');
const FLAGS={
 'legacy-led-unverified':'legacy LED 데이터입니다.',
 'approximation:LED-table-midpoint':'LED: typ Vf가 없어 표의 min/max 가운데값을 계산 가정으로 사용합니다.',
 'not-modeled:LED-vf-current-shape':'LED: 시험 전류에 따른 Vf 형상은 모델링하지 않았습니다.',
 'not-modeled:LED-temperature':'LED: 선택 온도의 전기적 온도 의존성 자료가 없어 25°C 곡선을 유지합니다.',
 'not-modeled:LED-absolute-optical-anchor':'LED: 원문 광도 범위는 있지만 단일 typ anchor가 없어 scalar mcd를 만들지 않습니다.',
 'not-modeled:LED-optical-current-shape':'LED: 단일 광도 시험점은 있으나 전류-광도 곡선이 없습니다.',
 'approximation:GPIO-limit-points-not-typical':'GPIO: 한계 시험점을 잇는 가정 곡선입니다.',
 'approximation:BJT-active-saturation-bridge':'BJT: 활성/포화 곡선 사이를 축약 근사합니다.',
 'approximation:BJT-saturation-drive-ratio-mismatch':'BJT: 서로 다른 강제 전류비의 datasheet 곡선을 bridge anchor로 사용합니다.',
 'approximation:BJT-strong-base-drive':'BJT: 강한 베이스 구동 구간은 근사입니다.',
 'approximation:DTC-terminal-bridge-and-internal-Vbe':'DTC: 외부 IO/II 곡선 기반 연결 근사이며 내부 VBE는 별도 가정입니다.',
 'not-modeled:self-heating-feedback':'자가발열의 전기 특성 피드백은 계산하지 않습니다.',
 'not-modeled:transistor-electrical-temperature':'TR 전기 곡선은 25°C 기준입니다.',
 'not-modeled:off-leakage':'OFF 누설/역급전/과도는 모델링하지 않습니다.',
 'not-verified:direct-high-side-OFF-domain':'직접 하이사이드의 다른 전압 도메인 OFF는 별도 모델이 필요합니다.'
};
const cls=(...v)=>v.filter(Boolean).join(' ');
function Flag({value}){return<li>{FLAGS[value]??(value.startsWith('extrapolation:')?'곡선 범위 밖 외삽: '+value.slice(14):value.replace('approximation:','명시적 근사: ').replace('not-modeled:','미모델화: '))}</li>;}
function NumberField({name,label,value,onChange,unit='',step='any',disabled=false}){return<label className="field" htmlFor={name}><span>{label}<small>{unit}</small></span><input id={name} type="number" step={step} value={value} disabled={disabled} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/></label>;}
function Metric({label,value,hint}){return<div className="metric"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div>;}
function PartPicker({slot,modelId,onChange,onInspect}){
 const models=modelsForFamily(slot.family),part=getDeviceModel(modelId),src=part?SOURCES[part.source]:null;
 return<div className="part-picker"><button type="button" className="part-picker-head" onClick={()=>onInspect(slot.id)}><span><b>{slot.id}</b><small>{slot.role}</small></span><ChevronRight size={16}/></button>
   <label className="field compact" htmlFor={'model-'+slot.id}><span>실제 부품</span><select id={'model-'+slot.id} value={modelId} onChange={e=>onChange(slot.id,e.target.value)}>{models.map(m=><option key={m.modelId} value={m.modelId}>{m.name}</option>)}</select></label>
   <div className="part-meta"><span>{part?.modelKind??'model'}</span><span>{models.length===1?'현재 지원 모델 1개':models.length+'개 모델'}</span></div>
   {src&&<small className="source-line">{src.manufacturer} · {src.revision}</small>}
 </div>;
}
function Inspector({view}){
 if(!view)return<div className="inspector empty">회로의 소자를 선택하면 상세값을 표시합니다.</div>;
 const ev=view.part?partEvidence(view.part):null;
 return<div className="inspector"><div className="inspector-title"><div><strong>{view.instanceId}</strong><span>{view.part?.name??view.label}</span></div>{view.region&&<em>{view.region}</em>}</div>
   {view.metrics.length?<div className="inspector-metrics">{view.metrics.map((m,i)=><span key={m.label+i}><small>{m.label}</small><b>{m.display}</b></span>)}</div>:<p className="subtle">현재 동작점 수치가 없습니다.</p>}
   {ev&&<div className="evidence-mini"><span>{ev.modelKind}</span>{ev.capabilities.map(x=><span key={x}>{x}</span>)}</div>}
 </div>;
}
export default function App(){
 const[config,setConfig]=useState(()=>freshConfig()),[mode,setMode]=useState('verify'),[target,setTarget]=useState(10),[targetKind,setTargetKind]=useState('current');
 const[series,setSeries]=useState('E24+E96'),[strategy,setStrategy]=useState('closest'),[cornerSnapshot,setCornerSnapshot]=useState(null),[includeDtc,setIncludeDtc]=useState(false),[selectedInstance,setSelectedInstance]=useState('Q1');
 const t=topologyById(config.topology),led=LEDS[config.led],optical=opticalEvidence(led);
 const set=(key,value)=>{setCornerSnapshot(null);setConfig(c=>({...c,[key]:value}));};
 const setDevice=(id,value)=>{setCornerSnapshot(null);setSelectedInstance(id);setConfig(c=>({...c,deviceModels:{...(c.deviceModels??{}),[id]:value}}));};
 const changeTopology=id=>{const next=topologyById(id);setCornerSnapshot(null);setConfig(c=>transitionConfig(c,id));if(!next.supportedOperations.includes('size'))setMode('verify');setSelectedInstance(next.deviceSlots.find(s=>s.id==='Q1')?'Q1':'LED1');};
 const result=useMemo(()=>{if(mode==='verify')return analyzePoint(config);try{const sizing=selectResistance(config,targetKind==='current'?Number(target)/1000:.001,{series,strategy,targetMcd:targetKind==='mcd'?Number(target):null});return{...sizing.result,sizing};}catch(e){return{ok:false,error:{code:e.code??'calculation-error',message:e.message}};}},[config,mode,target,targetKind,series,strategy]);
 const p=result.ok?result.point:null,applied=p?.config??null,configKey=JSON.stringify(applied),corners=cornerSnapshot&&p&&cornerSnapshot.key===configKey?cornerSnapshot.result:null;
 const parts=selectedParts(config,t),views=buildInstanceViews(applied??config,p,result.ok?result.validation:null),activeSelected=views.find(v=>v.instanceId===selectedInstance)?.instanceId??(t.deviceSlots.find(s=>s.id==='Q1')?.id??'LED1'),selectedView=views.find(v=>v.instanceId===activeSelected);
 const reset=()=>{setConfig(freshConfig());setMode('verify');setTarget(10);setTargetKind('current');setSeries('E24+E96');setStrategy('closest');setIncludeDtc(false);setCornerSnapshot(null);setSelectedInstance('Q1');};
 const exportResult=()=>{if(!p)return;const modelSnapshot=selectedParts(p.config,t).map(x=>({instanceId:x.instanceId,modelId:x.modelId,source:x.part.source,sourceRevision:SOURCES[x.part.source]?.revision??null,modelKind:x.part.modelKind??x.part.kind??null}));const report={schemaVersion:2,application:'LED-TR Analyzer',scope:'datasheet-based reduced DC model, not SPICE',inputDraft:config,appliedConfiguration:p.config,modelSnapshot,result,corners,migrationNote:'schemaVersion 1 used the fixed model mapping from main fbc118a; schemaVersion 2 stores exact selected model IDs.'};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='led-tr-analysis-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const number=(name,label,unit='',step='any')=><NumberField key={name} name={name} label={label} unit={unit} step={step} value={config[name]} onChange={v=>set(name,v)}/>;
 const q1=getDeviceModel(config.deviceModels?.Q1),sizeSupported=t.supportedOperations.includes('size');
 return<>
 <header className="topbar"><div className="top-inner"><a href="/" className="back"><ArrowLeft size={16}/> Home</a><a href="https://github.com/InitusNovus/led-tr-analyzer" target="_blank" rel="noreferrer">Source <ExternalLink size={14}/></a></div></header>
 <main className="shell">
  <div className="title-row"><div><div className="eyebrow"><Zap size={15}/> DATASHEET / DC</div><h1>LED-TR Analyzer</h1><p>실제 부품 모델과 회로 구조를 연결해 보는 축약 비선형 DC 분석기</p></div><div className="actions"><button onClick={reset}><RotateCcw size={15}/> 전체 초기화</button><button onClick={exportResult} disabled={!p}><Download size={15}/> 결과 JSON</button></div></div>
  <section className="workbench">
   <div className="panel setup-panel"><h2>회로와 실제 부품</h2>
    <label className="field" htmlFor="topology"><span>토폴로지</span><select id="topology" value={config.topology} onChange={e=>changeTopology(e.target.value)}>{TOPOLOGIES.map(x=><option key={x.id} value={x.id}>{x.family} · {x.name}</option>)}</select></label>
    <p className="subtle">{t.path}<br/>토폴로지 전환 시 기본 ON 상태({t.active})로 설정됩니다.</p>
    <details className="topology-gallery"><summary>지원 회로 13종 보기</summary><div className="topology-cards">{TOPOLOGIES.map(x=><button key={x.id} className={cls(config.topology===x.id&&'active')} onClick={()=>changeTopology(x.id)}><b>{x.name}</b><small>{x.path}</small></button>)}</div></details>
    <label className="field" htmlFor="led"><span>LED1</span><select id="led" value={config.led} onChange={e=>{const id=e.target.value;set('led',id);if(!(Number.isFinite(LEDS[id].optical?.nominalMcd)&&LEDS[id].optical?.relative))setTargetKind('current');setSelectedInstance('LED1');}}>{Object.values(LEDS).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <div className="part-meta"><span>{led.kind}</span><span>{optical.label}</span></div>
    <div className="supply-grid">{number('vcc','VLED / collector rail','V')}{topologyUsesGPIO(t)&&number('vdd','GPIO 전원','V')}{number('seriesCount','직렬 LED','개',1)}{number('temperature','전기 모델 온도','°C')}</div>
    <div className="device-slots">{t.deviceSlots.map(slot=><PartPicker key={slot.id} slot={slot} modelId={config.deviceModels?.[slot.id]??slot.defaultModelId} onChange={setDevice} onInspect={setSelectedInstance}/>)}</div>
   </div>
   <div className="panel schematic-panel">
    <CircuitDiagram config={config} point={p} selectedInstance={activeSelected} onSelectInstance={setSelectedInstance}/>
    <div className="quick-results">{p?<><Metric label="LED 전류" value={show(p.current,1000,'mA')} hint={p.region}/><Metric label="LED Vf / 개" value={show(p.ledVf,1,'V')}/>{topologyUsesGPIO(t)&&<Metric label="GPIO 전류" value={show(p.gpioCurrent,1000,'mA')} hint="+ source / − sink"/>}<Metric label="Driver 손실" value={show(p.driverPower,1000,'mW')}/></>:<div className="quick-error"><strong>현재 조건 계산 불가</strong><span>{result.error?.message}</span></div>}</div>
    <Inspector view={selectedView}/>
   </div>
  </section>

  <section className="lower-grid">
   <aside className="controls">
    {topologyUsesGPIO(t)&&<section className="panel"><h2>GPIO 및 구동</h2><div className="fields two">
      <label className="field" htmlFor="state"><span>출력 상태</span><select id="state" value={config.state} onChange={e=>set('state',e.target.value)}>{['HIGH','LOW','HI_Z'].map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="field" htmlFor="gpio-mode"><span>출력 모드</span><select id="gpio-mode" value={config.gpioMode} onChange={e=>set('gpioMode',e.target.value)}><option value="push-pull">Push-pull</option><option value="open-drain">Open-drain</option></select></label>
      <label className="field" htmlFor="pull"><span>Hi-Z pull</span><select id="pull" value={config.pull} onChange={e=>set('pull',e.target.value)}><option value="none">없음</option><option value="up">Pull-up</option><option value="down">Pull-down</option></select></label>
      {config.pull!=='none'&&number('pullResistance','GPIO pull','Ω')}
    </div>
    {t.activeParameters.includes('baseResistance')&&number('baseResistance','RB','Ω')}
    {t.activeParameters.includes('emitterResistance')&&number('emitterResistance','RE','Ω')}
    {t.activeParameters.includes('gateResistance')&&number('gateResistance',t.id==='nmos-pmos'?'RG / Rdrive · 공용':'RG / Rdrive','Ω')}
    {t.activeParameters.includes('gatePull')&&number('gatePull',t.id==='nmos-pmos'?'RGS(in/out) · 공용':t.id==='npn-pnp'?'RBE pull-up':'RGS / pull-up','Ω')}
    {q1?.family==='digital-npn'&&<div className="model-chip">Q1 {q1.id} · R1 {q1.r1}Ω · R2/R1 {config.dtcRatio}<br/>내부 저항 공차는 감도 분석에서 선택할 수 있습니다.</div>}
    </section>}
    <section className="panel"><h2>계산 모드</h2><div className="tabs" role="group" aria-label="계산 모드"><button className={mode==='verify'?'active':''} onClick={()=>setMode('verify')}>저항으로 검증</button><button className={mode==='size'?'active':''} disabled={!sizeSupported} title={!sizeSupported?'이 회로는 RE로 전류를 설정합니다.':''} onClick={()=>setMode('size')}>목표에서 저항 선정</button></div>
     {!sizeSupported&&<p className="subtle">이 토폴로지는 RLED 자동 역산 대신 RE를 직접 설정해 검증합니다.</p>}
     {mode==='verify'?<NumberField name="resistance" label="RLED" unit="Ω" value={config.resistance} onChange={v=>set('resistance',v)}/>:<>
       <div className="fields two"><NumberField name="target" label={targetKind==='mcd'?'목표 광도':'목표 LED 전류'} unit={targetKind==='mcd'?'mcd':'mA'} value={target} onChange={setTarget}/><label className="field" htmlFor="target-kind"><span>목표 단위</span><select id="target-kind" value={targetKind} onChange={e=>setTargetKind(e.target.value)}><option value="current">전류</option><option value="mcd" disabled={!(Number.isFinite(led.optical?.nominalMcd)&&led.optical?.relative)}>광도 · 근사</option></select></label></div>
       <div className="fields two"><label className="field" htmlFor="series"><span>E-series</span><select id="series" value={series} onChange={e=>setSeries(e.target.value)}>{['E24','E96','E24+E96'].map(s=><option key={s}>{s}</option>)}</select></label><label className="field" htmlFor="strategy"><span>표준값 선택</span><select id="strategy" value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="closest">가장 가까운 저항</option><option value="safe">큰 저항</option><option value="bright">작은 저항</option></select></label></div>
       {result.sizing&&<div className="selection" data-testid="selected-resistance"><span>{show(result.sizing.selected,1,'Ω')}</span><small>연속값 {show(result.sizing.exact,1,'Ω')}</small><button onClick={()=>{set('resistance',result.sizing.selected);setMode('verify');}}>검증 모드에 적용</button></div>}
     </>}
    </section>
   </aside>

   <div className="results-column">
    {!result.ok?<section className="notice error" role="alert"><h2>계산할 수 없는 조건</h2><p>{result.error.message}</p><small>{result.error.code}</small></section>:<>
     <section className="panel report" aria-label="동작점 결과" aria-live="polite"><div className="report-head"><h2>동작점</h2><span className={'status '+result.validation.status}>{result.validation.label}</span></div><div className="metrics">
      <Metric label="LED 전류" value={show(p.current,1000,'mA')} hint={p.region+' · DC'}/><Metric label="LED 전압 / 개" value={show(p.ledVf,1,'V')}/>
      {topologyUsesGPIO(t)&&<><Metric label="GPIO 전류 (+source / −sink)" value={show(p.gpioCurrent,1000,'mA')}/><Metric label="GPIO 단자 전압" value={show(p.gpioVoltage,1,'V')}/></>}
      {p.semiconductors.length>0&&<Metric label="출력 driver 전압강하" value={show(p.driverVoltage,1,'V')}/>}
      <Metric label="광학 결과" value={show(p.luminousMcd,1,'mcd')} hint={p.luminousMcd==null?optical.label:'전형값 기반 추정 · 체감 밝기 아님'}/>
     </div></section>
     <section className="notice model-note"><strong>모델 가정</strong><p>선택한 실제 품번의 datasheet 곡선/표를 사용하며, 자료가 없는 조건은 근사·미모델링으로 표시합니다.</p><details><summary>근사·외삽·미모델링 ({p.flags.length})</summary><ul>{p.flags.map(f=><Flag key={f} value={f}/>)}</ul></details></section>
     <section className="panel"><h2>소자별 전력과 정격</h2><div className="fields two"><label className="field" htmlFor="package"><span>RLED 패키지 preset</span><select id="package" value={Object.keys(PACKAGE_PRESETS).find(k=>PACKAGE_PRESETS[k]===config.resistorRating)??'custom'} onChange={e=>{if(e.target.value!=='custom')set('resistorRating',PACKAGE_PRESETS[e.target.value]);}}>{Object.entries(PACKAGE_PRESETS).map(([k,v])=><option key={k} value={k}>{k} · {v*1000}mW</option>)}<option value="custom">직접 지정</option></select></label>{number('resistorRating','RLED 실제 정격','W')}{number('auxRating','보조 저항 정격','W')}{number('derating','사용 전력 비율','0–1')}{number('ambient','주변 온도','°C')}</div>
      <div className="table-scroll"><table><thead><tr><th>ref</th><th>전류</th><th>전압</th><th>DC 전력</th></tr></thead><tbody>{p.ledger.map((e,i)=><tr key={e.id+i} data-instance-id={e.instanceId}><th>{e.id}</th><td>{show(e.current,1000,'mA')}</td><td>{show(e.voltage,1,'V')}</td><td>{show(e.power,1000,'mW')}</td></tr>)}</tbody></table></div>
      <details><summary>전체 한계 검사</summary><div className="table-scroll"><table><thead><tr><th>항목</th><th>계산값</th><th>한계</th><th>상태</th></tr></thead><tbody>{result.validation.checks.map(x=><tr key={x.id} className={x.status==='exceeded'?'limit-error':''}><th title={x.condition}>{x.id}</th><td>{show(x.actual)}</td><td>{show(x.limit)}</td><td>{x.status}</td></tr>)}</tbody></table></div></details>
     </section>
    </>}
    <section className="panel"><h2>공차 · 감도 분석</h2><div className="fields two">{number('vccTolerance','VLED 변동','±%')}{topologyUsesGPIO(t)&&number('vddTolerance','GPIO 전원 변동','±%')}{number('resistorTolerance','RLED 공차','±%')}{number('vfSpread','LED Vf 이동 가정','±V')}</div>
     {q1?.family==='digital-npn'&&<label className="check"><input id="include-dtc" type="checkbox" checked={includeDtc} onChange={e=>{setIncludeDtc(e.target.checked);setCornerSnapshot(null);}}/> Q1 R1 및 R2/R1 공차 포함</label>}
     <button className="primary" disabled={!p} onClick={()=>{try{setCornerSnapshot({key:configKey,result:analyzeCorners(p.config,{includeDtc})});}catch(e){setCornerSnapshot({key:configKey,result:{error:e.message}});}}}>현재 조건 분석</button>
     {corners&&(corners.error?<p role="alert">{corners.error}</p>:<div className="corner-results"><p>{corners.validCount}/{corners.count} 조건 계산 · {corners.failures.length}개 미지원/실패 · {corners.anyExceeded?'한계 초과 조건 있음':'계산 가능한 표본의 검사 완료'}</p>{Object.entries(corners.extrema).map(([metric,e])=>e&&<details key={metric}><summary>{metric}: {show(e.min.value,metric==='current'?1000:1000)} – {show(e.max.value,1000)} {metric==='current'?'mA':'mW'}</summary><pre>{JSON.stringify({minimum:e.min.scenario,maximum:e.max.scenario},null,2)}</pre></details>)}</div>)}
    </section>
    <section className="panel"><h2>선택 부품의 데이터 근거</h2><div className="evidence-grid">{parts.map(({instanceId,role,modelId,part})=>{const ev=partEvidence(part),src=ev?.source;return<article className="evidence-card" key={instanceId}><div><b>{instanceId}</b><span>{role}</span></div><strong>{part.name??part.id}</strong><small>{ev?.modelKind}</small>{src&&<a href={src.url} target="_blank" rel="noreferrer">{src.manufacturer} · {src.revision} <ExternalLink size={12}/></a>}<p>{part.notes?.[0]??'등록된 모델 데이터'}</p></article>;})}</div></section>
   </div>
  </section>
  <footer>DC 축약 모델 · SPICE/IBIS 없음 · 제작 전 원문 데이터시트와 실측 확인</footer>
 </main></>;
}
