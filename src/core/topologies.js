import { ModelError, finite, bisect } from './math.js';
import { context, ledVoltage, luminousIntensity, gpioVoltage, gpioState, gpioModel, driveHigh, driveLow, bjtAt, digitalAt, mosCurrent } from './devices.js';
import { LEDS, DEFAULT_MODEL_BY_FAMILY, getDeviceModel } from '../data/catalog.js';

const slot = (id, family, role) => ({ id, family, role, defaultModelId: DEFAULT_MODEL_BY_FAMILY[family] });
export const TOPOLOGIES = [
    { id:'resistor', name:'저항 직결', family:'기준 회로', path:'VLED → RLED → LED → GND', active:'always', deviceSlots:[], activeParameters:[], supportedOperations:['verify','size'] },
    { id:'gpio-source', name:'GPIO Source', family:'GPIO', path:'GPIO → RLED → LED → GND', active:'HIGH', deviceSlots:[slot('GPIO1','gpio','출력')], activeParameters:[], supportedOperations:['verify','size'] },
    { id:'gpio-sink', name:'GPIO Sink / Open-drain', family:'GPIO', path:'VLED → RLED → LED → GPIO', active:'LOW', deviceSlots:[slot('GPIO1','gpio','싱크')], activeParameters:[], supportedOperations:['verify','size'] },
    { id:'digital-npn', name:'디지털 NPN 로우사이드', family:'BJT', path:'VLED → RLED → LED → Q1(Digital NPN) → GND', active:'HIGH', deviceSlots:[slot('Q1','digital-npn','로우사이드 스위치'),slot('GPIO1','gpio','입력')], activeParameters:['dtcR1Scale','dtcRatio'], supportedOperations:['verify','size'] },
    { id:'npn-low', name:'일반 NPN 로우사이드', family:'BJT', path:'VLED → RLED → LED → Q1 NPN(C–E) → GND', active:'HIGH', deviceSlots:[slot('Q1','npn','로우사이드 스위치'),slot('GPIO1','gpio','베이스 구동')], activeParameters:['baseResistance'], supportedOperations:['verify','size'] },
    { id:'npn-follower', name:'NPN 에미터 팔로워', family:'BJT', path:'VLED → Q1 NPN(C–E) → RLED → LED → GND', active:'HIGH', deviceSlots:[slot('Q1','npn','에미터 팔로워'),slot('GPIO1','gpio','베이스 구동')], activeParameters:['baseResistance'], supportedOperations:['verify','size'] },
    { id:'npn-current-sink', name:'NPN 에미터 저항 전류 싱크', family:'BJT', path:'VLED → RLED → LED → Q1 NPN(C–E) → RE → GND', active:'HIGH', deviceSlots:[slot('Q1','npn','전류 싱크'),slot('GPIO1','gpio','베이스 기준')], activeParameters:['baseResistance','emitterResistance'], supportedOperations:['verify'] },
    { id:'nmos-low', name:'NMOS 로우사이드', family:'MOSFET', path:'VLED → RLED → LED → Q1 NMOS(D–S) → GND', active:'HIGH', deviceSlots:[slot('Q1','nmos','로우사이드 스위치'),slot('GPIO1','gpio','게이트 구동')], activeParameters:['gateResistance','gatePull'], supportedOperations:['verify','size'] },
    { id:'pnp-high', name:'PNP 하이사이드 (직접)', family:'High-side', path:'VLED → Q1 PNP(E–C) → RLED → LED → GND', active:'LOW', deviceSlots:[slot('Q1','pnp','하이사이드 스위치'),slot('GPIO1','gpio','베이스 싱크')], activeParameters:['baseResistance'], supportedOperations:['verify','size'] },
    { id:'pmos-high', name:'PMOS 하이사이드 (직접)', family:'High-side', path:'VLED → Q1 PMOS(S–D) → RLED → LED → GND', active:'LOW', deviceSlots:[slot('Q1','pmos','하이사이드 스위치'),slot('GPIO1','gpio','게이트 싱크')], activeParameters:['gateResistance','gatePull'], supportedOperations:['verify','size'] },
    { id:'npn-pnp', name:'NPN → PNP 레벨 시프트', family:'High-side', path:'Q1 NPN → Q2 PNP high-side → RLED → LED', active:'HIGH', deviceSlots:[slot('Q1','npn','입력 드라이버'),slot('Q2','pnp','출력 스위치'),slot('GPIO1','gpio','입력')], activeParameters:['baseResistance','gateResistance','gatePull'], supportedOperations:['verify','size'] },
    { id:'npn-pmos', name:'NPN → PMOS 레벨 시프트', family:'High-side', path:'Q1 NPN → Q2 PMOS high-side → RLED → LED', active:'HIGH', deviceSlots:[slot('Q1','npn','입력 드라이버'),slot('Q2','pmos','출력 스위치'),slot('GPIO1','gpio','입력')], activeParameters:['baseResistance','gateResistance','gatePull'], supportedOperations:['verify','size'] },
    { id:'nmos-pmos', name:'NMOS → PMOS 레벨 시프트', family:'High-side', path:'Q1 NMOS → Q2 PMOS high-side → RLED → LED', active:'HIGH', deviceSlots:[slot('Q1','nmos','입력 드라이버'),slot('Q2','pmos','출력 스위치'),slot('GPIO1','gpio','입력')], activeParameters:['gateResistance','gatePull'], supportedOperations:['verify','size'] },
];
export const topologyById = id => TOPOLOGIES.find(t => t.id === id) ?? null;
export const topologyUsesGPIO = topology => topology.deviceSlots.some(s => s.family === 'gpio');
function compatible(modelId, family) {
    const p=getDeviceModel(modelId);
    return !!p && p.family===family;
}
export function resolveDeviceModels(inputModels, topology) {
    const source=inputModels && typeof inputModels==='object' ? inputModels : {};
    const resolved={};
    for (const s of topology.deviceSlots) {
        const requested=source[s.id];
        if (requested != null && !compatible(requested,s.family))
            throw new ModelError('invalid-input', s.id + '에 호환되지 않는 model ID가 지정되었습니다: ' + requested);
        resolved[s.id]=requested ?? s.defaultModelId;
    }
    return resolved;
}
export function transitionConfig(input, topologyId) {
    const next=topologyById(topologyId);
    if(!next) throw new ModelError('invalid-input','Unknown topology');
    const previous=input?.deviceModels ?? {};
    const values=Object.values(previous);
    const deviceModels={};
    for(const s of next.deviceSlots) {
        const same=previous[s.id];
        const other=values.find(id=>compatible(id,s.family));
        deviceModels[s.id]=compatible(same,s.family) ? same : (other ?? s.defaultModelId);
    }
    return { ...input, topology:topologyId, state:next.active==='LOW'?'LOW':next.active==='HIGH'?'HIGH':(input.state ?? 'HIGH'), deviceModels };
}
const DEFAULT_DEVICE_MODELS=Object.freeze({
    Q1: DEFAULT_MODEL_BY_FAMILY['digital-npn'],
    GPIO1: DEFAULT_MODEL_BY_FAMILY.gpio,
});
export const DEFAULT_CONFIG = Object.freeze({
    topology:'digital-npn', led:'APT2012SURCK', deviceModels:DEFAULT_DEVICE_MODELS, vcc:5, vdd:3.3, resistance:330,
    baseResistance:4700, emitterResistance:220, gateResistance:1000, pullResistance:40000, gatePull:100000,
    state:'HIGH', gpioMode:'push-pull', pull:'none', temperature:25, ambient:25, seriesCount:1,
    vfShift:0, dtcR1Scale:1, dtcRatio:10, vccTolerance:5, vddTolerance:3, resistorTolerance:1, vfSpread:.1,
    resistorRating:.125, auxRating:.1, derating:.7, otherSourceCurrent:0, otherSinkCurrent:0,
});
export function freshConfig() { return { ...DEFAULT_CONFIG, deviceModels:{...DEFAULT_CONFIG.deviceModels} }; }

