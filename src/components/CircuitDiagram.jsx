import React from 'react';
import { LEDS, getDeviceModel } from '../data/catalog.js';
import { gpioState } from '../core/devices.js';
import { circuitTemplate } from '../ui/circuitTemplates.js';

const cls=(...v)=>v.filter(Boolean).join(' ');
function Hit({id,selected,onSelect,label,children}){
  const activate=e=>{if(e.type==='click'||e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(id);}};
  return <g data-instance-id={id} className={cls('schem-part',selected===id&&'selected')} role="button" tabIndex={0} aria-label={label??id} onClick={activate} onKeyDown={activate}>{children}</g>;
}
const Wire=({d,on=false})=><path className={cls('wire',on&&'energized')} d={d}/>;
function Rail({x=470,label='VLED'}){return <g><path className="wire rail" d={'M'+x+' 45V28'}/><path className="wire rail" d={'M'+(x-8)+' 36L'+x+' 28L'+(x+8)+' 36'}/><text className="rail-label" x={x} y="18" textAnchor="middle">{label}</text></g>;}
function Ground({x=470,y=397}){return <g><path className="wire" d={'M'+x+' '+(y-18)+'V'+(y-5)}/><path className="wire" d={'M'+(x-16)+' '+(y-5)+'H'+(x+16)+'M'+(x-10)+' '+(y+2)+'H'+(x+10)+'M'+(x-4)+' '+(y+9)+'H'+(x+4)}/><text className="minor-label" x={x} y={y+27} textAnchor="middle">GND</text></g>;}
function ResV({id,x,y,value,label=id,selected,onSelect}){
 return <Hit id={id} selected={selected} onSelect={onSelect} label={label}><path className="symbol" d={'M'+x+' '+(y-40)+'V'+(y-25)+'M'+x+' '+(y+25)+'V'+(y+40)}/><rect className="symbol-fill" x={x-10} y={y-25} width="20" height="50" rx="3"/><text className="part-label" x={x+20} y={y+5}>{label} {value!=null?value+'Ω':''}</text></Hit>;
}
function ResH({id,x1,x2,y,value,label=id,selected,onSelect}){
 const mid=(x1+x2)/2,w=Math.min(72,Math.max(42,(x2-x1)*.35));
 return <Hit id={id} selected={selected} onSelect={onSelect} label={label}><path className="symbol" d={'M'+x1+' '+y+'H'+(mid-w/2)+'M'+(mid+w/2)+' '+y+'H'+x2}/><rect className="symbol-fill" x={mid-w/2} y={y-10} width={w} height="20" rx="3"/><text className="part-label" x={mid} y={y-17} textAnchor="middle">{label} {value!=null?value+'Ω':''}</text></Hit>;
}
function Led({x,y,color,id='LED1',name='',selected,onSelect,on=false}){
 return <Hit id={id} selected={selected} onSelect={onSelect} label={name||id}>
   {on&&<circle className="led-glow" cx={x} cy={y} r="31" fill={color}/>}
   <path className="symbol led-body" d={'M'+(x-18)+' '+(y-15)+'H'+(x+18)+'L'+x+' '+(y+8)+'Z'}/><path className="symbol" d={'M'+(x-20)+' '+(y+10)+'H'+(x+20)}/>
   <path className="symbol emission" d={'M'+(x+23)+' '+(y-12)+'l18 -15M'+(x+28)+' '+(y-2)+'l18 -15'}/>
   <path className="symbol" d={'M'+x+' '+(y-34)+'V'+(y-15)+'M'+x+' '+(y+10)+'V'+(y+34)}/>
   <text className="part-label" x={x+52} y={y-2}>{name}</text><text className="terminal-label" x={x-30} y={y-20}>A</text><text className="terminal-label" x={x-30} y={y+22}>K</text>
 </Hit>;
}
function Bjt({id,x,y,polarity='npn',name='',selected,onSelect}){
 const pnp=polarity==='pnp',top=pnp?'E':'C',bottom=pnp?'C':'E';
 return <Hit id={id} selected={selected} onSelect={onSelect} label={name||id}>
   <circle className="device-ring" cx={x} cy={y} r="35"/><path className="symbol" d={'M'+(x-12)+' '+(y-20)+'V'+(y+20)+'M'+(x-48)+' '+y+'H'+(x-12)+'M'+(x-12)+' '+(y-12)+'L'+x+' '+(y-24)+'L'+x+' '+(y-42)+'M'+(x-12)+' '+(y+12)+'L'+x+' '+(y+24)+'L'+x+' '+(y+42)}/>
   <path className="arrow" d={pnp?('M'+(x-6)+' '+(y-18)+'l7 -6l-1 9Z'):('M'+(x-1)+' '+(y+24)+'l-8 -1l4 -7Z')}/>
   <text className="terminal-label" x={x+9} y={y-30}>{top}</text><text className="terminal-label" x={x+9} y={y+40}>{bottom}</text><text className="terminal-label" x={x-56} y={y-8}>B</text>
   <text className="part-label" x={x+50} y={y-2}>{id} · {name}</text>
 </Hit>;
}
function Mos({id,x,y,polarity='nmos',name='',selected,onSelect}){
 const p=polarity==='pmos',top=p?'S':'D',bottom=p?'D':'S';
 return <Hit id={id} selected={selected} onSelect={onSelect} label={name||id}>
  <circle className="device-ring" cx={x} cy={y} r="35"/><path className="symbol" d={'M'+(x-5)+' '+(y-20)+'V'+(y+20)+'M'+(x-18)+' '+(y-18)+'V'+(y+18)+'M'+(x-48)+' '+y+'H'+(x-24)+'M'+(x-5)+' '+(y-12)+'H'+(x+4)+'L'+(x+4)+' '+(y-42)+'M'+(x-5)+' '+(y+12)+'H'+(x+4)+'L'+(x+4)+' '+(y+42)}/>
  {p&&<circle className="symbol-fill" cx={x-23} cy={y} r="4"/>}
  <text className="terminal-label" x={x+12} y={y-31}>{top}</text><text className="terminal-label" x={x+12} y={y+40}>{bottom}</text><text className="terminal-label" x={x-57} y={y-8}>G</text>
  <text className="part-label" x={x+50} y={y-2}>{id} · {name}</text>
 </Hit>;
}
function DigitalNpn({id='Q1',x,y,name,selected,onSelect}){
 return <Hit id={id} selected={selected} onSelect={onSelect} label={name}>
  <rect className="device-ring digital-package" x={x-52} y={y-48} width="104" height="96" rx="9"/>
  <path className="symbol" d={'M'+x+' '+(y-48)+'V'+(y-18)+'M'+x+' '+(y+18)+'V'+(y+48)+'M'+(x-52)+' '+y+'H'+(x-34)+'M'+(x-22)+' '+(y-18)+'V'+(y+18)+'M'+(x-22)+' '+(y-12)+'L'+x+' '+(y-22)+'M'+(x-22)+' '+(y+12)+'L'+x+' '+(y+22)}/>
  <rect className="mini-resistor" x={x-34} y={y-6} width="12" height="12"/><path className="symbol" d={'M'+(x-22)+' '+(y+18)+'H'+(x-10)+'V'+(y+34)+'H'+x}/>
  <text className="terminal-label" x={x+7} y={y-34}>C</text><text className="terminal-label" x={x+7} y={y+43}>E</text><text className="terminal-label" x={x-48} y={y-10}>IN</text>
  <text className="part-label" x={x+64} y={y-8}>{id} · {name}</text><text className="minor-label" x={x+64} y={y+11}>내장 R1 / R2</text>
 </Hit>;
}
function Gpio({x,y,label,state,id='GPIO1',selected,onSelect}){
 return <Hit id={id} selected={selected} onSelect={onSelect} label={label}><rect className="gpio-box" x={x-45} y={y-19} width="90" height="38" rx="7"/><text className="part-label" x={x} y={y+5} textAnchor="middle">{label}</text>{state&&<text className="minor-label" x={x} y={y+36} textAnchor="middle">{state}</text>}</Hit>;
}
export default function CircuitDiagram({config,point,selectedInstance,onSelectInstance}){
 const id=config.topology,template=circuitTemplate(id),led=LEDS[config.led],loadOn=(point?.current??0)>1e-9,driveOn=Math.abs(point?.gpioCurrent??0)>1e-9;
 const effective=point?.effectiveGpioState??gpioState(config),stateText=config.deviceModels?.GPIO1?'요청 '+config.state+' · 유효 '+effective:null;
 const name=i=>i==='LED1'?led.id:(getDeviceModel(config.deviceModels?.[i])?.id??i);
 const pick={selected:selectedInstance,onSelect:onSelectInstance};
 const inputNpn=id!=='nmos-pmos',outPnp=id==='npn-pnp';
 const compoundOutput=outPnp?<Bjt id="Q2" x={520} y={92} name={name('Q2')} polarity="pnp" {...pick}/>:<Mos id="Q2" x={520} y={92} name={name('Q2')} polarity="pmos" {...pick}/>;
 const compoundInput=inputNpn?<Bjt id="Q1" x={245} y={292} name={name('Q1')} polarity="npn" {...pick}/>:<Mos id="Q1" x={245} y={292} name={name('Q1')} polarity="nmos" {...pick}/>;
 const compoundInputPull=!inputNpn?<><ResV id="RGS_IN" x={185} y={345} value={config.gatePull} label="RGS(in)" {...pick}/><Wire d="M185 292V305M185 385H249"/></>:null;
 const lowLoad=(driver,extra=null)=><>{<Rail/>}<Wire d="M470 45V60" on={loadOn}/><ResV id="RLED" x={470} y={88} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M470 128V145" on={loadOn}/><Led x={470} y={180} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M470 214V238" on={loadOn}/>{driver}{extra}</>;
 const highLoad=(driver)=><><Rail/><Wire d="M470 45V55" on={loadOn}/>{driver}<Wire d="M470 137V150" on={loadOn}/><ResV id="RLED" x={470} y={180} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M470 220V238" on={loadOn}/><Led x={470} y={272} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M470 306V379" on={loadOn}/><Ground/></>;
 let body=null;
 if(id==='resistor') body=<><Rail/><Wire d="M470 45V60" on={loadOn}/><ResV id="RLED" x={470} y={90} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M470 130V150" on={loadOn}/><Led x={470} y={185} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M470 219V379" on={loadOn}/><Ground/></>;
 else if(id==='gpio-source') body=<><Gpio x={470} y={45} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M470 64V70" on={loadOn}/><ResV id="RLED" x={470} y={100} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M470 140V155" on={loadOn}/><Led x={470} y={190} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M470 224V379" on={loadOn}/><Ground/></>;
 else if(id==='gpio-sink') body=<><Rail/><Wire d="M470 45V70" on={loadOn}/><ResV id="RLED" x={470} y={100} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M470 140V155" on={loadOn}/><Led x={470} y={190} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M470 224V330" on={loadOn}/><Gpio x={470} y={350} label={name('GPIO1')} state={stateText} {...pick}/>;
 else if(id==='digital-npn') body=<>{lowLoad(<><DigitalNpn x={470} y={292} name={name('Q1')} {...pick}/><Wire d="M470 340V379" on={loadOn}/><Ground/></>)}<Gpio x={85} y={292} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M130 292H418" on={driveOn}/></>;
 else if(id==='npn-low') body=<>{lowLoad(<><Bjt id="Q1" x={470} y={292} name={name('Q1')} polarity="npn" {...pick}/><Wire d="M470 334V379" on={loadOn}/><Ground/></>)}<Gpio x={75} y={292} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M120 292H155" on={driveOn}/><ResH id="RB" x1={155} x2={405} y={292} value={config.baseResistance} {...pick}/></>;
 else if(id==='npn-follower') body=<><Rail/><Wire d="M470 45V55" on={loadOn}/><Bjt id="Q1" x={470} y={100} name={name('Q1')} polarity="npn" {...pick}/><Wire d="M470 142V155" on={loadOn}/><ResV id="RLED" x={470} y={185} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M470 225V240" on={loadOn}/><Led x={470} y={275} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M470 309V379" on={loadOn}/><Ground/><Gpio x={75} y={100} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M120 100H155" on={driveOn}/><ResH id="RB" x1={155} x2={405} y={100} value={config.baseResistance} {...pick}/></>;
 else if(id==='npn-current-sink') body=<>{lowLoad(<Bjt id="Q1" x={470} y={270} name={name('Q1')} polarity="npn" {...pick}/>,<><Wire d="M470 312V318" on={loadOn}/><ResV id="RE" x={470} y={344} value={config.emitterResistance} {...pick}/><Wire d="M470 384V386"/><Ground y={404}/></>)}<Gpio x={75} y={270} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M120 270H155" on={driveOn}/><ResH id="RB" x1={155} x2={405} y={270} value={config.baseResistance} {...pick}/></>;
 else if(id==='nmos-low') body=<>{lowLoad(<><Mos id="Q1" x={470} y={292} name={name('Q1')} polarity="nmos" {...pick}/><Wire d="M474 334V379" on={loadOn}/><Ground x={474}/></>)}<Gpio x={75} y={292} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M120 292H145" on={driveOn}/><ResH id="RG" x1={145} x2={405} y={292} value={config.gateResistance} {...pick}/><ResV id="RGS" x={375} y={348} value={config.gatePull} label="RGS" {...pick}/><Wire d="M375 292V308M375 388H474" on={driveOn}/></>;
 else if(id==='pnp-high') body=<>{highLoad(<Bjt id="Q1" x={470} y={95} name={name('Q1')} polarity="pnp" {...pick}/>)}<Gpio x={75} y={95} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M120 95H155" on={driveOn}/><ResH id="RB" x1={155} x2={405} y={95} value={config.baseResistance} {...pick}/></>;
 else if(id==='pmos-high') body=<>{highLoad(<Mos id="Q1" x={470} y={95} name={name('Q1')} polarity="pmos" {...pick}/>)}<Gpio x={75} y={95} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M120 95H145" on={driveOn}/><ResH id="RG" x1={145} x2={405} y={95} value={config.gateResistance} {...pick}/><ResV id="RGS" x={375} y={58} value={config.gatePull} label="RGS" {...pick}/><Wire d="M375 18H470V28M375 98V95" on={driveOn}/></>;
 else {
   body=(<g className="compound-body">
    <Rail x={520}/>{compoundOutput}<Wire d="M520 134V148" on={loadOn}/>
    <ResV id="RLED" x={520} y={178} value={point?.config.resistance??config.resistance} {...pick}/><Wire d="M520 218V235" on={loadOn}/>
    <Led x={520} y={270} color={led.color} name={led.id} on={loadOn} {...pick}/><Wire d="M520 304V379" on={loadOn}/><Ground x={520}/>
    {compoundInput}<Wire d="M249 334V379"/><Ground x={249}/>
    <Gpio x={70} y={292} label={name('GPIO1')} state={stateText} {...pick}/><Wire d="M115 292H130" on={driveOn}/>
    <ResH id={inputNpn?'RB':'RG'} x1={130} x2={180} y={292} value={inputNpn?config.baseResistance:config.gateResistance} {...pick}/><Wire d="M180 292H197" on={driveOn}/>
    <Wire d="M249 250V130H415" on={driveOn}/><ResH id="Rdrive" x1={415} x2={455} y={130} value={config.gateResistance} label="Rdrive" {...pick}/><Wire d="M455 130H465V92" on={driveOn}/>
    <ResV id={outPnp?'RBE':'RGS_OUT'} x={430} y={62} value={config.gatePull} label={outPnp?'RBE':'RGS(out)'} {...pick}/><Wire d="M430 22H520M430 102V130" on={driveOn}/>
    {compoundInputPull}
    <text className="minor-label" x="335" y="405">RG/Rdrive 및 pull 값은 현재 공용 설정값입니다.</text>
   </g>);
 }
 return <figure className="schematic" data-topology={id}>
   <div className="schematic-head"><div><strong>{template?'회로 해석도':'회로'}</strong><span>{stateText??'GPIO 미사용'} · {point?.region??'미계산'}</span></div><span className={cls('current-pill',loadOn&&'on')}>{point?((point.current*1000).toPrecision(4)+' mA'):'—'}</span></div>
   <div className="schematic-scroll"><svg viewBox="0 0 720 430" role="img" aria-label={id+' 회로도'}>{body}</svg></div>
   <figcaption>{template?.connections.length??0}개 연결 정의 · 선택한 소자를 클릭/Enter로 상세 확인</figcaption>
 </figure>;
}
