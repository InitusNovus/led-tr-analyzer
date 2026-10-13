import React from 'react';
import { quickSpecs, partEvidence } from '../ui/viewModel.js';
export default function QuickSpecs({part,heading='주요 원문 스펙'}){
 if(!part)return null;
 const specs=quickSpecs(part),source=partEvidence(part)?.source;
 return <details className="quick-specs">
  <summary>ⓘ {heading}</summary>
  <div className="spec-rows">{specs.map((s,i)=><div key={s.label+i} className="spec-row">
   <span>{s.label}</span><b>{s.value}</b>{s.condition&&<small>{s.condition}</small>}</div>)}</div>
  <p className="subtle">정격·대표곡선·계산용 가정은 서로 다릅니다. 수치가 없는 조건은 추측하지 않습니다.</p>
  {source?.url&&<a href={source.url} target="_blank" rel="noreferrer">데이터시트: {source.manufacturer} · {source.revision}</a>}
  {!source?.url&&<span>사용자 가정 모델 · 제조사 정격 없음</span>}
 </details>;
}