const numericRules={
    vcc:[0,60], vdd:[0,5.5], resistance:[.001,1e7], baseResistance:[1,1e7], emitterResistance:[.001,1e7],
    gateResistance:[1,1e7], pullResistance:[1,1e8], gatePull:[1,1e8], temperature:[-40,125], ambient:[-40,125],
    seriesCount:[1,12], vfShift:[-.5,.5], dtcR1Scale:[.01,100], dtcRatio:[.01,100],
    vccTolerance:[0,30], vddTolerance:[0,30], resistorTolerance:[0,30], vfSpread:[0,.5],
    resistorRating:[.001,10], auxRating:[.001,10], derating:[.01,1], otherSourceCurrent:[0,1], otherSinkCurrent:[0,1],
};
const commonNumeric=['vcc','resistance','temperature','ambient','seriesCount','vfShift','vccTolerance','resistorTolerance','vfSpread','resistorRating','auxRating','derating'];
const gpioNumeric=['vdd','vddTolerance','otherSourceCurrent','otherSinkCurrent'];
export function activeParameterNames(topology, input={}) {
    const names=new Set([...commonNumeric,...topology.activeParameters]);
    if(topologyUsesGPIO(topology)) {
        gpioNumeric.forEach(x=>names.add(x));
        if(input.pull && input.pull!=='none') names.add('pullResistance');
    }
    return names;
}
export function normalizeConfig(input={}) {
    const raw={ ...freshConfig(), ...input, deviceModels:{...(input.deviceModels ?? {})} };
    const topology=topologyById(raw.topology);
    if(!topology || !LEDS[raw.led])
        throw new ModelError('invalid-input','회로/LED 선택이 유효하지 않습니다.');
    const active=activeParameterNames(topology,raw);
    const c={...raw, deviceModels:resolveDeviceModels(raw.deviceModels,topology)};
    for(const key of Object.keys(numericRules)) {
        if(active.has(key)) {
            const [min,max]=numericRules[key];
            finite(c[key],key,min,max);
        } else {
            c[key]=DEFAULT_CONFIG[key];
        }
    }
    if(!Number.isInteger(c.seriesCount))
        throw new ModelError('invalid-input','LED 개수는 정수여야 합니다.');
    if(topologyUsesGPIO(topology)) {
        for(const [key,allowed] of [['state',['HIGH','LOW','HI_Z']],['gpioMode',['push-pull','open-drain']],['pull',['none','up','down']]])
            if(!allowed.includes(c[key])) throw new ModelError('invalid-input',key+' 설정이 유효하지 않습니다.');
    } else {
        c.state=DEFAULT_CONFIG.state; c.gpioMode=DEFAULT_CONFIG.gpioMode; c.pull=DEFAULT_CONFIG.pull;
    }
    const q1=getDeviceModel(c.deviceModels.Q1);
    if(q1?.family==='digital-npn') {
        if(c.dtcR1Scale < q1.r1Range[0]/q1.r1 || c.dtcR1Scale > q1.r1Range[1]/q1.r1)
            throw new ModelError('invalid-input','DTC R1 공차 설정이 선택 모델 범위를 벗어났습니다.');
        if(c.dtcRatio < q1.ratioRange[0] || c.dtcRatio > q1.ratioRange[1])
            throw new ModelError('invalid-input','DTC R2/R1 설정이 선택 모델 범위를 벗어났습니다.');
    }
    return c;
}
const power=(id,current,voltage,kind='resistor')=>({id,instanceId:id,current,voltage,power:current*voltage,kind});
const resistor=(id,current,resistance)=>({...power(id,current,current*resistance),resistance});
const source=(id,current,voltage)=>({id,instanceId:id,current,voltage,power:current*voltage});
const qPower=(id,q,modelId)=>({id,instanceId:id,kind:'bjt',modelId,current:q.collector,base:q.base,emitter:q.emitter,voltage:q.voltage,vbe:q.vbe,
    power:q.collector*q.voltage+q.base*q.vbe,region:q.region});
