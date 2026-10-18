import React from 'react';
import Help from './Help.jsx';
import { GOAL_BASIS_LABEL, goalVerdict, CORNER_PHASE_TEXT } from '../ui/viewModel.js';
import { SensitivityRibbon } from './SensitivitySummary.jsx';
import QPointSummary from './QPointSummary.jsx';
import { WarningSummary, PowerBudget } from './WarningSummary.jsx';

const amount=(v,scale=1,unit='')=>v==null||!Number.isFinite(v)?'—':(v*scale).toLocaleString('en-US',{maximumSignificantDigits:4})+(unit?' '+unit:'');

function OpticalResult({optical}){
 if(!optical)return null;
 const range=optical.kind==='range',value=range?amount(optical.minMcd,1,'mcd')+' … '+amount(optical.maxMcd,1,'mcd'):
  optical.kind==='unavailable'?'현재 조건 미모델링':Number.isFinite(optical.minMcd)&&Number.isFinite(optical.nominalMcd)?amount(optical.nominalMcd,1,'mcd')+' typ · min '+amount(optical.minMcd,1,'mcd'):amount(optical.nominalMcd,1,'mcd');
 return <div className="design-optical"><div><strong>광도 추정<Help label="광도 추정 설명">{range?'원문 광도 bin × 상대 광도 곡선. 다른 전류에서 min/max 보증값이 아닙니다.':
    optical.kind==='test-point'?'원문 단일 시험점 전용':'typ 곡선 기반 또는 미지원 조건'}</Help></strong><b>{value}</b></div>
  {optical.usageGuide&&<p className="mcd-guide" data-testid="mcd-guide" role="note"><strong className="mcd-guide-label">{optical.usageGuide.label}</strong><Help label="사용 안내" testid="mcd-guide-note">{optical.usageGuide.note}</Help></p>}
  {optical.kind==='unavailable'&&<small>사유: {optical.reason}</small>}
 </div>;
}
function GoalSummary({goal}){
 const optical=goal.kind==='optical',scale=optical?1:1000,unit=optical?'mcd':'mA',applied=goal.origin==='applied';
 const signed=v=>v==null||!Number.isFinite(v)?'—':(v>=0?'+':'−')+amount(Math.abs(v),scale,unit);
 return <div className="design-goal" data-goal-origin={goal.origin} data-goal-status={goal.status} data-goal-criterion={goal.criterion}>
  <strong>{applied?'적용된 목표':'편집 중인 목표'} ({optical?'광도':'전류'}){applied?' · 현재 구성으로 재평가':''}{optical&&<Help label="광도 목표 설명">광도 목표는 제조사 보증이 아니라 전형적 상대곡선에 기반한 bin 추정입니다.</Help>}</strong>
  <span>{optical?GOAL_BASIS_LABEL[goal.basis]+' ':''}{amount(goal.target,scale,unit)} → {amount(goal.achieved,scale,unit)}
   {goal.error!=null&&<> · 차이 {signed(goal.error)}{goal.errorPct!=null&&' ('+(goal.errorPct>=0?'+':'−')+Math.abs(goal.errorPct).toFixed(1)+'%)'}</>}</span>
  <em>{goalVerdict(goal)}</em>
  {applied&&<small className="goal-applied">선정 저항 {amount(goal.selectedResistance,1,'Ω')} (연속값 {amount(goal.exactResistance,1,'Ω')}) · {goal.series} · {goal.strategy}</small>}
  {applied&&(goal.drift.length?<small className="goal-drift" role="status">적용 시점과 다른 항목: {goal.drift.map(d=>d.label+' '+(d.from??'—')+' → '+(d.to??'—')+(d.unit?' '+d.unit:'')).join(' · ')}. 위 값은 현재 구성의 계산이며 적용 당시 결과가 아닙니다.</small>
    :<small className="goal-drift" role="status">적용 시점의 구성과 같습니다.</small>)}
 </div>;
}
export default function DesignSummary({config,point,validation,corners,cornerPhase,cornerProgress,mode,goal,marginPct,view,onInspect,onFocusInput,onSetConfig}){
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
  {point&&<details className="fold" data-fold="qpoint"><summary><b>전압 분담 · β/IB · 소자별 구동</b><span className="fold-summary">펼쳐서 KVL 경로와 소자 동작 보기</span></summary>
   <QPointSummary point={point} onInspect={onInspect}/></details>}
  <PowerBudget config={config} point={point} corners={corners} cornerPhase={cornerPhase} onApplyPreset={rated=>onSetConfig('resistorRating',rated)}/>
  <WarningSummary config={config} point={point} validation={validation} corners={corners} cornerPhase={cornerPhase} marginPct={marginPct} view={view} onInspect={onInspect} onFocusInput={onFocusInput}/>
 </section>;
}
