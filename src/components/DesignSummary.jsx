import React from 'react';
import { PACKAGE_PRESETS } from '../data/catalog.js';
import { GOAL_BASIS_LABEL, goalVerdict, CORNER_PHASE_TEXT } from '../ui/viewModel.js';
import { SensitivityRibbon } from './SensitivitySummary.jsx';

const amount=(v,scale=1,unit='')=>v==null||!Number.isFinite(v)?'—':(v*scale).toLocaleString('en-US',{maximumSignificantDigits:4})+(unit?' '+unit:'');
const formatCheck=c=>amount(c.actual,c.unit==='A'?1000:c.unit==='W'?1000:1,c.unit==='A'?'mA':c.unit==='W'?'mW':c.unit??'');
const humanCheck=c=>c?.id??c?.ruleId??'미확인';

function VoltagePath({config,point}){
 if(!point)return null;
 const id=config.topology,items=[];
 const source=id==='gpio-source'?config.vdd:config.vcc;
 const vLed=point.ledVf*config.seriesCount,vRes=point.current*point.config.resistance;
 if(id!=='gpio-source'&&id!=='resistor'&&id!=='gpio-sink'&&point.driverVoltage==null)return null;
 items.push({id:'RLED',value:vRes},{id:'LED1',value:vLed});
 if(id==='npn-current-sink')items.push({id:'RE',value:(point.emitterCurrent??0)*config.emitterResistance});
 if(point.driverVoltage!=null)items.push({id:id.startsWith('gpio-')?'GPIO1':id==='npn-pnp'||id==='npn-pmos'||id==='nmos-pmos'?'Q2':'Q1',value:point.driverVoltage});
 const sum=items.reduce((n,x)=>n+x.value,0);
 return <div className="design-voltage">
  <strong>부하 경로 전압 분담</strong>
  <div className="voltage-rail"><span>{id==='gpio-source'?'GPIO VDD':'VLED'} {amount(source,1,'V')}</span><span>Σ {amount(sum,1,'V')}</span></div>
  <div className="voltage-segments">
   {items.map((x,i)=><div key={x.id+i} className="voltage-segment" style={{flexGrow:Math.max(1,x.value/source*100)}}>
     <span>{x.id}</span><b>{amount(x.value,1,'V')}</b>
   </div>)}
  </div>
  {(id==='npn-follower'||id==='npn-current-sink'||id==='npn-pnp'||id==='npn-pmos'||id==='nmos-pmos')&&
   <small>부하 전압 경로의 요약입니다. GPIO/베이스 구동 분기는 별도이며 동일 전류가 아닙니다.</small>}
 </div>;
}
function PowerUsage({config,point,corners}){
 if(!point)return null;
 const limit=config.resistorRating*config.derating,nominal=point.resistorPower;
 const sampled=corners?.extrema?.resistorPower?.max??null,peak=sampled?.value??null;
 const ratio=limit>0?nominal/limit:0;
 const basis=peak??nominal;
 const recommendation=Object.entries(PACKAGE_PRESETS).find(([,rated])=>rated*config.derating>=basis);
 return <div className="design-power">
  <div className="design-power-head"><strong>RLED 전력 예산</strong><span>{amount(nominal,1000,'mW')} / {amount(limit,1000,'mW')}</span></div>
  <div role="img" aria-label={'RLED nominal 사용률 '+Math.round(ratio*100)+'%'} className="power-meter">
   <span style={{width:Math.min(100,Math.max(0,ratio*100))+'%'}}/>
  </div>
  <div className="design-secondary">
   <span>Nominal 사용률 <b>{Math.round(ratio*100)}%</b></span>
   <span>Sampled peak <b>{sampled?amount(peak,1000,'mW'):'미실행'}</b></span>
  </div>
  <div className="subtle">Generic 패키지 예산 비교: {recommendation?recommendation[0]+' 이상 (설정된 margin 기준)':'등록 preset에 부합하는 후보 없음'}.
  실제 사용 가능 여부는 선택할 저항의 데이터시트·실장·온도에 따릅니다.</div>
 </div>;
}
function OpticalResult({optical}){
 if(!optical)return null;
 const range=optical.kind==='range',value=range?amount(optical.minMcd,1,'mcd')+' … '+amount(optical.maxMcd,1,'mcd'):
  optical.kind==='unavailable'?'현재 조건 미모델링':amount(optical.nominalMcd,1,'mcd');
 return <div className="design-optical"><div><strong>광도 추정</strong><b>{value}</b></div>
  <small>{range?'원문 광도 bin × 상대 광도 곡선. 다른 전류에서 min/max 보증값이 아닙니다.':
    optical.kind==='test-point'?'원문 단일 시험점 전용':'typ 곡선 기반 또는 미지원 조건'}</small>
  {optical.usageGuide&&<details><summary>mcd 실무 사용감 가이드</summary>
   <p>{optical.usageGuide.label}</p><p>{optical.usageGuide.note}</p></details>}
  {optical.kind==='unavailable'&&<small>사유: {optical.reason}</small>}
 </div>;
}
function WarningSummary({point,validation,corners,onInspect}){
 if(!point)return null;
 const exceeded=validation.checks.filter(c=>c.status==='exceeded');
 const unknown=validation.checks.filter(c=>c.status==='unknown');
 const flagged=point.flags.filter(f=>f.startsWith('extrapolation:')||f.startsWith('not-modeled:'));
 const sampled=(corners?.violations??[]).slice(0,4);
 return <div className="design-warnings">
  {exceeded.map((c,i)=><div className="design-alert" key={c.ruleId+c.instanceId+i}>
    <button type="button" onClick={()=>onInspect(c.instanceId)}>초과 · {humanCheck(c)} ({c.instanceId})</button>
    <span>{formatCheck(c)} / 한계 {amount(c.limit,c.unit==='A'?1000:c.unit==='W'?1000:1,c.unit==='A'?'mA':c.unit==='W'?'mW':c.unit)}</span>
    <a href={'#'+(c.instanceId==='RLED'?'resistorRating':c.instanceId==='LED1'?'resistance':'device-slots')}>관련 입력</a>
   </div>)}
  {sampled.map((v,i)=><div className="design-alert" key={'sample'+i}>
    <button type="button" onClick={()=>onInspect(v.check.instanceId)}>Sampled 초과 · {humanCheck(v.check)} ({v.check.instanceId})</button>
    <span>{formatCheck(v.check)} / 한계 {amount(v.check.limit,v.check.unit==='A'?1000:v.check.unit==='W'?1000:1,v.check.unit==='A'?'mA':v.check.unit==='W'?'mW':v.check.unit)}</span>
    <code>{JSON.stringify(v.scenario)}</code>
   </div>)}
  {unknown.length>0&&<p>Nominal 미확인 정격 {unknown.length}건: {unknown.slice(0,3).map(c=>c.id).join(' · ')}</p>}
  {flagged.length>0&&<p>모델 한계 {flagged.length}건: {flagged.slice(0,3).join(' · ')}</p>}
 </div>;
}
function GoalSummary({goal}){
 const optical=goal.kind==='optical',scale=optical?1:1000,unit=optical?'mcd':'mA',applied=goal.origin==='applied';
 const signed=v=>v==null||!Number.isFinite(v)?'—':(v>=0?'+':'−')+amount(Math.abs(v),scale,unit);
 return <div className="design-goal" data-goal-origin={goal.origin} data-goal-status={goal.status} data-goal-criterion={goal.criterion}>
  <strong>{applied?'적용된 목표':'편집 중인 목표'} ({optical?'광도':'전류'}){applied?' · 현재 구성으로 재평가':''}</strong>
  <span>{optical?GOAL_BASIS_LABEL[goal.basis]+' ':''}{amount(goal.target,scale,unit)} → {amount(goal.achieved,scale,unit)}
   {goal.error!=null&&<> · 차이 {signed(goal.error)}{goal.errorPct!=null&&' ('+(goal.errorPct>=0?'+':'−')+Math.abs(goal.errorPct).toFixed(1)+'%)'}</>}</span>
  <em>{goalVerdict(goal)}</em>
  {applied&&<small className="goal-applied">선정 저항 {amount(goal.selectedResistance,1,'Ω')} (연속값 {amount(goal.exactResistance,1,'Ω')}) · {goal.series} · {goal.strategy}</small>}
  {applied&&(goal.drift.length?<small className="goal-drift" role="status">적용 시점과 다른 항목: {goal.drift.map(d=>d.label+' '+(d.from??'—')+' → '+(d.to??'—')+(d.unit?' '+d.unit:'')).join(' · ')}. 위 값은 현재 구성의 계산이며 적용 당시 결과가 아닙니다.</small>
    :<small className="goal-drift" role="status">적용 시점의 구성과 같습니다.</small>)}
  {optical&&<small>광도 목표는 제조사 보증이 아니라 전형적 상대곡선에 기반한 bin 추정입니다.</small>}
 </div>;
}
export default function DesignSummary({config,point,validation,corners,cornerPhase,cornerProgress,mode,goal,onInspect}){
 const sampleState=cornerPhase==='complete'?(corners.anyExceeded?'초과 조건 있음':'입력한 표본 내')
   :cornerPhase==='partial'?'일부 조건 미지원'+(corners.anyExceeded?' · 초과 조건 있음':''):CORNER_PHASE_TEXT[cornerPhase??'idle'];
 return <section className="panel design-summary" aria-label="설계 판단 요약">
  <h2>설계 판단 요약</h2>
  <div className="design-state-grid">
   <div><small>Nominal 정격 검사</small><strong>{validation?.label??'동작점 미계산'}</strong></div>
   <div><small>Sampled sensitivity</small><strong>{sampleState}</strong><span>{corners?.count!=null?corners.validCount+'/'+corners.count+'개 계산':''}</span></div>
  </div>
  <SensitivityRibbon point={point} corners={corners} phase={cornerPhase??'idle'} progress={cornerProgress}/>
  {goal&&<GoalSummary goal={goal}/>}
  <OpticalResult optical={point?.optical}/>
  <VoltagePath config={config} point={point}/>
  <PowerUsage config={config} point={point} corners={corners}/>
  <WarningSummary point={point} validation={validation} corners={corners} onInspect={onInspect}/>
 </section>;
}
