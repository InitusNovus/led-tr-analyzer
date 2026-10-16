import React,{useEffect,useRef} from 'react';
import { gpioState } from '../core/devices.js';
import { circuitTemplate } from '../ui/circuitTemplates.js';
import { buildScene, junctions } from '../ui/schematic.js';

const cls = (...values) => values.filter(Boolean).join(' ');

function Hit({ id, selected, onSelect, label, children }) {
    const activate = (event) => {
        if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect?.(id);
        }
    };
    return (
        <g data-instance-id={id} className={cls('schem-part', selected === id && 'selected')} role="button" tabIndex={0}
            aria-label={label ?? id} onClick={activate} onKeyDown={activate}>
            {children}
        </g>
    );
}

/** Invisible, generously padded click target: thin resistor bodies are hard to hit with a pointer. */
function HitArea({ boxes, pad = 8 }) {
    if (!boxes.length) return null;
    const x1 = Math.min(...boxes.map(b => b.x)) - pad, y1 = Math.min(...boxes.map(b => b.y)) - pad;
    const x2 = Math.max(...boxes.map(b => b.x + b.w)) + pad, y2 = Math.max(...boxes.map(b => b.y + b.h)) + pad;
    return <rect className="hit-area" x={x1} y={y1} width={x2 - x1} height={y2 - y1} />;
}
const Labels = ({ p }) => p.labels.map((t, i) => <text key={i} className={t.cls} x={t.x} y={t.y} textAnchor={t.anchor}>{t.text}</text>);
const Leads = ({ d, on }) => <path className={cls('wire', on && 'energized')} d={d} />;

/* Each symbol draws only from its own centre and pins, so the wires (built from the same pins) always meet it. */
function ResV({ p }) {
    const { x, y } = p;
    return <>
        <path className="symbol" d={`M${x} ${y - 34}V${y - 25}M${x} ${y + 25}V${y + 34}`} />
        <rect className="symbol-fill" x={x - 10} y={y - 25} width="20" height="50" rx="3" />
    </>;
}
function ResH({ p, on }) {
    const { y, x1, x2, width, x } = p, left = x - width / 2, right = x + width / 2;
    return <>
        <path className={cls('wire', on && 'energized')} d={`M${x1} ${y}H${left}M${right} ${y}H${x2}`} />
        <rect className="symbol-fill" x={left} y={y - 10} width={width} height="20" rx="3" />
    </>;
}
function Led({ p, on, currentA }) {
    const { x, y } = p, cue = on ? 0.1 + 0.38 * Math.min(1, Math.max(0, (currentA ?? 0) / .02)) : 0;
    return <>
        {on ? <circle className="led-glow" cx={x} cy={y} r="31" fill={p.color} opacity={cue} /> : null}
        <path className="symbol led-body" d={`M${x - 18} ${y - 15}H${x + 18}L${x} ${y + 8}Z`} />
        <path className="symbol" d={`M${x - 20} ${y + 10}H${x + 20}`} />
        <path className="symbol emission" d={`M${x + 23} ${y - 12}l18 -15M${x + 28} ${y - 2}l18 -15`} />
        <path className="symbol" d={`M${x} ${y - 34}V${y - 15}M${x} ${y + 10}V${y + 34}`} />
    </>;
}
function BjtShape({ p, extend = 0 }) {
    const { x, y } = p, pnp = p.polarity === 'pnp';
    const arrow = pnp ? `M${x - 6} ${y - 18}l7 -6l-1 9Z` : `M${x - 1} ${y + 24}l-8 -1l4 -7Z`;
    return <>
        <circle className="device-ring" cx={x} cy={y} r="35" />
        <path className="symbol" d={`M${x - 12} ${y - 20}V${y + 20}M${x - 48} ${y}H${x - 12}M${x - 12} ${y - 12}L${x} ${y - 24}V${y - 42}M${x - 12} ${y + 12}L${x} ${y + 24}V${y + 42 + extend}`} />
        <path className="arrow" d={arrow} />
    </>;
}
function MosShape({ p }) {
    const { x, y } = p, pmos = p.polarity === 'pmos', gateEnd = pmos ? x - 27 : x - 18;
    return <>
        <circle className="device-ring" cx={x} cy={y} r="35" />
        <path className="symbol" d={`M${x - 5} ${y - 20}V${y + 20}M${x - 18} ${y - 18}V${y + 18}M${x - 48} ${y}H${gateEnd}M${x - 5} ${y - 12}H${x}V${y - 42}M${x - 5} ${y + 12}H${x}V${y + 42}`} />
        {pmos ? <circle className="symbol-fill" cx={x - 23} cy={y} r="4" /> : null}
    </>;
}
function Gpio({ p }) {
    return <rect className="gpio-box" x={p.x - 45} y={p.y - 19} width="90" height="38" rx="7" />;
}
function Rail({ p }) {
    const { x, y } = p;
    return <g><path className="wire rail" d={`M${x} ${y}V${y - 17}`} /><path className="wire rail" d={`M${x - 8} ${y - 8}L${x} ${y - 17}L${x + 8} ${y - 8}`} /></g>;
}
function Ground({ p }) {
    const { x, y } = p;
    return <g><path className="wire" d={`M${x} ${y}V${y + 13}`} /><path className="wire" d={`M${x - 16} ${y + 13}H${x + 16}M${x - 10} ${y + 20}H${x + 10}M${x - 4} ${y + 27}H${x + 4}`} /></g>;
}

