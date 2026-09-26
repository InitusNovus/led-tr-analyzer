import { ModelError, finite, bisect, standardResistor, unique } from './math.js';
import { normalizeConfig, solvePoint, topologyById, topologyUsesGPIO } from './topologies.js';
import { LEDS, getDeviceModel } from '../data/catalog.js';
import { context, sample } from './devices.js';
export function checkLimits(point) {
    const c=point.config,led=LEDS[c.led],checks=[],t=topologyById(c.topology);
    const add=(id,actual,limit,condition='')=>checks.push({id,actual,limit,condition,status:limit==null?'unknown':actual>limit*(1+1e-8)?'exceeded':'within'});
    add('LED current / 각 LED',point.current,led.limits.current,'Absolute maximum is not a recommended operating point');
    add('LED power / 각 LED',point.current*point.ledVf,led.limits.power);
    if(led.currentDerating){
        if(c.ambient<=85)add('LED derated current',point.current,sample(led.currentDerating,c.ambient,context(),'derating'),'Approximate datasheet graph, reference PCB');
        else add('LED derated current',point.current,null,'Ambient outside derating graph');
        add('LED ambient temperature',c.ambient,led.limits.maxTemperature);
    }
    add('RLED power budget',point.resistorPower,c.resistorRating*c.derating,'User-rated power × user margin; package preset is not a verified part');
    for(const entry of point.ledger.filter(e=>e.kind==='resistor'&&!e.id.includes('internal')&&!e.id.includes('.R')&&e.id!=='RLED'))
        add(entry.id+' power budget',entry.power,c.auxRating*c.derating,'User-specified auxiliary resistor rating');
    if(topologyUsesGPIO(t)){
        const gpio=getDeviceModel(c.deviceModels.GPIO1);
        add('GPIO pin current',Math.abs(point.gpioCurrent),gpio.limits.current,'Selected GPIO model only');
        add('GPIO total source',Math.max(0,point.gpioCurrent)+c.otherSourceCurrent,gpio.limits.totalSource,'Only entered other-pin load; not full MCU supply current');
        add('GPIO total sink',Math.max(0,-point.gpioCurrent)+c.otherSinkCurrent,gpio.limits.totalSink,'Only entered other-pin load; not full MCU supply current');
    }
    for(const q of point.semiconductors){
        const p=getDeviceModel(q.modelId);if(!p)continue;
        add(q.id+' current',q.current,p.limits.current);
        add(q.id+' '+(q.voltageIsBound?'OFF voltage upper bound':'voltage'),Math.abs(q.voltage),p.limits.voltage);
        if(q.kind==='mosfet')add(q.id+' |VGS|',Math.abs(q.gate),p.limits.gate);
        if(q.kind==='digital')add(q.id+' input voltage',q.inputVoltage??0,p.limits.inputMax);
        let limit=p.limits.power??null;
        if(p.thermalResistance)limit=Math.min(limit??Infinity,(p.limits.maxJunction-c.ambient)/p.thermalResistance);
        else if(p.limits.deratePerC)limit=p.limits.power-p.limits.deratePerC*Math.max(0,c.ambient-25);
        else if(c.ambient>25)limit=null;
        add(q.id+' power budget',q.power,limit==null?null:Math.max(0,limit),p.thermalCondition??'Reference lands at25°C; no derived thermal impedance');
    }
    const exceeded=checks.filter(x=>x.status==='exceeded'),unknown=checks.filter(x=>x.status==='unknown');
    return{checks,status:exceeded.length?'limits-exceeded':unknown.length?'unverified-limits':'within-entered-limits',
        label:exceeded.length?'설정/정격 한계 초과':unknown.length?'일부 한계 미검증':'입력한 한계 내 · 모델 가정 참조'};
}
export function analyzePoint(input){
    try{const point=solvePoint(input);return{ok:true,point,validation:checkLimits(point)};}
    catch(error){if(error instanceof ModelError)return{ok:false,error:{code:error.code,message:error.message}};throw error;}
}
export function analyzeCorners(input,{includeDtc=false}={}){
    const c=normalizeConfig(input),axes=[
        ['vcc',unique([c.vcc*(1-c.vccTolerance/100),c.vcc,c.vcc*(1+c.vccTolerance/100)])],
        ['vdd',topologyUsesGPIO(topologyById(c.topology))?unique([c.vdd*(1-c.vddTolerance/100),c.vdd,c.vdd*(1+c.vddTolerance/100)]):[c.vdd]],
        ['resistance',unique([c.resistance*(1-c.resistorTolerance/100),c.resistance,c.resistance*(1+c.resistorTolerance/100)])],
        ['vfShift',unique([c.vfShift-c.vfSpread,c.vfShift,c.vfShift+c.vfSpread])],
    ];
    const q1=getDeviceModel(c.deviceModels.Q1);
    if(includeDtc&&q1?.family==='digital-npn'){
        axes.push(['dtcR1Scale',unique([q1.r1Range[0]/q1.r1,1,q1.r1Range[1]/q1.r1])],['dtcRatio',unique([q1.ratioRange[0],q1.ratio,q1.ratioRange[1]])]);
    }
    let scenarios=[{}];for(const[k,vs]of axes)scenarios=scenarios.flatMap(s=>vs.map(v=>({...s,[k]:v})));
    const samples=[],failures=[];
    for(const scenario of scenarios){const a=analyzePoint({...c,...scenario});if(a.ok)samples.push({scenario,point:a.point,validation:a.validation});else failures.push({scenario,error:a.error});}
    const extrema={};
    for(const metric of ['current','resistorPower','driverPower','inputPower']){
        if(!samples.length){extrema[metric]=null;continue;}
        const min=samples.reduce((a,b)=>a.point[metric]<b.point[metric]?a:b),max=samples.reduce((a,b)=>a.point[metric]>b.point[metric]?a:b);
        extrema[metric]={min:{value:min.point[metric],scenario:min.scenario,point:min.point},max:{value:max.point[metric],scenario:max.scenario,point:max.point}};
    }
    return{kind:'sampled-sensitivity',count:scenarios.length,validCount:samples.length,failures,extrema,anyExceeded:samples.some(s=>s.validation.status==='limits-exceeded'),
        flags:unique(samples.flatMap(s=>s.point.flags)),note:'Vf offset is user-assumed. Typical device curves are held fixed. Sampled extrema are not guaranteed process/thermal worst cases. RB/RE and auxiliary resistors are nominal; RLED tolerance is swept only.'};
}
export function selectResistance(input,targetCurrent,{series='E24+E96',strategy='closest',targetMcd=null}={}){
    const c=normalizeConfig(input),t=topologyById(c.topology);let target=targetCurrent;
    if(!t.supportedOperations.includes('size'))throw new ModelError('unsupported','이 토폴로지는 RLED 자동 역산을 지원하지 않습니다.');
    if(targetMcd!==null){
        finite(targetMcd,'target mcd',Number.MIN_VALUE,1e6);const p=LEDS[c.led];
        if(!p.optical||!Number.isFinite(p.optical.nominalMcd)||!p.optical.relative?.domain)
            throw new ModelError('unsupported','선택한 LED는 단일 광도 anchor와 상대 광도 곡선을 함께 제공하지 않아 광도 역산을 지원하지 않습니다.');
        const {luminousIntensity}=opticalFunctions,hi=p.optical.relative.domain[1],max=luminousIntensity(c.led,hi,c.temperature);
        if(!Number.isFinite(max))throw new ModelError('unsupported','현재 온도에서 광도 모델을 계산할 수 없습니다.');
        if(targetMcd>max)throw new ModelError('out-of-domain','목표 광도가 광학 곡선 범위를 벗어납니다.');
        target=bisect(i=>luminousIntensity(c.led,i,c.temperature)-targetMcd,0,hi).value;
    }
    finite(target,'target current',1e-9,1);
    const currentAtLog=l=>solvePoint({...c,resistance:10**l}).current,lo=-3,hi=7,min=currentAtLog(hi),max=currentAtLog(lo);
    if(target>max*(1+1e-8)||target<min*(1-1e-8)||max<1e-12)throw new ModelError('unreachable','현재 전원·구동·저항 범위로 목표 전류를 만들 수 없습니다.');
    const root=bisect(l=>currentAtLog(l)-target,lo,hi,{fTolerance:Math.max(target*1e-7,1e-12),xTolerance:1e-10});
    if(!root.converged)throw new ModelError('nonconvergence','저항 역산이 수렴하지 않았습니다.');
    const exact=10**root.value,selected=standardResistor(exact,series,strategy),result=analyzePoint({...c,resistance:selected});
    return{exact,selected,targetCurrent:target,result,note:strategy==='safe'?'큰 저항 선택은 nominal 전류 기준일 뿐 공차/정격 안전을 보증하지 않습니다.':'선정 후 실제 동작점을 다시 계산했습니다.'};
}
import * as opticalFunctions from './devices.js';
