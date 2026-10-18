import React,{useEffect,useMemo,useReducer,useRef,useState}from'react';
import{ArrowLeft,Download,ExternalLink,RotateCcw,Zap,ChevronRight}from'lucide-react';
import{TOPOLOGIES,topologyById,topologyUsesGPIO}from'./core/topologies.js';
import{designReducer,initialDesignState}from'./ui/designState.js';
import{startCornerRun}from'./ui/cornerRunner.js';
import{analyzePoint,analyzeCorners,selectResistance}from'./core/analysis.js';
import{evaluateGoal,goalDrift,intentFromGoal}from'./core/goal.js';
import{LEDS,ledModel,ledIntensityBins,SOURCES,PACKAGE_PRESETS,modelsForFamily,getDeviceModel}from'./data/catalog.js';
import{selectedParts,partEvidence,opticalEvidence,buildInstanceViews,goalVerdict,cornerPhase}from'./ui/viewModel.js';
import CircuitDiagram from'./components/CircuitDiagram.jsx';
import DesignSummary from './components/DesignSummary.jsx';
import ResultStrip from './components/ResultStrip.jsx';
import{SensitivityWitness}from'./components/SensitivitySummary.jsx';
import QuickSpecs from './components/QuickSpecs.jsx';
import Help from './components/Help.jsx';
import { opticalCapability } from './core/optics.js';
import { flagText } from './core/flags.js';
import { sortedPresets } from './core/warnings.js';
import { toleranceReadout, seriesAdvice, exploreScale } from './ui/tolerance.js';
import'./index.css';

