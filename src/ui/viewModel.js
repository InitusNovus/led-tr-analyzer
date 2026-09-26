import { LEDS, SOURCES, getDeviceModel } from '../data/catalog.js';

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
  const o=led?.optical;
  if(!o) return {code:'none',label:'광학 모델 없음'};
  if(Number.isFinite(o.nominalMcd)&&o.relative) return {code:'scalar-curve',label:'절대 광도 anchor + 상대곡선'};
  if(Number.isFinite(o.nominalMcd)) return {code:'test-point-only',label:'단일 시험점 광도'};
  if(Number.isFinite(o.minMcd)||Number.isFinite(o.maxMcd)) return {code:'range-only',label:'원문 광도 범위 있음 · 단일 typ 없음'};
  return {code:'metadata-only',label:'광학 metadata만 있음'};
}
export function partEvidence(part){
  if(!part) return null;
  const source=SOURCES[part.source]??null;
  const capabilities=[];
  if(part.vf) capabilities.push('Vf(I) curve');
  if(part.vfTableOnly) capabilities.push('Vf table-only');
  if(Number.isFinite(part.vfTempCoefficient)||part.optical?.temperature) capabilities.push('temperature evidence');
  if(part.gain) capabilities.push('gain/VBE curves');
  if(part.output) capabilities.push('output curves');
  if(part.on&&part.gain) capabilities.push('terminal curves');
  if(part.drop) capabilities.push('GPIO limit curve');
  return {source,modelKind:part.modelKind??part.kind??'data',capabilities};
}
const fmt=(v,scale=1,unit='')=>v==null||!Number.isFinite(v)?'—':String(Number((v*scale).toPrecision(4)))+(unit?' '+unit:'');
export function buildInstanceViews(config,point,validation){
  const map=new Map();
  const ensure=(id,label=id)=>{if(!map.has(id))map.set(id,{instanceId:id,label,metrics:[],checks:[],modelId:null,part:null});return map.get(id);};
  const metric=(id,label,value,scale=1,unit='')=>ensure(id).metrics.push({label,value,display:fmt(value,scale,unit)});
  const led=ensure('LED1','LED1');led.modelId=config.led;led.part=LEDS[config.led];
  const rled=ensure('RLED','RLED');
  if(point){
    metric('LED1','전류',point.current,1000,'mA');metric('LED1','Vf / 개',point.ledVf,1,'V');metric('LED1','string power',point.current*point.ledVf*config.seriesCount,1000,'mW');
    if(point.luminousMcd!=null)metric('LED1','광도 추정',point.luminousMcd,1,'mcd');
    metric('RLED','저항',config.resistance,1,'Ω');metric('RLED','전력',point.resistorPower,1000,'mW');
    if(config.deviceModels?.GPIO1){
      const g=ensure('GPIO1','GPIO1');g.modelId=config.deviceModels.GPIO1;g.part=getDeviceModel(g.modelId);
      metric('GPIO1','핀 전류',point.gpioCurrent,1000,'mA');metric('GPIO1','단자 전압',point.gpioVoltage,1,'V');
    }
    for(const q of point.semiconductors){
      const v=ensure(q.instanceId??q.id,q.instanceId??q.id);v.modelId=q.modelId;v.part=getDeviceModel(q.modelId);
      metric(v.instanceId,'전류',q.current,1000,'mA');metric(v.instanceId,'전압강하',q.voltage,1,'V');metric(v.instanceId,'손실',q.power,1000,'mW');
      if(q.base!=null)metric(v.instanceId,'IB',q.base,1000,'mA');
      if(q.emitter!=null)metric(v.instanceId,'IE',q.emitter,1000,'mA');
      if(q.gate!=null)metric(v.instanceId,'|VGS|',Math.abs(q.gate),1,'V');
      v.region=q.region;
    }
    for(const e of point.ledger){
      if(['LED1','RLED'].includes(e.instanceId)) continue;
      if(point.semiconductors.some(q=>(q.instanceId??q.id)===e.instanceId)) continue;
      const v=ensure(e.instanceId??e.id,e.id);
      if(e.resistance!=null)metric(v.instanceId,'저항',e.resistance,1,'Ω');
      metric(v.instanceId,'전류',e.current,1000,'mA');metric(v.instanceId,'전력',e.power,1000,'mW');
    }
  } else if(config.deviceModels?.GPIO1){
    const g=ensure('GPIO1','GPIO1');g.modelId=config.deviceModels.GPIO1;g.part=getDeviceModel(g.modelId);
  }
  for(const [id,v] of map){
    if(v.modelId==null&&config.deviceModels?.[id]){v.modelId=config.deviceModels[id];v.part=getDeviceModel(v.modelId);}
    v.evidence=v.part?partEvidence(v.part):null;
    v.checks=(validation?.checks??[]).filter(c=>c.id===id||c.id.startsWith(id+' ')||c.id.startsWith(id+'.'));
  }
  return [...map.values()];
}