function Part({ p, loadOn, driveOn, point, selected, onSelect, names }) {
    const on = p.net === 'drive' ? driveOn : loadOn, common = { selected, onSelect };
    switch (p.kind) {
        case 'rail': return <><Rail p={p} /><Labels p={p} /></>;
        case 'ground': return <><Ground p={p} /><Labels p={p} /></>;
        case 'resV': return <Hit id={p.id} label={p.id} {...common}><HitArea boxes={p.boxes} /><ResV p={p} /><Labels p={p} /></Hit>;
        case 'resH': return <Hit id={p.id} label={p.id} {...common}><HitArea boxes={p.boxes} /><ResH p={p} on={on} /><Labels p={p} /></Hit>;
        case 'led': return <Hit id={p.id} label={names.led} {...common}><HitArea boxes={p.boxes} /><Led p={p} on={loadOn} currentA={point?.current} /><Labels p={p} /></Hit>;
        case 'bjt': return <Hit id={p.id} label={p.id} {...common}><HitArea boxes={p.boxes} pad={4} /><BjtShape p={p} /><Labels p={p} /></Hit>;
        case 'mos': return <Hit id={p.id} label={p.id} {...common}><HitArea boxes={p.boxes} pad={4} /><MosShape p={p} /><Labels p={p} /></Hit>;
        case 'gpio': return <Hit id={p.id} label={names.gpio} {...common}><HitArea boxes={p.boxes} pad={4} /><Gpio p={p} /><Labels p={p} /></Hit>;
        case 'dtc': {
            const { x, y } = p, r1 = { x: x - 71, y, x1: x - 96, x2: x - 48, width: 26 }, label = (t) => p.labels.filter(l => l.text === t);
            const own = p.labels.filter(l => !['R1', 'R2', 'IN'].includes(l.text));
            return <>
                <Hit id={p.id} label={p.id} {...common}>
                    <rect className="package-outline" x={p.outline.x} y={p.outline.y} width={p.outline.w} height={p.outline.h} rx={p.outline.r} />
                    <HitArea boxes={p.boxes.slice(0, 1)} pad={4} />
                    <BjtShape p={{ ...p, polarity: 'npn' }} />
                    {own.map((t, i) => <text key={i} className={t.cls} x={t.x} y={t.y} textAnchor={t.anchor}>{t.text}</text>)}
                </Hit>
                <Hit id="Q1.R1" label="Q1 R1 (내장)" {...common}>
                    <HitArea boxes={p.boxes.slice(1, 2)} />
                    <ResH p={{ ...r1, x: x - 71 }} on={driveOn} />
                    {label('R1').concat(label('IN')).map((t, i) => <text key={i} className={t.cls} x={t.x} y={t.y} textAnchor={t.anchor}>{t.text}</text>)}
                </Hit>
                <Hit id="Q1.R2" label="Q1 R2 (내장)" {...common}>
                    <HitArea boxes={p.boxes.slice(2, 3)} />
                    <path className="symbol" d={`M${x - 48} ${y}V${y + 24}M${x - 48} ${y + 46}V${y + 54}`} />
                    <rect className="symbol-fill" x={x - 55} y={y + 24} width="14" height="22" rx="2" />
                    {label('R2').map((t, i) => <text key={i} className={t.cls} x={t.x} y={t.y} textAnchor={t.anchor}>{t.text}</text>)}
                </Hit>
            </>;
        }
        default: return null;
    }
}

