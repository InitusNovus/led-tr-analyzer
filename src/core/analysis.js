import { ModelError, finite, bisect, standardResistor, unique } from './math.js';
import { normalizeConfig, solvePoint, topologyById, topologyUsesGPIO } from './topologies.js';
import { LEDS, getDeviceModel } from '../data/catalog.js';
import { context, sample } from './devices.js';
import { solveOpticalCurrent, opticalCapability } from './optics.js';
import { evaluateGoal, normalizeCriterion } from './goal.js';
/** Canonical validation IDs are independent from translated user-facing labels. */
export function checkLimits(point) {
    const c=point.config,led=LEDS[c.led],checks=[],t=topologyById(c.topology);
    const add=(id,instanceId,ruleId,metric,unit,actual,limit,condition='')=>{
        const status=limit==null?'unknown':actual>limit*(1+1e-8)?'exceeded':'within';
        checks.push({id,instanceId,ruleId,metric,unit,actual,limit,condition,
            basis:condition,status,scope:'nominal'});
    };
    add('LED current / 각 LED','LED1','led-forward-current','current','A',point.current,led.limits.current,'Absolute maximum is not a recommended operating point');
    add('LED power / 각 LED','LED1','led-power','power','W',point.current*point.ledVf,led.limits.power);
    if(led.currentDerating){
        const derated=c.ambient<=85?sample(led.currentDerating,c.ambient,context(),'derating'):null;
        add('LED derated current','LED1','led-current-derated','current','A',point.current,derated,'Approximate datasheet graph, reference PCB');
        add('LED ambient temperature','LED1','led-ambient','ambient','°C',c.ambient,led.limits.maxTemperature);
    }
    add('RLED power budget','RLED','resistor-power-budget','power','W',point.resistorPower,c.resistorRating*c.derating,
        'User-rated power × user margin; package preset is not a verified part');
    for(const entry of point.ledger.filter(e=>e.kind==='resistor'&&!e.id.includes('internal')&&!e.id.includes('.R')&&e.id!=='RLED')) {
        add(entry.id+' power budget',entry.instanceId??entry.id,'resistor-power-budget','power','W',entry.power,c.auxRating*c.derating,
            'User-specified auxiliary resistor rating');
    }
    if(topologyUsesGPIO(t)){
        const gpio=getDeviceModel(c.deviceModels.GPIO1);
        add('GPIO pin current','GPIO1','driver-pin-current','current','A',Math.abs(point.gpioCurrent),gpio.limits.current,'Selected GPIO/source model only');
        add('GPIO total source','GPIO1','driver-total-source','current','A',Math.max(0,point.gpioCurrent)+c.otherSourceCurrent,gpio.limits.totalSource,'Only entered other-pin load; not full MCU supply current');
        add('GPIO total sink','GPIO1','driver-total-sink','current','A',Math.max(0,-point.gpioCurrent)+c.otherSinkCurrent,gpio.limits.totalSink,'Only entered other-pin load; not full MCU supply current');
    }
    for(const q of point.semiconductors) {
        const p=getDeviceModel(q.modelId);if(!p)continue;
        const id=q.instanceId??q.id;
        add(q.id+' current',id,'transistor-current','current','A',q.current,p.limits.current);
        add(q.id+' '+(q.voltageIsBound?'OFF voltage upper bound':'voltage'),id,'transistor-voltage','voltage','V',Math.abs(q.voltage),p.limits.voltage);
        if(q.kind==='mosfet')add(q.id+' |VGS|',id,'gate-source-voltage','gate','V',Math.abs(q.gate),p.limits.gate);
        if(q.kind==='digital')add(q.id+' input voltage',id,'digital-input-voltage','inputVoltage','V',q.inputVoltage??0,p.limits.inputMax);
        let limit=p.limits.power??null;
        if(p.thermalResistance)limit=Math.min(limit??Infinity,(p.limits.maxJunction-c.ambient)/p.thermalResistance);
        else if(p.limits.deratePerC)limit=p.limits.power-p.limits.deratePerC*Math.max(0,c.ambient-25);
        else if(c.ambient>25)limit=null;
        add(q.id+' power budget',id,'transistor-power-budget','power','W',q.power,limit==null?null:Math.max(0,limit),p.thermalCondition??'Reference lands at 25°C; no derived thermal impedance');
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
    const violations=samples.flatMap((s,idx)=>s.validation.checks.filter(check=>check.status==='exceeded')
       .map(check=>({scenario:s.scenario,scenarioId:'sample-'+idx,check:{...check,scope:'scenario'}})));
    const opticalAvailable=samples.filter(s=>s.point.optical?.kind!=='unavailable');
    const opticalRange=opticalAvailable.length?{
       min:Math.min(...opticalAvailable.map(s=>s.point.optical.minMcd??s.point.optical.nominalMcd).filter(Number.isFinite)),
       max:Math.max(...opticalAvailable.map(s=>s.point.optical.maxMcd??s.point.optical.nominalMcd).filter(Number.isFinite)),
       validCount:opticalAvailable.length,
       kind:'sampled-electrical-scenarios-plus-optical-bin-range'
    }:null;
    return{kind:'sampled-sensitivity',count:scenarios.length,validCount:samples.length,failures,extrema,
        opticalRange,violations:violations.slice(0,30),violationCount:violations.length,
        anyExceeded:violations.length>0,
        flags:unique(samples.flatMap(s=>s.point.flags)),note:'Vf offset is user-assumed. Typical device curves are held fixed. Sampled extrema are not guaranteed process/thermal worst cases. RB/RE and auxiliary resistors are nominal; RLED tolerance is swept only.'};
}
export function selectResistance(input,targetCurrent,{series='E24+E96',strategy='closest',targetMcd=null,opticalBasis='auto',criterion='minimum',tolerancePct}={}){
    const goalRule=normalizeCriterion(criterion,tolerancePct);
    const c=normalizeConfig(input),t=topologyById(c.topology);let target=targetCurrent;
    if(!t.supportedOperations.includes('size'))throw new ModelError('unsupported','이 토폴로지는 RLED 자동 역산을 지원하지 않습니다.');
    let opticalGoal=null;
    const resolvedBasis=opticalBasis==='auto'?(opticalCapability(c.led).hasRange?'min':'typ'):opticalBasis;
    if(targetMcd!==null){
        opticalGoal=solveOpticalCurrent(c.led,targetMcd,{basis:resolvedBasis,temperature:c.temperature});
        target=opticalGoal.current;
    }
    finite(target,'target current',1e-9,1);
    const currentAtLog=l=>solvePoint({...c,resistance:10**l}).current,lo=-3,hi=7,min=currentAtLog(hi),max=currentAtLog(lo);
    if(target>max*(1+1e-8)||target<min*(1-1e-8)||max<1e-12)throw new ModelError('unreachable','현재 전원·구동·저항 범위로 목표 전류를 만들 수 없습니다.');
    const root=bisect(l=>currentAtLog(l)-target,lo,hi,{fTolerance:Math.max(target*1e-7,1e-12),xTolerance:1e-10});
    if(!root.converged)throw new ModelError('nonconvergence','저항 역산이 수렴하지 않았습니다.');
    const exact=10**root.value,selected=standardResistor(exact,series,strategy),result=analyzePoint({...c,resistance:selected});
    const intent=opticalGoal?{kind:'optical',basis:resolvedBasis,targetMcd,desiredCurrent:target,
        validity:opticalGoal.validity,assumptions:opticalGoal.assumptions,...goalRule}
      :{kind:'current',targetCurrent:target,...goalRule};
    const goal=evaluateGoal(result.ok?result.point:null,intent);
    return{exact,selected,targetCurrent:target,result,goal,
        note:'선택된 표준 저항으로 실제 전류·광도 목표 달성 여부를 다시 계산했습니다. 표본/제조 편차의 보증은 아닙니다.'};
}