const show=(v,scale=1,unit='')=>v==null||!Number.isFinite(v)?'—':(v*scale).toLocaleString('en-US',{maximumSignificantDigits:4})+(unit?' '+unit:'');
const cls=(...v)=>v.filter(Boolean).join(' ');
function Flag({value}){return<li>{flagText(value)}</li>;}
function NumberField({name,label,value,onChange,unit='',step='any',disabled=false}){
 const blank=value==='';
 return <label className="field" htmlFor={name}><span>{label}<small>{unit}</small></span>
  <input id={name} type="number" step={step} value={value} disabled={disabled} aria-invalid={blank}
   onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/>
  {blank&&<small className="field-error" role="alert">값을 입력하면 이 필드가 다시 계산됩니다.</small>}
 </label>;
}
function Metric({label,value,hint}){return<div className="metric"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div>;}
function PartPicker({slot,modelId,onChange,onInspect}){
 const models=modelsForFamily(slot.family),part=getDeviceModel(modelId),src=part?SOURCES[part.source]:null;
 return<div className="part-picker"><button type="button" className="part-picker-head" onClick={()=>onInspect(slot.id)}><span><b>{slot.id}</b><small>{slot.role}</small></span><ChevronRight size={16}/></button>
   <label className="field compact" htmlFor={'model-'+slot.id}><span>실제 부품</span><select id={'model-'+slot.id} value={modelId} onChange={e=>onChange(slot.id,e.target.value)}>{models.map(m=><option key={m.modelId} value={m.modelId}>{m.name}</option>)}</select></label>
   <div className="part-meta"><span>{part?.modelKind??'model'}</span><span>{models.length===1?'현재 지원 모델 1개':models.length+'개 모델'}</span></div>
   {src&&<small className="source-line">{src.manufacturer} · {src.revision}</small>}
   <QuickSpecs part={part}/>
 </div>;
}
function Inspector({view}){
 if(!view)return<div className="inspector empty" role="status">선택한 소자에 대한 모델·결과 연결이 없습니다. 다른 소자를 대신 표시하지 않습니다.</div>;
 return <div className="inspector" data-inspector-id={view.instanceId}>
  <div className="inspector-title"><div><strong>{view.instanceId}</strong><span>{view.part?.name??view.label}</span></div>{view.region&&<em>{view.region}</em>}</div>
  {view.metrics.length?<div className="inspector-metrics">{view.metrics.map((m,i)=><span key={m.label+i}><small>{m.label}</small><b>{m.display}</b></span>)}</div>:
   <small className="subtle">동작점 수치 없음<Help label="설명">이 소자의 동작점은 아직 계산되지 않았거나 현재 구조에서 수치가 없습니다. 정적 부품 정보는 유지됩니다.</Help></small>}
  {view.checks?.length>0&&<div className="instance-checks"><strong>이 소자의 정격 검사</strong>{view.checks.map((c,i)=><div key={c.ruleId+i}>
     <span>{c.id} · {c.status}</span>
     <small>{show(c.actual,c.unit==='A'||c.unit==='W'?1000:1,c.unit==='A'?'mA':c.unit==='W'?'mW':c.unit)} / {show(c.limit,c.unit==='A'||c.unit==='W'?1000:1,c.unit==='A'?'mA':c.unit==='W'?'mW':c.unit)}</small>
   </div>)}</div>}
  {view.evidence&&<div className="evidence-mini"><span>{view.evidence.modelKind}</span>{view.evidence.capabilities.map(x=><span key={x}>{x}</span>)}</div>}
  {view.part&&<QuickSpecs part={view.part} heading="선택 소자 정적 스펙"/>}
  {!view.part&&view.parentInstanceId&&<p className="subtle">내장 소자 · 상위 {view.parentInstanceId}</p>}
 </div>;
}
export default function App(){
 const[state,dispatch]=useReducer(designReducer,undefined,initialDesignState);
 const{config,mode,targetMa,targetMcd,targetKind,opticalBasis,opticalNotice,series,strategy,criterion,tolerancePct,appliedGoal,marginPct,cornerSnapshot,cornersStale,includeDtc,selectedInstance}=state;
 const patch=(p,invalidate=false)=>dispatch({type:'patch',patch:p,invalidate});
 const setMode=v=>patch({mode:v}),setTargetMa=v=>patch({targetMa:v}),setTargetMcd=v=>patch({targetMcd:v}),
  setOpticalBasis=v=>patch({opticalBasis:v}),setSeries=v=>patch({series:v}),setStrategy=v=>patch({strategy:v}),
  setCriterion=v=>patch({criterion:v}),setMarginPct=v=>patch({marginPct:v}),setTolerancePct=v=>patch({tolerancePct:v}),setIncludeDtc=v=>patch({includeDtc:v}),setCornerSnapshot=v=>dispatch({type:'corners',snapshot:v}),setSelectedInstance=v=>patch({selectedInstance:v});
 const t=topologyById(config.topology),led=ledModel(config.led,config.ledBin),optical=opticalEvidence(led),ledBins=ledIntensityBins(config.led);
 const set=(key,value)=>dispatch({type:'config',key,value});
 const setDevice=(id,value)=>dispatch({type:'device',id,value});
 const changeTopology=id=>dispatch({type:'topology',id});
 const changeLed=id=>dispatch({type:'led',id});
 const changeLedBin=bin=>dispatch({type:'ledBin',bin});
 const changeTargetKind=kind=>dispatch({type:'targetKind',kind});
 const opticalCap=opticalCapability(led);
 const result=useMemo(()=>{
   if(mode==='verify')return analyzePoint(config);
   try{const sizing=selectResistance(config,targetKind==='current'?targetMa/1000:.001,
     {series,strategy,targetMcd:targetKind==='mcd'?targetMcd:null,opticalBasis,criterion,tolerancePct});
     return {...sizing.result,sizing};
   }catch(e){return{ok:false,error:{code:e.code??'calculation-error',message:e.message}};}
 },[config,mode,targetMa,targetMcd,targetKind,opticalBasis,series,strategy,criterion,tolerancePct]);
 const p=result.ok?result.point:null,applied=p?.config??null,configKey=JSON.stringify({applied,mode,targetMa,targetMcd,targetKind,opticalBasis,series,strategy,includeDtc}),corners=cornerSnapshot&&p&&cornerSnapshot.key===configKey?cornerSnapshot.result:null;
 // The default 81-scenario run is cheap (~20-40 ms), so it follows the inputs after a short debounce.
 // The extended DTC sweep (729 scenarios, ~170 ms) stays a manual action.
 // Runs are time-boxed (see cornerRunner) because some topologies need ~4 ms per scenario.
 const[cornerProgress,setCornerProgress]=useState(null),[manualRunning,setManualRunning]=useState(false),manualCancel=useRef(null);
 const autoCorners=!includeDtc,phase=cornerPhase({hasPoint:!!p,corners,hasSnapshot:cornerSnapshot!==null,stale:cornersStale,running:(autoCorners&&!corners)||manualRunning});
 const runCorners=(opts,done)=>startCornerRun(p.config,{...opts,onProgress:setCornerProgress,
   onDone:r=>{setCornerProgress(null);done();setCornerSnapshot({key:configKey,result:r});},
   onError:e=>{setCornerProgress(null);done();setCornerSnapshot({key:configKey,result:{error:e.message}});}});
 useEffect(()=>{
   if(!p||!autoCorners||corners)return;
   let cancel=()=>{};
   const timer=setTimeout(()=>{cancel=runCorners({includeDtc:false},()=>{});},250);
   return()=>{clearTimeout(timer);cancel();setCornerProgress(null);};
 },[configKey,autoCorners,!!p,!!corners]);
 useEffect(()=>()=>{manualCancel.current?.();manualCancel.current=null;setManualRunning(false);setCornerProgress(null);},[configKey]);
 const runManual=()=>{if(!p)return;manualCancel.current?.();setManualRunning(true);
   manualCancel.current=runCorners({includeDtc},()=>{manualCancel.current=null;setManualRunning(false);});};
 const parts=selectedParts(config,t),views=buildInstanceViews(applied??config,p,result.ok?result.validation:null),activeSelected=selectedInstance,selectedView=views.find(v=>v.instanceId===selectedInstance)??null;
 const reset=()=>dispatch({type:'reset'});
 // Moves focus to the first listed input that is on screen (a warning's primary fix), and flashes it.
 const focusInput=ids=>{
   for(const id of ids){
     const el=document.getElementById(id);
     if(!el||el.disabled)continue;
     for(let d=el.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;
     el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true});
     el.setAttribute('data-focus-flash','1');setTimeout(()=>el.removeAttribute('data-focus-flash'),1800);
     return true;
   }
   return false;
 };
 // size mode: the goal being edited; verify mode: the applied goal, re-judged against the live operating point.
 const goalView=useMemo(()=>{
   if(mode==='size')return result.sizing?.goal?{...result.sizing.goal,origin:'editing',drift:[]}:null;
   if(!appliedGoal)return null;
   return{...evaluateGoal(p,appliedGoal.intent),origin:'applied',selectedResistance:appliedGoal.selectedResistance,
     exactResistance:appliedGoal.exactResistance,drift:goalDrift(appliedGoal.snapshot,config)};
 },[mode,result,appliedGoal,p,config]);
 const applyGoal=()=>dispatch({type:'applyGoal',intent:intentFromGoal(result.sizing.goal,{series,strategy}),
   selectedResistance:result.sizing.selected,exactResistance:result.sizing.exact});
 const exportResult=()=>{if(!p)return;const modelSnapshot=selectedParts(p.config,t).map(x=>({instanceId:x.instanceId,modelId:x.modelId,...(x.instanceId==='LED1'?{selectedIntensityBin:p.config.ledBin??null}:{}),source:x.part.source,sourceRevision:SOURCES[x.part.source]?.revision??null,modelKind:x.part.modelKind??x.part.kind??null}));const report={schemaVersion:4,application:'LED-TR Analyzer',scope:'datasheet-based reduced DC model, not SPICE',inputDraft:config,designIntent:{mode,targetMa,targetMcd,targetKind,opticalBasis,series,strategy,criterion,tolerancePct},appliedConfiguration:p.config,modelSnapshot,result,corners,optical:p.optical,goal:goalView,editingGoal:result.sizing?.goal??null,appliedGoal:appliedGoal?{intent:appliedGoal.intent,selectedResistance:appliedGoal.selectedResistance,exactResistance:appliedGoal.exactResistance,configSnapshot:appliedGoal.snapshot,evaluation:evaluateGoal(p,appliedGoal.intent),drift:goalDrift(appliedGoal.snapshot,config)}:null,migrationNote:'LED1 records selectedIntensityBin (null = whole datasheet range) and the configuration carries ledBin; v4 keeps the applied goal, its configuration snapshot and a live re-evaluation; v3 had only the sizing-time goal; v2 stored exact model IDs.'};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='led-tr-analysis-v4.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const number=(name,label,unit='',step='any')=><NumberField key={name} name={name} label={label} unit={unit} step={step} value={config[name]} onChange={v=>set(name,v)}/>;
 const ratingSummary=`RLED 정격 ${show(config.resistorRating,1000,'mW')} × ${config.derating} = ${show(config.resistorRating*config.derating,1000,'mW')} · 주변 ${config.ambient}°C · 여유 경고 ${marginPct}%`;
 const ledgerSummary=result.ok?`${p.ledger.length}개 소자 · ${result.validation.label}`:'';
 const advice=mode==='size'?seriesAdvice(series,config.resistorTolerance):null,scaleCurrent=exploreScale('current',led),scaleMcd=exploreScale('mcd',led);
 const q1=getDeviceModel(config.deviceModels?.Q1),sizeSupported=t.supportedOperations.includes('size');
 return<>
 <header className="topbar"><div className="top-inner"><a href="/" className="brand">InitusNovus</a><nav className="nav-links"><a href="/" className="back"><ArrowLeft size={16}/> Home</a><a href="https://github.com/InitusNovus/led-tr-analyzer" target="_blank" rel="noreferrer">Source <ExternalLink size={14}/></a></nav></div></header>
 <main className="shell">
  <div className="title-row"><div><div className="eyebrow"><Zap size={15}/> DATASHEET / DC</div><h1>LED-TR Analyzer</h1><p>실제 부품 모델과 회로 구조를 연결해 보는 축약 비선형 DC 분석기</p></div><div className="actions"><button onClick={reset}><RotateCcw size={15}/> 전체 초기화</button><button onClick={exportResult} disabled={!p}><Download size={15}/> 결과 JSON</button></div></div>
  <ResultStrip point={p} validation={result.ok?result.validation:null} corners={corners} cornerPhase={phase} goal={goalView} config={config} marginPct={marginPct} error={result.ok?null:result.error}/>
  <section className="workbench">
   <div className="setup-column">
   <div className="panel setup-panel"><h2>회로와 실제 부품</h2>
    <label className="field" htmlFor="topology"><span>토폴로지<Help label="토폴로지 설명">{t.path}<br/>토폴로지 전환 시 기본 ON 상태({t.active})로 설정됩니다.</Help></span><select id="topology" value={config.topology} onChange={e=>changeTopology(e.target.value)}>{TOPOLOGIES.map(x=><option key={x.id} value={x.id}>{x.family} · {x.name}</option>)}</select></label>
    <details className="topology-gallery"><summary>지원 회로 13종 보기</summary><div className="topology-cards">{TOPOLOGIES.map(x=><button key={x.id} className={cls(config.topology===x.id&&'active')} onClick={()=>changeTopology(x.id)}><b>{x.name}</b><small>{x.path}</small></button>)}</div></details>
    <label className="field" htmlFor="led"><span>LED1</span><select id="led" value={config.led} onChange={e=>changeLed(e.target.value)}>{Object.values(LEDS).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    {ledBins.length>0&&<div className="led-bin" data-testid="led-bin">
      <label className="field" htmlFor="led-bin"><span>광도 등급 (bin)<Help label="광도 등급 설명" className="led-bin-help" testid="led-bin-help">데이터시트의 광도 bin은 P코드(P19 …)입니다. 품번 끝의 R1–R5 같은 코드는 같은 데이터시트에서 <b>파장 bin</b>이며 밝기와는 별개입니다. 등급을 고르면 광도 범위와 목표 역산이 그 범위로 좁아지고, 고르지 않으면 지금처럼 전체 bin 범위를 씁니다. 등급은 보증값이 아니라 제조사 분류 범위입니다.</Help><small>선택 안 하면 전체 범위</small></span>
       <select id="led-bin" value={config.ledBin??''} onChange={e=>changeLedBin(e.target.value)}>
        <option value="">미지정 · 전체 {ledModel(config.led).optical.minMcd}–{ledModel(config.led).optical.maxMcd} mcd</option>
        {ledBins.map(b=><option key={b.id} value={b.id}>{b.id} · {b.min}–{b.max} mcd @ {ledModel(config.led).optical.testCurrent*1000} mA</option>)}
       </select></label>
      
    </div>}
    <div className="part-meta"><span>{led.kind}</span><span>{optical.label}</span></div><QuickSpecs part={led} heading="LED 시험조건·광도 범위"/>
    <div className="supply-grid">{number('vcc','VLED / collector rail','V')}{topologyUsesGPIO(t)&&number('vdd',config.deviceModels?.GPIO1==='assumed:DC-Thevenin'?'제어원 HIGH 전압':'GPIO 전원','V')}{number('seriesCount','직렬 LED','개',1)}{number('temperature','전기 모델 온도','°C')}</div>
    <div className="device-slots" id="device-slots">{t.deviceSlots.map(slot=><PartPicker key={slot.id} slot={slot} modelId={config.deviceModels?.[slot.id]??slot.defaultModelId} onChange={setDevice} onInspect={setSelectedInstance}/>)}</div>
   </div>
    {topologyUsesGPIO(t)&&<section className="panel drive-panel"><h2>GPIO 및 구동</h2><div className="fields two">
      <label className="field" htmlFor="state"><span>출력 상태</span><select id="state" value={config.state} onChange={e=>set('state',e.target.value)}>{['HIGH','LOW','HI_Z'].map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="field" htmlFor="gpio-mode"><span>출력 모드</span><select id="gpio-mode" value={config.gpioMode} onChange={e=>set('gpioMode',e.target.value)}><option value="push-pull">Push-pull</option><option value="open-drain">Open-drain</option></select></label>
      <label className="field" htmlFor="pull"><span>Hi-Z pull</span><select id="pull" value={config.pull} onChange={e=>set('pull',e.target.value)}><option value="none">없음</option><option value="up">Pull-up</option><option value="down">Pull-down</option></select></label>
      {config.pull!=='none'&&number('pullResistance','GPIO pull','Ω')}
    </div>
    {config.deviceModels?.GPIO1==='assumed:DC-Thevenin'&&number('sourceResistance','제어원 Rout','Ω')}
    {config.deviceModels?.GPIO1==='assumed:DC-Thevenin'&&<p className="subtle">사용자 가정 DC 제어원: 실제 전류한계·역급전·보호특성은 미모델링입니다.</p>}
    {t.activeParameters.includes('baseResistance')&&number('baseResistance','RB','Ω')}
    {t.activeParameters.includes('emitterResistance')&&number('emitterResistance','RE','Ω')}
    {t.activeParameters.includes('gateResistance')&&number('gateResistance',t.id==='nmos-pmos'?'RG / Rdrive · 공용':'RG / Rdrive','Ω')}
    {t.activeParameters.includes('gatePull')&&number('gatePull',t.id==='nmos-pmos'?'RGS(in/out) · 공용':t.id==='npn-pnp'?'RBE pull-up':'RGS / pull-up','Ω')}
    {q1?.family==='digital-npn'&&<div className="model-chip">Q1 {q1.id} · R1 {q1.r1}Ω · R2/R1 {config.dtcRatio}<br/>내부 저항 공차는 감도 분석에서 선택할 수 있습니다.</div>}
    </section>}
   </div>
   <div className="main-column">
   <div className="panel schematic-panel">
    <div className="mobile-circuit-toolbar">
      <label className="field" htmlFor="topology-mobile"><span>회로 빠른 선택</span><select id="topology-mobile" value={config.topology} onChange={e=>changeTopology(e.target.value)}>{TOPOLOGIES.map(x=><option key={x.id} value={x.id}>{x.family} · {x.name}</option>)}</select></label>
    </div>
    <CircuitDiagram config={config} point={p} selectedInstance={activeSelected} onSelectInstance={setSelectedInstance}/>
    <div className="quick-results">{p?<><Metric label="LED 전류" value={show(p.current,1000,'mA')} hint={p.region}/><Metric label="LED Vf / 개" value={show(p.ledVf,1,'V')}/>{topologyUsesGPIO(t)&&<Metric label="GPIO 전류" value={show(p.gpioCurrent,1000,'mA')} hint="+ source / − sink"/>}<Metric label="Driver 손실" value={show(p.driverPower,1000,'mW')}/></>:<div className="quick-error"><strong>현재 조건 계산 불가</strong><span>{result.error?.message}</span></div>}</div>
    <details className="fold inspector-fold" data-fold="inspector"><summary><b>선택 소자 {selectedView?selectedView.instanceId:'—'}</b><span className="fold-summary">{selectedView?(selectedView.part?.name??selectedView.label)+(selectedView.region?' · '+selectedView.region:''):'회로도에서 소자를 선택하세요'}</span></summary>
     <Inspector view={selectedView}/></details>
   </div>
    <section className="panel control-card" id="control-card"><h2>계산 모드</h2><div className="tabs" role="group" aria-label="계산 모드"><button className={mode==='verify'?'active':''} onClick={()=>setMode('verify')}>저항으로 검증</button><button className={mode==='size'?'active':''} disabled={!sizeSupported} title={!sizeSupported?'이 회로는 RE로 전류를 설정합니다.':''} onClick={()=>setMode('size')}>목표에서 저항 선정</button></div>
     {!sizeSupported&&<p className="subtle">이 토폴로지는 RLED 자동 역산 대신 RE를 직접 설정해 검증합니다.</p>}
     {mode==='verify'?<NumberField name="resistance" label="RLED" unit="Ω" value={config.resistance} onChange={v=>set('resistance',v)}/>:<>
       <div className="fields two">
        {targetKind==='current'?<NumberField name="targetMa" label="목표 LED 전류" unit="mA" value={targetMa} onChange={v=>{setTargetMa(v);setCornerSnapshot(null);}}/>:
          <NumberField name="targetMcd" label="목표 광도" unit="mcd" value={targetMcd} onChange={v=>{setTargetMcd(v);setCornerSnapshot(null);}}/>}
        <label className="field" htmlFor="target-kind"><span>목표 단위</span>
         <select id="target-kind" value={targetKind} onChange={e=>changeTargetKind(e.target.value)}>
          <option value="current">전류</option><option value="mcd" disabled={!opticalCap.canInvert}>광도 · 근거곡선</option>
         </select></label>
       </div>
       {targetKind==='current'&&<div className="target-explore">
         <label htmlFor="target-slider">전류 빠른 탐색 · 0.5–25mA (권장/정격 범위가 아님)</label>
         <input id="target-slider" type="range" min="0.5" max="25" step="0.5"
           value={typeof targetMa==='number'?Math.max(.5,Math.min(25,targetMa)):10}
           onChange={e=>{setTargetMa(Number(e.target.value));setCornerSnapshot(null);}}/>
       <Help label="눈금 설명" className="explore-scale" testid="explore-scale">{scaleCurrent.note} · LED {scaleCurrent.rated!=null?'정격 최대 '+show(scaleCurrent.rated,1000,'mA'):'정격 최대 미확인'}</Help>
       </div>}
       {targetKind==='mcd'&&<div className="target-explore">
         <label htmlFor="optical-slider">광도 탐색용 눈금 · 유효범위는 실제 곡선으로 검사</label>
         <input id="optical-slider" type="range" min="1" step="1"
           max={Math.max(20,Math.min(2000,Math.round(1.5*(led.optical?.maxMcd??led.optical?.nominalMcd??200))))}
           value={typeof targetMcd==='number'?Math.max(1,Math.min(Math.max(20,Math.min(2000,Math.round(1.5*(led.optical?.maxMcd??led.optical?.nominalMcd??200)))),targetMcd)):60}
           onChange={e=>{setTargetMcd(Number(e.target.value));setCornerSnapshot(null);}}/>
       <Help label="눈금 설명" className="explore-scale" testid="explore-scale">눈금 {scaleMcd.range} — {scaleMcd.note}
        {scaleMcd.datasheet?.min!=null?' · 제조사 원문 '+show(scaleMcd.datasheet.min,1,'')+'–'+show(scaleMcd.datasheet.max,1,'mcd')+' bin'+(scaleMcd.testCurrent!=null?' @ '+show(scaleMcd.testCurrent,1000,'mA'):''):scaleMcd.datasheet?.typ!=null?' · 제조사 원문 '+show(scaleMcd.datasheet.typ,1,'mcd')+' typ'+(scaleMcd.testCurrent!=null?' @ '+show(scaleMcd.testCurrent,1000,'mA'):''):' · 제조사 광도 anchor 없음'}</Help>
       </div>}
       {targetKind==='mcd'&&<><label className="field" htmlFor="optical-basis"><span>광도 역산 기준<Help label="광도 추정 설명">광도는 선택 시험점과 전형적 상대곡선 기반 추정입니다. 선정 저항으로 목표 달성을 다시 검사합니다.</Help></span>
         <select id="optical-basis" value={opticalBasis} onChange={e=>{setOpticalBasis(e.target.value);setCornerSnapshot(null);}}>
          {opticalCap.hasRange&&<option value="min">최저 bin 기준 추정 (보증 아님)</option>}
          {opticalCap.hasTypical&&<option value="typ">제조사 typ anchor 기준</option>}
          {opticalCap.hasRange&&<option value="representative">중간 대표값 가정 (typ 아님)</option>}
         </select></label>
         </>}
       {opticalNotice&&<p role="status" className="model-chip">{opticalNotice}</p>}
       {!opticalCap.canInvert&&<p className="subtle">이 LED는 광도 역산의 근거가 부족합니다. 전류 목표는 사용할 수 있습니다.</p>}
       <div className="fields two"><label className="field" htmlFor="goal-criterion"><span>목표 판정 기준</span>
         <select id="goal-criterion" value={criterion} onChange={e=>setCriterion(e.target.value)}>
          <option value="minimum">최소 목표 이상 (미만이면 미달)</option><option value="approximate">목표 ± 허용 오차 이내</option>
         </select></label>
         {criterion==='approximate'&&<NumberField name="tolerancePct" label="허용 오차" unit="±%" value={tolerancePct} onChange={setTolerancePct}/>}</div>
       <div className="fields two"><label className="field" htmlFor="series"><span>E-series<Help label="E-series 설명">E-series는 표준값 계열이며 실제 부품 공차와 독립입니다. 계열을 바꿔도 공차는 그대로입니다.</Help></span><select id="series" value={series} onChange={e=>setSeries(e.target.value)}>{['E24','E96','E24+E96'].map(s=><option key={s}>{s}</option>)}</select></label><label className="field" htmlFor="strategy"><span>표준값 선택</span><select id="strategy" value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="closest">가장 가까운 저항</option><option value="safe">큰 저항</option><option value="bright">작은 저항</option></select></label></div>
       {advice&&<div className="series-advice"><Help label="E-series 조언" testid="series-advice">{advice.series} · {advice.spacing}. {advice.note} 선택한 계열은 공차를 바꾸지 않습니다 (현재 RLED 공차 ±{config.resistorTolerance}%).</Help>
        {advice.suggestion&&<button type="button" className="chip" data-action="apply-series-tolerance" onClick={()=>set('resistorTolerance',advice.suggestion.pct)}>공차를 {advice.suggestion.letter} ±{advice.suggestion.pct}%로 설정</button>}</div>}
       {result.sizing&&<div className="selection" data-testid="selected-resistance">
  <span>{show(result.sizing.selected,1,'Ω')}</span><small>연속값 {show(result.sizing.exact,1,'Ω')}</small>
  {result.sizing.goal&&<b className={result.sizing.goal.met?'goal-met':'goal-missed'}>{goalVerdict(result.sizing.goal)}</b>}
  <button onClick={applyGoal}>검증 모드에 적용</button>
 </div>}
     </>}
    <details className="fold rating-fold" id="power-settings"><summary><b>정격·공차·감도 입력</b><span className="fold-summary">{ratingSummary}</span></summary>
      <div className="fields two">
       <label className="field" htmlFor="package"><span>RLED generic 패키지 preset<Help label="패키지 preset 설명">Generic preset은 실제 저항 정격을 보증하지 않습니다.</Help></span>
       <select id="package" value={Object.keys(PACKAGE_PRESETS).find(k=>PACKAGE_PRESETS[k]===config.resistorRating)??'custom'}
         onChange={e=>{if(e.target.value!=='custom')set('resistorRating',PACKAGE_PRESETS[e.target.value]);}}>
        {sortedPresets(PACKAGE_PRESETS).map(([k,v])=><option key={k} value={k}>{k} · {v*1000}mW</option>)}
        <option value="custom">직접 지정</option>
       </select></label>
       {number('resistorRating','RLED 실제 정격','W')}
       {number('auxRating','보조 저항 정격','W')}
       {number('derating','입력한 사용 비율','0–1')}
       {number('ambient','주변 온도','°C')}
       <NumberField name="marginPct" label="여유 경고 기준" unit="한계 대비 %" value={marginPct} onChange={setMarginPct}/>
      </div>
     <h3 className="fold-sub">공차 · 감도</h3>
    <div className="fields two">{number('vccTolerance','VLED 변동','±%')}{topologyUsesGPIO(t)&&number('vddTolerance','GPIO 전원 변동','±%')}{number('resistorTolerance','RLED 공차','±%')}{number('vfSpread','LED Vf 이동 가정','±V')}</div>
     <div className="tolerance-presets" role="group" aria-label="공차 빠른 선택">
       {[[5,'J ±5%'],[2,'G ±2%'],[1,'F ±1%'],[.1,'B ±0.1%']].map(([v,label])=>
        <button key={v} type="button" className={cls(config.resistorTolerance===v&&'active')} aria-pressed={config.resistorTolerance===v} onClick={()=>set('resistorTolerance',v)}>{label}</button>)}
      </div>
      <p className="subtle tolerance-readout" data-testid="tolerance-readout" role="status">{toleranceReadout(config.resistorTolerance).text}</p>
     {q1?.family==='digital-npn'&&<label className="check"><input id="include-dtc" type="checkbox" checked={includeDtc} onChange={e=>{setIncludeDtc(e.target.checked);setCornerSnapshot(null);}}/> Q1 R1 및 R2/R1 공차 포함</label>}
     <button className="primary" disabled={!p||manualRunning} onClick={runManual}>{manualRunning?'분석 중…':'현재 조건 분석'}</button>
     <Help label="분석 실행 설명">{autoCorners?'기본 표본(공차 축 곱)은 입력이 멈추면 자동으로 계산합니다. 버튼은 다시 실행할 때 씁니다.':'DTC 내부 공차를 포함한 확장 분석은 느리므로 직접 실행합니다.'}</Help>
    </details>
    </section>
    {!result.ok&&<section className="notice error" role="alert"><h2>계산할 수 없는 조건</h2><p>{result.error.message}</p><small>{result.error.code}</small></section>}
    <DesignSummary config={p?.config??config} point={p} validation={result.ok?result.validation:null}
     corners={corners} cornerPhase={phase} cornerProgress={cornerProgress} mode={mode} goal={goalView} marginPct={marginPct}
     view={{mode,targetKind}} onInspect={setSelectedInstance} onFocusInput={focusInput} onSetConfig={set}/>
    <section className="panel fold-group" aria-label="상세"><h2>상세</h2>
     {result.ok&&<details className="fold" data-fold="report"><summary><b>동작점 · 소자별 전력</b><span className="fold-summary">{ledgerSummary}</span></summary>
     <section className="panel report" aria-label="동작점 결과" aria-live="polite"><div className="report-head"><h2>동작점</h2><span className={'status '+result.validation.status}>{result.validation.label}</span></div><div className="metrics">
      <Metric label="LED 전류" value={show(p.current,1000,'mA')} hint={p.region+' · DC'}/><Metric label="LED 전압 / 개" value={show(p.ledVf,1,'V')}/>
      {topologyUsesGPIO(t)&&<><Metric label="GPIO 전류 (+source / −sink)" value={show(p.gpioCurrent,1000,'mA')}/><Metric label="GPIO 단자 전압" value={show(p.gpioVoltage,1,'V')}/></>}
      {p.semiconductors.length>0&&<Metric label="출력 driver 전압강하" value={show(p.driverVoltage,1,'V')}/>}
      <Metric label="광학 결과" value={p.optical?.kind==='range'?show(p.optical.minMcd,1,'mcd')+' … '+show(p.optical.maxMcd,1,'mcd'):
  show(p.optical?.nominalMcd,1,'mcd')}
  hint={p.optical?.kind==='range'?'광도 bin × 상대곡선 · 보증 아님':optical.label}/>
     </div></section>
     <section className="notice model-note"><strong>모델 가정<Help label="모델 가정 설명">선택한 실제 품번의 datasheet 곡선/표를 사용하며, 자료가 없는 조건은 근사·미모델링으로 표시합니다.</Help></strong><details><summary>근사·외삽·미모델링 ({p.flags.length})</summary><ul>{p.flags.map(f=><Flag key={f} value={f}/>)}</ul></details></section>
     <section className="panel"><h2>소자별 전력과 정격</h2>
      <div className="table-scroll"><table><thead><tr><th>ref</th><th>전류</th><th>전압</th><th>DC 전력</th></tr></thead><tbody>{p.ledger.map((e,i)=><tr key={e.id+i} data-instance-id={e.instanceId}><th>{e.id}</th><td>{show(e.current,1000,'mA')}</td><td>{show(e.voltage,1,'V')}</td><td>{show(e.power,1000,'mW')}</td></tr>)}</tbody></table></div>
      <details><summary>전체 한계 검사</summary><div className="table-scroll"><table><thead><tr><th>항목</th><th>계산값</th><th>한계</th><th>상태</th></tr></thead><tbody>{result.validation.checks.map(x=><tr key={x.id} className={x.status==='exceeded'?'limit-error':''}><th title={x.condition}>{x.id}</th><td>{show(x.actual,x.unit==='A'||x.unit==='W'?1000:1,x.unit==='A'?'mA':x.unit==='W'?'mW':x.unit)}</td>
 <td>{show(x.limit,x.unit==='A'||x.unit==='W'?1000:1,x.unit==='A'?'mA':x.unit==='W'?'mW':x.unit)}</td><td>{x.status}</td></tr>)}</tbody></table></div></details>
     </section>
     </details>}
     <details className="fold" data-fold="sensitivity"><summary><b>감도 상세 (극값 조건 표)</b><span className="fold-summary">{corners?(corners.error?'계산 오류':corners.validCount+'/'+corners.count+'개 조건 계산'):'아직 계산 전'}</span></summary>
     {corners&&(corners.error?<p role="alert">{corners.error}</p>:<div className="corner-results"><p>{corners.validCount}/{corners.count} 조건 계산 · {corners.failures.length}개 미지원/실패 · {corners.failures.length?'일부 조건 제외됨':corners.anyExceeded?'한계 초과 조건 있음':'계산한 표본의 검사 완료'}</p>
       <SensitivityWitness corners={corners} point={p} config={p.config}/></div>)}
     </details>
     <details className="fold" data-fold="evidence"><summary><b>선택 부품의 데이터 근거</b><span className="fold-summary">{parts.length}개 소자</span></summary>
    <section className="panel"><h2>선택 부품의 데이터 근거</h2><div className="evidence-grid">{parts.map(({instanceId,role,modelId,part})=>{const ev=partEvidence(part),src=ev?.source;return<article className="evidence-card" key={instanceId}><div><b>{instanceId}</b><span>{role}</span></div><strong>{part.name??part.id}</strong><small>{ev?.modelKind}</small>{src&&(src.url?<a href={src.url} target="_blank" rel="noreferrer">{src.manufacturer} · {src.revision} <ExternalLink size={12}/></a>:
   <span>{src.manufacturer} · 제조사 정격 없음</span>)}<p>{part.notes?.[0]??'등록된 모델 데이터'}</p></article>;})}</div></section>
     </details>
    </section>
   </div>
  </section>
  <footer>DC 축약 모델 · SPICE/IBIS 없음 · 제작 전 원문 데이터시트와 실측 확인</footer>
 </main></>;
}