export default function CircuitDiagram({ config, point, selectedInstance, onSelectInstance }) {
    const scrollRef=useRef(null);
    useEffect(()=>{
        const el=scrollRef.current;
        if(!el)return;
        if(window.matchMedia('(max-width:720px)').matches){
            const focusX=['resistor','gpio-source','gpio-sink'].includes(config.topology)?470:
                config.topology==='npn-pnp'||config.topology==='npn-pmos'||config.topology==='nmos-pmos'?410:395;
            const expectedLeft=focusX/720*el.scrollWidth-el.clientWidth/2;
            el.scrollLeft=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,expectedLeft));
        }else el.scrollLeft=0;
    },[config.topology]);
    const template = circuitTemplate(config.topology);
    const scene = buildScene(config, point);
    const loadOn = (point?.current ?? 0) > 1e-9, driveOn = Math.abs(point?.gpioCurrent ?? 0) > 1e-9;
    const stateText = config.deviceModels?.GPIO1
        ? `요청 ${config.state} · 유효 ${point?.effectiveGpioState ?? gpioState(config)}`
        : 'GPIO 미사용';
    const names = { led: config.led, gpio: config.deviceModels?.GPIO1 };
    return (
        <figure className="schematic" data-topology={config.topology}>
            <div className="schematic-head">
                <div>
                    <strong>회로 해석도</strong>
                    <span>{stateText} · {point?.region ?? '미계산'}</span>
                </div>
                <span className={cls('current-pill', loadOn && 'on')}>
                    {point ? `${(point.current * 1000).toPrecision(4)} mA` : '—'}
                </span>
            </div>
            <div className="schematic-scroll" ref={scrollRef}>
                <svg viewBox={`0 0 ${scene.view.w} ${scene.view.h}`} role="img" aria-label={`${config.topology} 회로도`}>
                    <g className={cls(scene.parts.some(p => p.id === 'Q2') && 'compound-body')}>
                        {scene.wires.map((w, i) => <polyline key={i} className={cls('wire', (w.net === 'drive' ? driveOn : loadOn) && 'energized')}
                            points={w.points.map(q => q.join(',')).join(' ')} fill="none" strokeLinejoin="round" />)}
                        {junctions(scene).map(([x, y]) => <circle key={x + ',' + y} className="junction" cx={x} cy={y} r="3.6" />)}
                        {scene.parts.map(p => <Part key={p.id} p={p} loadOn={loadOn} driveOn={driveOn} point={point} selected={selectedInstance}
                            onSelect={onSelectInstance} names={names} />)}
                    </g>
                </svg>
            </div>
            <figcaption>{template?.connections.length ?? 0}개 연결 정의 · 전류 activity cue (체감 밝기 아님) · 클릭/Enter로 소자 확인</figcaption>
        </figure>
    );
}
