import React from 'react';
import { quickSpecs, partEvidence } from '../ui/viewModel.js';

const KEY_SPECS = 3;
const Row = ({ s }) => <div className="spec-row"><span>{s.label}</span><b>{s.value}</b>{s.condition && <small>{s.condition}</small>}</div>;

/** Key test conditions stay visible; the full source table folds under “더보기”. */
export default function QuickSpecs({part,heading='주요 원문 스펙'}){
 if(!part)return null;
 const specs=quickSpecs(part),source=partEvidence(part)?.source,key=specs.slice(0,KEY_SPECS),rest=specs.slice(KEY_SPECS);
 return <div className="quick-specs" data-testid="quick-specs">
  <strong className="quick-specs-title">ⓘ {heading}</strong>
  <div className="spec-rows key-specs">{key.map((s,i)=><Row key={s.label+i} s={s}/>)}</div>
  <details>
   <summary>더보기{rest.length?' · 스펙 '+rest.length+'줄 더':''}</summary>
   {rest.length>0&&<div className="spec-rows">{rest.map((s,i)=><Row key={s.label+i} s={s}/>)}</div>}
   <p className="subtle">정격·대표곡선·계산용 가정은 서로 다릅니다. 수치가 없는 조건은 추측하지 않습니다.</p>
   {source?.url&&<a href={source.url} target="_blank" rel="noreferrer">데이터시트: {source.manufacturer} · {source.revision}</a>}
   {!source?.url&&<span>사용자 가정 모델 · 제조사 정격 없음</span>}
  </details>
 </div>;
}