const mosPower=(id,current,voltage,gate,modelId)=>{
    const p=getDeviceModel(modelId);
    return {...power(id,current,voltage,'mosfet'),instanceId:id,modelId,gate,region:Math.abs(gate)<p.output[0].gate?'weak-drive':'conducting'};
};
const finishRoot=(fn,lo,hi,maxResidual=1e-7)=>{
    const r=bisect(fn,lo,hi,{fTolerance:1e-11,xTolerance:1e-24,iterations:110});
    if(Math.abs(r.residual)>maxResidual) throw new ModelError('nonconvergence','동작점 잔차가 허용오차를 넘었습니다. 이 조건은 계산 결과를 보증하지 못합니다.');
    return {...r,converged:true,residualTolerance:maxResidual};
};
function passiveLimit(c,voltage=c.vcc){
    if(voltage<=0) return 0;
    return finishRoot(i=>ledVoltage(c.led,i,c.temperature,c.vfShift)*c.seriesCount+i*c.resistance-voltage,0,voltage/c.resistance).value;
}
function baseResult(c,ctx){
    return {config:c,current:0,ledVf:0,loadVoltage:0,driverVoltage:null,gpioVoltage:null,gpioCurrent:0,
        baseCurrent:null,emitterCurrent:null,externalInputCurrent:null,forcedBeta:null,region:'off',
        ledger:[],semiconductors:[],sources:[],solver:{converged:true,residual:0,iterations:0},ctx};
}
function finalize(r){
    const {config:c,ctx}=r;
    r.ledVf=ledVoltage(c.led,r.current,c.temperature,c.vfShift,ctx);
    r.loadVoltage=r.ledVf*c.seriesCount+r.current*c.resistance;
    r.luminousMcd=luminousIntensity(c.led,r.current,c.temperature,ctx);
    r.ledger.unshift(resistor('RLED',r.current,c.resistance),{...power('LED1',r.current,r.ledVf*c.seriesCount,'led'),count:c.seriesCount});
    r.resistorPower=r.current*r.current*c.resistance;
    r.driverPower=r.semiconductors.reduce((sum,q)=>sum+q.power,0);
    r.inputPower=r.sources.reduce((sum,s)=>sum+s.power,0);
    r.dissipatedPower=r.ledger.reduce((sum,p)=>sum+p.power,0);
    r.powerResidual=r.inputPower-r.dissipatedPower;
    r.requestedState=topologyUsesGPIO(topologyById(c.topology))?c.state:null;
    r.effectiveGpioState=topologyUsesGPIO(topologyById(c.topology))?gpioState(c):null;
    r.appliedModels={LED1:c.led,...c.deviceModels};
    if(r.region==='off') ctx.flags.add('not-modeled:off-leakage');
    ctx.flags.add('not-modeled:self-heating-feedback');
    r.flags=[...ctx.flags]; r.provenance=[...ctx.sources]; delete r.ctx;
    for(const key of ['current','ledVf','resistorPower','driverPower','powerResidual']) finite(r[key],key);
    const balanceTolerance=2e-8+1e-6*Math.abs(r.inputPower);
    if(r.current<0||Math.abs(r.powerResidual)>balanceTolerance||
       [...r.ledger,...r.sources].some(e=>!Number.isFinite(e.power)||e.power<-1e-10)||
       r.semiconductors.some(q=>q.voltage<-1e-8))
        throw new ModelError('inconsistent-point','전력 수지/소자 방향 조건이 맞지 않습니다. 저전압·역방향·곡선 외삽 범위의 모델을 확인하세요.');
    return r;
}
const offQ=(id,modelId,c)=>{
    const p=getDeviceModel(modelId);
    return {id,instanceId:id,modelId,kind:p.family==='digital-npn'?'digital':p.family==='nmos'||p.family==='pmos'?'mosfet':'bjt',current:0,power:0,voltage:c.vcc,voltageIsBound:true,region:'off',gate:0};
};
function off(c,ctx,devices=[]){
    for(const d of devices) ctx.sources.add(getDeviceModel(d.modelId)?.source);
    if(c.deviceModels.GPIO1) ctx.sources.add(getDeviceModel(c.deviceModels.GPIO1)?.source);
    const r=baseResult(c,ctx); r.semiconductors=devices; r.driverVoltage=c.vcc;
    r.gpioVoltage=c.deviceModels.GPIO1?(gpioState(c)==='HI_Z'?null:gpioState(c)==='HIGH'?c.vdd:0):null;
    return finalize(r);
}
function gpioDirect(c,ctx,sink){
    if(sink&&!driveLow(c)){ if(c.vcc>c.vdd+.05) throw new ModelError('unsupported','외부 LED 전원이 높은 GPIO의 OFF/Hi-Z: injection/5V-tolerance 모델이 없습니다.'); return off(c,ctx); }
    if(!sink&&!driveHigh(c)) return off(c,ctx);
    const max=passiveLimit(c,sink?c.vcc:c.vdd),sgn=sink?-1:1;
    const eq=i=>(sink?c.vcc-gpioVoltage(c,-i):gpioVoltage(c,i))-ledVoltage(c.led,i,c.temperature,c.vfShift)*c.seriesCount-i*c.resistance;
    const r=baseResult(c,ctx); r.solver=finishRoot(eq,0,max); r.current=r.solver.value; r.gpioCurrent=sgn*r.current;
    r.gpioVoltage=gpioVoltage(c,r.gpioCurrent,ctx); r.driverVoltage=sink?r.gpioVoltage:c.vdd-r.gpioVoltage; r.region=r.current>1e-12?'conducting':'off';
    if(sink){r.sources=[source('VLED',r.current,c.vcc)];r.ledger.push({...power('GPIO1',r.current,r.gpioVoltage,'gpio'),instanceId:'GPIO1'});}
    else r.sources=[source('GPIO1',r.current,r.gpioVoltage)];
    return finalize(r);
}
function npnLow(c,ctx,digital=false){
    const modelId=c.deviceModels.Q1;
    if(!driveHigh(c)) return off(c,ctx,[offQ('Q1',modelId,c)]);
    const qAt=(i,trace)=>{
        const v=c.vcc-ledVoltage(c.led,i,c.temperature,c.vfShift)*c.seriesCount-i*c.resistance;
        return digital?digitalAt(modelId,i,v,c,trace):bjtAt(modelId,i,v,c.temperature,trace);
    };
    const equation=i=>{const q=qAt(i);return digital?gpioVoltage(c,q.input)-q.inputVoltage:gpioVoltage(c,q.base)-q.base*c.baseResistance-q.vbe;};
    if(equation(0)<=0) return off(c,ctx,[offQ('Q1',modelId,c)]);
    const r=baseResult(c,ctx);r.solver=finishRoot(equation,0,passiveLimit(c));r.current=r.solver.value;
    const q=qAt(r.current,ctx);r.region=q.region;r.driverVoltage=q.voltage;r.baseCurrent=q.base;r.emitterCurrent=q.emitter;r.forcedBeta=q.forcedBeta;
    r.gpioCurrent=digital?q.input:q.base;r.gpioVoltage=gpioVoltage(c,r.gpioCurrent,ctx);r.sources=[source('VLED',r.current,c.vcc),source('GPIO1',r.gpioCurrent,r.gpioVoltage)];
    if(digital){
        r.externalInputCurrent=q.input;r.externalRatio=q.externalRatio;
        const die={...power('Q1.die',q.collector,q.voltage,'bjt'),instanceId:'Q1'};die.power+=q.base*q.vbe;
        r.ledger.push(die,{...resistor('Q1.R1',q.input,q.r1),instanceId:'Q1'},{...resistor('Q1.R2',q.vbe/q.r2,q.r2),instanceId:'Q1'});
        r.semiconductors.push({id:'Q1',instanceId:'Q1',modelId,kind:'digital',current:q.collector,base:q.base,emitter:q.emitter,voltage:q.voltage,inputVoltage:q.inputVoltage,
            power:die.power+q.input*q.input*q.r1+q.vbe*q.vbe/q.r2,region:q.region});
    } else {
        const qp=qPower('Q1',q,modelId);r.semiconductors.push(qp);r.ledger.push(qp,resistor('RB',q.base,c.baseResistance));
    }
    return finalize(r);
}
function emitterStage(c,ctx,currentSink){
    const modelId=c.deviceModels.Q1;
    if(!driveHigh(c)) return off(c,ctx,[offQ('Q1',modelId,c)]);
    const solveAtEmitter=(ie,trace)=>{
        const qAt=ic=>{
            const ve=currentSink?ie*c.emitterResistance:ledVoltage(c.led,ie,c.temperature,c.vfShift)*c.seriesCount+ie*c.resistance;
            const vc=currentSink?c.vcc-ledVoltage(c.led,ic,c.temperature,c.vfShift)*c.seriesCount-ic*c.resistance:c.vcc;
            return {...bjtAt(modelId,ic,vc-ve,c.temperature),ve,vc};
        };
        const ic=ie===0?0:finishRoot(ic=>qAt(ic).emitter-ie,0,ie,1e-11).value;
        const q=qAt(ic);if(trace)bjtAt(modelId,ic,q.voltage,c.temperature,trace);return {...q,emitter:ie};
    };
    const equation=ie=>{const q=solveAtEmitter(ie);return gpioVoltage(c,q.base)-q.base*c.baseResistance-q.ve-q.vbe;};
    if(equation(0)<=0)return off(c,ctx,[offQ('Q1',modelId,c)]);
    const hi=currentSink?c.vcc/c.emitterResistance:passiveLimit(c),r=baseResult(c,ctx);r.solver=finishRoot(equation,0,hi);
    const q=solveAtEmitter(r.solver.value,ctx);r.current=currentSink?q.collector:q.emitter;r.baseCurrent=q.base;r.emitterCurrent=q.emitter;r.driverVoltage=q.voltage;r.forcedBeta=q.forcedBeta;
    r.gpioCurrent=q.base;r.gpioVoltage=gpioVoltage(c,q.base,ctx);r.region=q.region;r.nodes={base:q.ve+q.vbe,emitter:q.ve,collector:q.vc};
    const qp=qPower('Q1',q,modelId);r.semiconductors.push(qp);r.ledger.push(qp,resistor('RB',q.base,c.baseResistance));if(currentSink)r.ledger.push(resistor('RE',q.emitter,c.emitterResistance));
    r.sources=[source('VLED',q.collector,c.vcc),source('GPIO1',q.base,r.gpioVoltage)];return finalize(r);
}
function pnpHigh(c,ctx,levelShift=false){
    const outId=levelShift?'Q2':'Q1',outModel=c.deviceModels[outId],inModel=levelShift?c.deviceModels.Q1:null;
    if(levelShift&&!driveHigh(c))return off(c,ctx,[offQ('Q1',inModel,c),offQ('Q2',outModel,c)]);
    if(!levelShift&&!driveLow(c)){if(Math.abs(c.vcc-c.vdd)>.05)throw new ModelError('unsupported','직접 PNP의 서로 다른 전원 HIGH/Hi-Z는 GPIO injection/reverse-BE 모델이 필요합니다.');return off(c,ctx,[offQ('Q1',outModel,c)]);}
    const get=i=>{
        const v=c.vcc-ledVoltage(c.led,i,c.temperature,c.vfShift)*c.seriesCount-i*c.resistance,q=bjtAt(outModel,i,v,c.temperature);
        if(!levelShift)return{q,ib:q.base};
        const shunt=q.vbe/c.gatePull,j=q.base+shunt,q1=bjtAt(inModel,j,c.vcc-q.vbe-j*c.gateResistance,c.temperature);
        return{q,q1,j,shunt,ib:q1.base};
    };
    const equation=i=>{const a=get(i);return levelShift?gpioVoltage(c,a.ib)-a.ib*c.baseResistance-a.q1.vbe:c.vcc-a.q.vbe-a.ib*c.baseResistance-gpioVoltage(c,-a.ib);};
    if(equation(0)<=0)return off(c,ctx,[offQ(outId,outModel,c)]);
    const r=baseResult(c,ctx);r.solver=finishRoot(equation,0,passiveLimit(c));r.current=r.solver.value;
    const a=get(r.current),q=a.q;bjtAt(outModel,q.collector,q.voltage,c.temperature,ctx);r.driverVoltage=q.voltage;r.baseCurrent=q.base;r.emitterCurrent=q.emitter;r.forcedBeta=q.forcedBeta;r.region=q.region;
    r.gpioCurrent=levelShift?a.ib:-a.ib;r.gpioVoltage=gpioVoltage(c,r.gpioCurrent,ctx);
    const qp=qPower(outId,q,outModel);r.semiconductors.push(qp);r.ledger.push(qp);
    if(levelShift){
        bjtAt(inModel,a.j,a.q1.voltage,c.temperature,ctx);const q1=qPower('Q1',a.q1,inModel);r.semiconductors.push(q1);
        r.ledger.push(q1,resistor('RB',a.ib,c.baseResistance),resistor('Rdrive',a.j,c.gateResistance),resistor('RBE',a.shunt,c.gatePull));
        r.sources=[source('VLED',r.current+a.j,c.vcc),source('GPIO1',a.ib,r.gpioVoltage)];
    } else {
        r.ledger.push(resistor('RB',a.ib,c.baseResistance),{...power('GPIO1',a.ib,r.gpioVoltage,'gpio'),instanceId:'GPIO1'});r.sources=[source('VLED',q.emitter,c.vcc)];
        if(Math.abs(c.vcc-c.vdd)>.05)ctx.flags.add('not-verified:direct-high-side-OFF-domain');
    }
    return finalize(r);
}
function directNmosBias(c,ctx,modelId){
    if(!driveHigh(c))return{gate:0,current:0,pin:gpioVoltage(c,0,ctx),ledger:[],sources:[],semiconductors:[]};
    const current=finishRoot(i=>gpioVoltage(c,i)-i*(c.gateResistance+c.gatePull),0,c.vdd/(c.gateResistance+c.gatePull)).value;
    const pin=gpioVoltage(c,current,ctx),gate=current*c.gatePull;
    return{gate,current,pin,ledger:[resistor('RG',current,c.gateResistance),resistor('RGS',current,c.gatePull)],sources:[source('GPIO1',current,pin)],semiconductors:[],modelId};
}
function pmosBias(c,ctx,kind){
    if(kind==='direct'){
        if(!driveLow(c)){if(Math.abs(c.vcc-c.vdd)>.05)throw new ModelError('unsupported','직접 PMOS의 HIGH/Hi-Z 전압 도메인이 다릅니다. injection 모델 없이 OFF를 보증하지 않습니다.');return{gate:0,current:0,pin:gpioVoltage(c,0,ctx),ledger:[],sources:[],semiconductors:[]};}
        const j=finishRoot(i=>c.vcc-i*(c.gatePull+c.gateResistance)-gpioVoltage(c,-i),0,c.vcc/(c.gatePull+c.gateResistance)).value,pin=gpioVoltage(c,-j,ctx);
        if(Math.abs(c.vcc-c.vdd)>.05)ctx.flags.add('not-verified:direct-high-side-OFF-domain');
        return{gate:j*c.gatePull,current:-j,pin,ledger:[resistor('RGS',j,c.gatePull),resistor('RG',j,c.gateResistance),{...power('GPIO1',j,pin,'gpio'),instanceId:'GPIO1'}],sources:[source('VLED bias',j,c.vcc)],semiconductors:[]};
    }
    const inModel=c.deviceModels.Q1;
    if(!driveHigh(c))return{gate:0,current:0,pin:gpioVoltage(c,0,ctx),ledger:[],sources:[],semiconductors:[offQ('Q1',inModel,c)]};
    const total=c.gatePull+c.gateResistance;
    if(kind==='npn'){
        const qAt=j=>bjtAt(inModel,j,c.vcc-j*total,c.temperature),j=finishRoot(j=>{const q=qAt(j);return gpioVoltage(c,q.base)-q.base*c.baseResistance-q.vbe;},0,c.vcc/total).value;
        const q=bjtAt(inModel,j,c.vcc-j*total,c.temperature,ctx),pin=gpioVoltage(c,q.base,ctx),qp=qPower('Q1',q,inModel);
        return{gate:j*c.gatePull,current:q.base,pin,ledger:[qp,resistor('RB',q.base,c.baseResistance),resistor('Rdrive',j,c.gateResistance),resistor('RGS',j,c.gatePull)],
            sources:[source('VLED bias',j,c.vcc),source('GPIO1',q.base,pin)],semiconductors:[qp]};
    }
    const bias=directNmosBias(c,ctx,inModel),j=finishRoot(j=>mosCurrent(inModel,c.vcc-j*total,bias.gate,c.temperature)-j,0,c.vcc/total,1e-11).value,voltage=c.vcc-j*total;
    mosCurrent(inModel,voltage,bias.gate,c.temperature,ctx);const qp=mosPower('Q1',j,voltage,bias.gate,inModel);
    return{gate:j*c.gatePull,current:bias.current,pin:bias.pin,ledger:[...bias.ledger,qp,resistor('Rdrive',j,c.gateResistance),resistor('RGS high-side',j,c.gatePull)],
        sources:[...bias.sources,source('VLED bias',j,c.vcc)],semiconductors:[qp]};
}
function mosStage(c,ctx,highSide,kind='direct'){
    const outId=highSide&&kind!=='direct'?'Q2':'Q1',modelId=c.deviceModels[outId],bias=highSide?pmosBias(c,ctx,kind):directNmosBias(c,ctx,modelId),r=baseResult(c,ctx);
    r.ledger.push(...bias.ledger);r.sources.push(...bias.sources);r.semiconductors.push(...bias.semiconductors);r.gpioCurrent=bias.current;r.gpioVoltage=bias.pin;r.gateVoltage=highSide?-bias.gate:bias.gate;
    const getVoltage=i=>c.vcc-ledVoltage(c.led,i,c.temperature,c.vfShift)*c.seriesCount-i*c.resistance,max=passiveLimit(c);
    r.solver=finishRoot(i=>mosCurrent(modelId,getVoltage(i),bias.gate,c.temperature)-i,0,max,1e-11);r.current=r.solver.value;r.driverVoltage=getVoltage(r.current);
    mosCurrent(modelId,r.driverVoltage,bias.gate,c.temperature,ctx);const qp=mosPower(outId,r.current,r.driverVoltage,bias.gate,modelId);r.region=r.current<1e-12?'off':qp.region;qp.region=r.region;
    r.semiconductors.push(qp);r.ledger.push(qp);r.sources.push(source('VLED load',r.current,c.vcc));return finalize(r);
}
export function solvePoint(input){
    const c=normalizeConfig(input),ctx=context(),t=topologyById(c.topology);
    if(topologyUsesGPIO(t)&&gpioState(c)==='HI_Z'&&c.pull==='none'&&['npn-low','npn-follower','npn-current-sink','pnp-high','npn-pnp','npn-pmos'].includes(c.topology))
        throw new ModelError('unsupported','베이스가 부유합니다. 이 회로에는 베이스 풀 저항이 없으므로 Hi-Z를 OFF로 가정하지 않습니다. GPIO pull을 지정하세요.');
    if(topologyUsesGPIO(t)){const gp=gpioModel(c);if(c.vdd<gp.voltageRange[0]||c.vdd>gp.voltageRange[1])throw new ModelError('unsupported','선택 GPIO 모델은 VDD='+gp.voltageRange[0]+'…'+gp.voltageRange[1]+'V만 지원합니다.');}
    if(c.vcc===0&&c.topology!=='gpio-source'&&c.topology!=='resistor')throw new ModelError('unsupported','VLED=0에서의 역급전/접합 전류는 이 모델 범위 밖입니다.');
    switch(c.topology){
        case'resistor':{const r=baseResult(c,ctx);r.current=passiveLimit(c);r.region=r.current>0?'conducting':'off';r.sources=[source('VLED',r.current,c.vcc)];return finalize(r);}
        case'gpio-source':return gpioDirect(c,ctx,false);
        case'gpio-sink':return gpioDirect(c,ctx,true);
        case'digital-npn':return npnLow(c,ctx,true);
        case'npn-low':return npnLow(c,ctx,false);
        case'npn-follower':return emitterStage(c,ctx,false);
        case'npn-current-sink':return emitterStage(c,ctx,true);
        case'nmos-low':return mosStage(c,ctx,false);
        case'pnp-high':return pnpHigh(c,ctx,false);
        case'pmos-high':return mosStage(c,ctx,true);
        case'npn-pnp':return pnpHigh(c,ctx,true);
        case'npn-pmos':return mosStage(c,ctx,true,'npn');
        case'nmos-pmos':return mosStage(c,ctx,true,'nmos');
        default:throw new ModelError('invalid-input','Unknown topology');
    }
}
