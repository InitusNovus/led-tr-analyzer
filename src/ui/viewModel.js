import { LEDS, SOURCES, getDeviceModel } from '../data/catalog.js';
import { circuitTemplate } from './circuitTemplates.js';
import { opticalCapability } from '../core/optics.js';

export function selectedParts(config, topology){
  const parts=[{instanceId:'LED1',role:'LED',modelId:config.led,part:LEDS[config.led]}];
  for(const slot of topology.deviceSlots){
    const modelId=config.deviceModels?.[slot.id];
    const part=getDeviceModel(modelId);
    if(part) parts.push({instanceId:slot.id,role:slot.role,modelId,part});
  }
  return parts;
}
export function opticalEvidence(led){
  const c=opticalCapability(led);
  if(c.kind==='range')return {code:'range',label:'원문 광도 bin 범위 + 전류 상대곡선'};
  if(c.kind==='scalar')return {code:'scalar-curve',label:'광도 typ anchor + 상대곡선'};
  if(c.kind==='test-point')return {code:'test-point-only',label:'단일 광도 시험점만 확인'};
  return {code:'unavailable',label:c.reason==='absolute-optical-test-current-unknown'?'광도 시험전류 미확인':'검증 가능한 광학 anchor 없음'};
}
export function partEvidence(part){
  if(!part) return null;
  const source=SOURCES[part.source]??null;
  const capabilities=[];
  if(part.vf)capabilities.push('Vf(I) characteristic');
  if(part.vfTableOnly)capabilities.push('Vf table-only');
  if(Number.isFinite(part.vfTempCoefficient))capabilities.push('전기적 온도 보정');
  if(part.optical?.temperature)capabilities.push('광학 온도 곡선');
  if(part.currentDerating||part.thermalResistance)capabilities.push('열 한계 근거');
  if(part.gain)capabilities.push('gain/VBE curves');
  if(part.output)capabilities.push('output curves');
  if(part.on&&part.gain)capabilities.push('terminal curves');
  if(part.drop)capabilities.push('GPIO drop approximation');
  return {source,modelKind:part.modelKind??part.kind??'data',capabilities};
}
const fmt=(v,scale=1,unit='')=>v==null||!Number.isFinite(v)?'—':String(Number((v*scale).toPrecision(4)))+(unit?' '+unit:'');
export function quickSpecs(part) {
  if(!part)return [];
  const xs=[];
  const put=(label,v,scale,unit,condition)=>{if(v!=null&&Number.isFinite(v))xs.push({label,value:fmt(v,scale,unit),condition:condition??null});};
  if(part.source?.startsWith('kento')||part.vfTest||part.vfTableOnly) {
    if(part.vfTest) {
      const vf=part.vfTest;
      const v=[vf.min!=null?fmt(vf.min,1,'V'):null,vf.typ!=null?fmt(vf.typ,1,'V'):null,vf.max!=null?fmt(vf.max,1,'V'):null].filter(Boolean).join(' / ');
      if(v)xs.push({label:'Vf min / typ / max',value:v,condition:fmt(vf.current,1000,'mA')+' · '+(vf.condition??'')});
    }
    const binList=rows=>rows.map(b=>b.id+' '+b.min+'–'+b.max).join(' · '),o=part.optical;
    if(o) {
      const range=Number.isFinite(o.minMcd)&&Number.isFinite(o.maxMcd)?fmt(o.minMcd,1,'mcd')+' … '+fmt(o.maxMcd,1,'mcd'):
        Number.isFinite(o.nominalMcd)?fmt(o.nominalMcd,1,'mcd')+' typ':null;
      if(range)xs.push({label:o.selectedBin?'광도 bin '+o.selectedBin:'광도 anchor',value:range,condition:(Number.isFinite(o.testCurrent)?fmt(o.testCurrent,1000,'mA'):'시험전류 미확인')+(o.selectedBin?' · 선택한 등급 범위':'')});
      if(o.intensityBins?.length)xs.push({label:'광도 bin (P코드)',value:binList(o.intensityBins)+' mcd',condition:'IF '+fmt(o.testCurrent,1000,'mA')+' · p.4 §6.1 · 허용차 ±10%'});
    }
    if(part.bins?.voltage)xs.push({label:'전압 bin (V코드)',value:binList(part.bins.voltage.rows)+' V',condition:'IF '+fmt(part.bins.voltage.current,1000,'mA')+' · '+part.bins.voltage.source+' · '+part.bins.voltage.tolerance});
    if(part.bins?.wavelength)xs.push({label:'파장 bin (품번 끝 숫자와 같은 코드)',value:binList(part.bins.wavelength.rows)+' nm',condition:'IF '+fmt(part.bins.wavelength.current,1000,'mA')+' · '+part.bins.wavelength.source+' · '+part.bins.wavelength.tolerance});
  }
  if(part.modelKind==='user-assumed-thevenin')xs.push({label:'제어원 모델',value:'이상적 DC + 설정한 출력저항',condition:'실제 전류 한계·보호·역급전 미모델링'});
  if(part.r1)put('내장 R1',part.r1,1,'Ω');
  if(part.r1&&part.ratio)put('내장 R2 (nominal)',part.r1*part.ratio,1,'Ω');
  const lim=part.limits??{};
  put('전류 최대(정격)',lim.current,1000,'mA');
  put('전압 한계',lim.voltage,1,'V');
  put('소자 전력 한계',lim.power,1000,'mW','제조사 실장 조건 확인');
  return xs;
}
export function buildInstanceViews(config,point,validation) {
  const map=new Map(),tpl=circuitTemplate(config.topology);
  const ensure=(id,label=id)=>{if(!map.has(id))map.set(id,{instanceId:id,label,metrics:[],checks:[],modelId:null,part:null,region:null});return map.get(id);};
  for(const id of tpl?.instances??[]) ensure(id);
  const metric=(id,label,value,scale=1,unit='')=>ensure(id).metrics.push({label,value,display:fmt(value,scale,unit)});
  const led=ensure('LED1');led.modelId=config.led;led.part=LEDS[config.led];
  for(const [id,modelId] of Object.entries(config.deviceModels??{})){
    const v=map.get(id);if(v){v.modelId=modelId;v.part=getDeviceModel(modelId);}
  }
  for(const v of map.values()) {
    if(v.instanceId.startsWith('Q1.'))v.parentInstanceId='Q1';
    v.evidence=v.part?partEvidence(v.part):null;
    v.specs=v.part?quickSpecs(v.part):[];
  }
  if(point){
    metric('LED1','전류',point.current,1000,'mA');
    metric('LED1','Vf / 개',point.ledVf,1,'V');
    metric('LED1','LED string power',point.current*point.ledVf*config.seriesCount,1000,'mW');
    if(point.optical?.kind==='range')metric('LED1','광도 min',point.optical.minMcd,1,'mcd'),
        metric('LED1','광도 max',point.optical.maxMcd,1,'mcd');
    if(point.optical?.nominalMcd!=null)metric('LED1','광도 typ',point.optical.nominalMcd,1,'mcd');
    const rled=point.ledger.find(e=>(e.instanceId??e.id)==='RLED');
    metric('RLED','저항',config.resistance,1,'Ω');
    if(rled){metric('RLED','전류',rled.current,1000,'mA');metric('RLED','전압강하',rled.voltage,1,'V');}
    metric('RLED','전력',point.resistorPower,1000,'mW');
    if(config.deviceModels?.GPIO1){
      metric('GPIO1','핀 전류 (+source)',point.gpioCurrent,1000,'mA');
      metric('GPIO1','단자 전압',point.gpioVoltage,1,'V');
    }
    for(const q of point.semiconductors){
      const id=q.instanceId??q.id, v=ensure(id);
      v.modelId=q.modelId;v.part=getDeviceModel(q.modelId);
      metric(id,'전류',q.current,1000,'mA');
      metric(id,'전압강하',q.voltage,1,'V');
      const die=point.ledger.find(e=>e.id===id+'.die');   // digital transistor: the package loss is the die plus its built-in R1/R2
      if(die){metric(id,'패키지 손실',q.power,1000,'mW');metric(id,'다이 손실',die.power,1000,'mW');}
      else metric(id,'손실',q.power,1000,'mW');
      if(q.base!=null)metric(id,'IB',q.base,1000,'mA');
      if(q.emitter!=null)metric(id,'IE',q.emitter,1000,'mA');
      if(q.gate!=null)metric(id,'|VGS|',Math.abs(q.gate),1,'V');
      if(q.base>0)metric(id,'IC/IB',q.current/q.base,1,'');
      if(q.region)v.region=q.region;
      v.evidence=partEvidence(v.part);v.specs=quickSpecs(v.part);
    }
    if(point.externalInputCurrent!=null && point.externalInputCurrent>0) {
      metric('Q1','external IO/II',point.current/point.externalInputCurrent,1,'');
      metric('Q1','external II',point.externalInputCurrent,1000,'mA');
    }
    for(const e of point.ledger) {
      const id=e.instanceId??e.id;
      if(['LED1','RLED'].includes(id))continue;
      if(point.semiconductors.some(q=>(q.instanceId??q.id)===id))continue;
      if(!map.has(id))continue; // non-component ledger entries are not clickable instances
      if(e.resistance!=null)metric(id,'저항',e.resistance,1,'Ω');
      metric(id,'전류',e.current,1000,'mA');
      metric(id,'전력',e.power,1000,'mW');
    }
  }
  for(const v of map.values()){
    v.checks=(validation?.checks??[]).filter(c=>c.instanceId===v.instanceId);
  }
  return [...map.values()];
}

export const GOAL_BASIS_LABEL = { min: '최저 bin 기준 추정', typ: '제조사 typ anchor 기준', representative: '중간 대표값 가정' };
/** One-line verdict that names the rule used, so a minimum threshold is never read as an exact-target match. */
export const goalVerdict = g => g.status === 'unavailable' ? '현재 구성에서는 이 기준으로 평가할 수 없음'
    : g.status === 'not-computed' ? '현재 조건에서 동작점을 계산할 수 없음'
    : g.criterion === 'approximate' ? (g.met ? '목표 ±' + g.tolerancePct + '% 이내' : '허용 오차 ±' + g.tolerancePct + '% 밖')
    : (g.met ? '최소 목표 이상 충족' : '최소 목표 미달');

/** Lifecycle of the sampled sensitivity result for the current inputs; never inferred from stale data. */
export const cornerPhase = ({ hasPoint, corners, hasSnapshot, stale, running }) =>
    !hasPoint ? 'unavailable'
    : corners ? (corners.error ? 'error' : corners.failures?.length ? 'partial' : 'complete')
    : running ? 'running'
    : (hasSnapshot || stale) ? 'stale' : 'idle';
export const CORNER_PHASE_TEXT = {
    unavailable: '동작점 미계산', idle: '미실행', running: '계산 중…', stale: '입력 변경됨 · 다시 실행 필요',
    error: '분석 실패', partial: '일부 조건 미지원', complete: '완료',
};

/** Quantity in the unit the UI uses (mA, mW, V, ...); SI inside the core. */
export const formatQuantity = (value, unit) => {
    if (value == null || !Number.isFinite(value)) return '—';
    const [scale, label] = unit === 'A' ? [1000, 'mA'] : unit === 'W' ? [1000, 'mW'] : [1, unit ?? ''];
    return (value * scale).toLocaleString('en-US', { maximumSignificantDigits: 4 }) + (label ? ' ' + label : '');
};
export const formatSigned = (value, unit) => (value >= 0 ? '+' : '−') + formatQuantity(Math.abs(value), unit);
