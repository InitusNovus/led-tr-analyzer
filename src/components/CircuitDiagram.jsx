import React from 'react';
import { LEDS, getDeviceModel } from '../data/catalog.js';
import { gpioState } from '../core/devices.js';
import { circuitTemplate } from '../ui/circuitTemplates.js';

const cls = (...values) => values.filter(Boolean).join(' ');

function Hit({ id, selected, onSelect, label, children }) {
    const activate = (event) => {
        if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect?.(id);
        }
    };
    return (
        <g
            data-instance-id={id}
            className={cls('schem-part', selected === id && 'selected')}
            role="button"
            tabIndex={0}
            aria-label={label ?? id}
            onClick={activate}
            onKeyDown={activate}
        >
            {children}
        </g>
    );
}

function Wire({ d, on = false }) {
    return <path className={cls('wire', on && 'energized')} d={d} />;
}

function Rail({ x = 470, label = 'VLED' }) {
    return (
        <g>
            <path className="wire rail" d={`M${x} 45V28`} />
            <path className="wire rail" d={`M${x - 8} 36L${x} 28L${x + 8} 36`} />
            <text className="rail-label" x={x} y="18" textAnchor="middle">{label}</text>
        </g>
    );
}

function Ground({ x = 470, y = 397 }) {
    return (
        <g>
            <path className="wire" d={`M${x} ${y - 18}V${y - 5}`} />
            <path className="wire" d={`M${x - 16} ${y - 5}H${x + 16}M${x - 10} ${y + 2}H${x + 10}M${x - 4} ${y + 9}H${x + 4}`} />
            <text className="minor-label" x={x} y={y + 27} textAnchor="middle">GND</text>
        </g>
    );
}

function ResV({ id, x, y, value, label = id, selected, onSelect }) {
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={label}>
            <path className="symbol" d={`M${x} ${y - 40}V${y - 25}M${x} ${y + 25}V${y + 40}`} />
            <rect className="symbol-fill" x={x - 10} y={y - 25} width="20" height="50" rx="3" />
            <text className="part-label" x={x + 20} y={y + 5}>{label}{value != null ? ` ${value}Ω` : ''}</text>
        </Hit>
    );
}

function ResH({ id, x1, x2, y, value, label = id, selected, onSelect }) {
    const mid = (x1 + x2) / 2;
    const width = Math.min(72, Math.max(42, (x2 - x1) * 0.35));
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={label}>
            <path className="symbol" d={`M${x1} ${y}H${mid - width / 2}M${mid + width / 2} ${y}H${x2}`} />
            <rect className="symbol-fill" x={mid - width / 2} y={y - 10} width={width} height="20" rx="3" />
            <text className="part-label" x={mid} y={y - 17} textAnchor="middle">{label}{value != null ? ` ${value}Ω` : ''}</text>
        </Hit>
    );
}

function Led({ x, y, color, id = 'LED1', name = '', selected, onSelect, on = false }) {
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={name || id}>
            {on ? <circle className="led-glow" cx={x} cy={y} r="31" fill={color} /> : null}
            <path className="symbol led-body" d={`M${x - 18} ${y - 15}H${x + 18}L${x} ${y + 8}Z`} />
            <path className="symbol" d={`M${x - 20} ${y + 10}H${x + 20}`} />
            <path className="symbol emission" d={`M${x + 23} ${y - 12}l18 -15M${x + 28} ${y - 2}l18 -15`} />
            <path className="symbol" d={`M${x} ${y - 34}V${y - 15}M${x} ${y + 10}V${y + 34}`} />
            <text className="part-label" x={x + 52} y={y - 2}>{name}</text>
            <text className="terminal-label" x={x - 30} y={y - 20}>A</text>
            <text className="terminal-label" x={x - 30} y={y + 22}>K</text>
        </Hit>
    );
}

function Bjt({ id, x, y, polarity = 'npn', name = '', selected, onSelect }) {
    const pnp = polarity === 'pnp';
    const top = pnp ? 'E' : 'C';
    const bottom = pnp ? 'C' : 'E';
    const arrow = pnp
        ? `M${x - 6} ${y - 18}l7 -6l-1 9Z`
        : `M${x - 1} ${y + 24}l-8 -1l4 -7Z`;
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={name || id}>
            <circle className="device-ring" cx={x} cy={y} r="35" />
            <path className="symbol" d={`M${x - 12} ${y - 20}V${y + 20}M${x - 48} ${y}H${x - 12}M${x - 12} ${y - 12}L${x} ${y - 24}L${x} ${y - 42}M${x - 12} ${y + 12}L${x} ${y + 24}L${x} ${y + 42}`} />
            <path className="arrow" d={arrow} />
            <text className="terminal-label" x={x + 9} y={y - 30}>{top}</text>
            <text className="terminal-label" x={x + 9} y={y + 40}>{bottom}</text>
            <text className="terminal-label" x={x - 56} y={y - 8}>B</text>
            <text className="part-label" x={x + 50} y={y - 2}>{id} · {name}</text>
        </Hit>
    );
}

function Mos({ id, x, y, polarity = 'nmos', name = '', selected, onSelect }) {
    const pmos = polarity === 'pmos';
    const top = pmos ? 'S' : 'D';
    const bottom = pmos ? 'D' : 'S';
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={name || id}>
            <circle className="device-ring" cx={x} cy={y} r="35" />
            <path className="symbol" d={`M${x - 5} ${y - 20}V${y + 20}M${x - 18} ${y - 18}V${y + 18}M${x - 48} ${y}H${x - 24}M${x - 5} ${y - 12}H${x + 4}L${x + 4} ${y - 42}M${x - 5} ${y + 12}H${x + 4}L${x + 4} ${y + 42}`} />
            {pmos ? <circle className="symbol-fill" cx={x - 23} cy={y} r="4" /> : null}
            <text className="terminal-label" x={x + 12} y={y - 31}>{top}</text>
            <text className="terminal-label" x={x + 12} y={y + 40}>{bottom}</text>
            <text className="terminal-label" x={x - 57} y={y - 8}>G</text>
            <text className="part-label" x={x + 50} y={y - 2}>{id} · {name}</text>
        </Hit>
    );
}

function DigitalNpn({ id = 'Q1', x, y, name, selected, onSelect }) {
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={name}>
            <rect className="device-ring digital-package" x={x - 62} y={y - 52} width="124" height="104" rx="9" />
            <path className="symbol" d={`M${x - 62} ${y}H${x - 46}M${x - 24} ${y}H${x - 10}`} />
            <rect className="mini-resistor" x={x - 46} y={y - 7} width="22" height="14" rx="2" />
            <text className="terminal-label" x={x - 38} y={y - 13}>R1</text>

            <path className="symbol" d={`M${x - 10} ${y - 21}V${y + 21}M${x - 10} ${y - 12}L${x + 12} ${y - 24}L${x + 12} ${y - 52}M${x - 10} ${y + 12}L${x + 12} ${y + 24}L${x + 12} ${y + 52}`} />
            <path className="arrow" d={`M${x + 10} ${y + 24}l-9 -1l5 -8Z`} />

            <path className="symbol" d={`M${x - 10} ${y + 16}H${x - 32}V${y + 24}`} />
            <rect className="mini-resistor" x={x - 39} y={y + 24} width="14" height="20" rx="2" />
            <path className="symbol" d={`M${x - 32} ${y + 44}V${y + 48}H${x + 12}`} />
            <text className="terminal-label" x={x - 58} y={y + 40}>R2</text>

            <text className="terminal-label" x={x + 19} y={y - 35}>C</text>
            <text className="terminal-label" x={x + 19} y={y + 45}>E</text>
            <text className="terminal-label" x={x - 58} y={y - 10}>IN</text>
            <text className="part-label" x={x + 76} y={y - 7}>{id} · {name}</text>
            <text className="minor-label" x={x + 76} y={y + 14}>digital NPN · R1/R2 내장</text>
        </Hit>
    );
}

function Gpio({ x, y, label, state, id = 'GPIO1', selected, onSelect }) {
    return (
        <Hit id={id} selected={selected} onSelect={onSelect} label={label}>
            <rect className="gpio-box" x={x - 45} y={y - 19} width="90" height="38" rx="7" />
            <text className="part-label" x={x} y={y + 5} textAnchor="middle">{label}</text>
            {state ? <text className="minor-label" x={x} y={y + 36} textAnchor="middle">{state}</text> : null}
        </Hit>
    );
}

function CommonLoad({ config, point, led, selected, onSelect, x = 470, top = 55, highSide = false, driver }) {
    const on = (point?.current ?? 0) > 1e-9;
    const resistance = point?.config.resistance ?? config.resistance;
    if (highSide) {
        return (
            <g>
                <Rail x={x} />
                {driver}
                <Wire d={`M${x} 137V150`} on={on} />
                <ResV id="RLED" x={x} y={180} value={resistance} selected={selected} onSelect={onSelect} />
                <Wire d={`M${x} 220V238`} on={on} />
                <Led x={x} y={272} color={led.color} name={led.id} on={on} selected={selected} onSelect={onSelect} />
                <Wire d={`M${x} 306V379`} on={on} />
                <Ground x={x} />
            </g>
        );
    }
    return (
        <g>
            <Rail x={x} />
            <Wire d={`M${x} 45V60`} on={on} />
            <ResV id="RLED" x={x} y={88} value={resistance} selected={selected} onSelect={onSelect} />
            <Wire d={`M${x} 128V145`} on={on} />
            <Led x={x} y={180} color={led.color} name={led.id} on={on} selected={selected} onSelect={onSelect} />
            <Wire d={`M${x} 214V238`} on={on} />
            {driver}
        </g>
    );
}

function TopologyBody({ config, point, selected, onSelect }) {
    const id = config.topology;
    const led = LEDS[config.led];
    const loadOn = (point?.current ?? 0) > 1e-9;
    const driveOn = Math.abs(point?.gpioCurrent ?? 0) > 1e-9;
    const modelName = (instanceId) => getDeviceModel(config.deviceModels?.[instanceId])?.id ?? instanceId;
    const effective = point?.effectiveGpioState ?? gpioState(config);
    const stateText = config.deviceModels?.GPIO1 ? `요청 ${config.state} · 유효 ${effective}` : null;
    const resistance = point?.config.resistance ?? config.resistance;
    const common = { selected, onSelect };

    switch (id) {
        case 'resistor':
            return (
                <g>
                    <Rail />
                    <Wire d="M470 45V60" on={loadOn} />
                    <ResV id="RLED" x={470} y={90} value={resistance} {...common} />
                    <Wire d="M470 130V150" on={loadOn} />
                    <Led x={470} y={185} color={led.color} name={led.id} on={loadOn} {...common} />
                    <Wire d="M470 219V379" on={loadOn} />
                    <Ground />
                </g>
            );
        case 'gpio-source':
            return (
                <g>
                    <Gpio x={470} y={45} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M470 64V70" on={loadOn} />
                    <ResV id="RLED" x={470} y={100} value={resistance} {...common} />
                    <Wire d="M470 140V155" on={loadOn} />
                    <Led x={470} y={190} color={led.color} name={led.id} on={loadOn} {...common} />
                    <Wire d="M470 224V379" on={loadOn} />
                    <Ground />
                </g>
            );
        case 'gpio-sink':
            return (
                <g>
                    <Rail />
                    <Wire d="M470 45V70" on={loadOn} />
                    <ResV id="RLED" x={470} y={100} value={resistance} {...common} />
                    <Wire d="M470 140V155" on={loadOn} />
                    <Led x={470} y={190} color={led.color} name={led.id} on={loadOn} {...common} />
                    <Wire d="M470 224V330" on={loadOn} />
                    <Gpio x={470} y={350} label={modelName('GPIO1')} state={stateText} {...common} />
                </g>
            );
        case 'digital-npn':
            return (
                <g>
                    <CommonLoad config={config} point={point} led={led} {...common}
                        driver={
                            <g>
                                <DigitalNpn x={470} y={292} name={modelName('Q1')} {...common} />
                                <Wire d="M470 340V379" on={loadOn} />
                                <Ground />
                            </g>
                        }
                    />
                    <Gpio x={85} y={292} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M130 292H418" on={driveOn} />
                </g>
            );
        case 'npn-low':
            return (
                <g>
                    <CommonLoad config={config} point={point} led={led} {...common}
                        driver={
                            <g>
                                <Bjt id="Q1" x={470} y={292} name={modelName('Q1')} polarity="npn" {...common} />
                                <Wire d="M470 334V379" on={loadOn} />
                                <Ground />
                            </g>
                        }
                    />
                    <Gpio x={75} y={292} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M120 292H155" on={driveOn} />
                    <ResH id="RB" x1={155} x2={405} y={292} value={config.baseResistance} {...common} />
                </g>
            );
        case 'npn-follower':
            return (
                <g>
                    <Rail />
                    <Wire d="M470 45V55" on={loadOn} />
                    <Bjt id="Q1" x={470} y={100} name={modelName('Q1')} polarity="npn" {...common} />
                    <Wire d="M470 142V155" on={loadOn} />
                    <ResV id="RLED" x={470} y={185} value={resistance} {...common} />
                    <Wire d="M470 225V240" on={loadOn} />
                    <Led x={470} y={275} color={led.color} name={led.id} on={loadOn} {...common} />
                    <Wire d="M470 309V379" on={loadOn} />
                    <Ground />
                    <Gpio x={75} y={100} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M120 100H155" on={driveOn} />
                    <ResH id="RB" x1={155} x2={405} y={100} value={config.baseResistance} {...common} />
                </g>
            );
        case 'npn-current-sink':
            return (
                <g>
                    <CommonLoad config={config} point={point} led={led} {...common}
                        driver={<Bjt id="Q1" x={470} y={270} name={modelName('Q1')} polarity="npn" {...common} />}
                    />
                    <Wire d="M470 312V318" on={loadOn} />
                    <ResV id="RE" x={470} y={344} value={config.emitterResistance} {...common} />
                    <Wire d="M470 384V386" />
                    <Ground y={404} />
                    <Gpio x={75} y={270} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M120 270H155" on={driveOn} />
                    <ResH id="RB" x1={155} x2={405} y={270} value={config.baseResistance} {...common} />
                </g>
            );
        case 'nmos-low':
            return (
                <g>
                    <CommonLoad config={config} point={point} led={led} {...common}
                        driver={
                            <g>
                                <Mos id="Q1" x={470} y={292} name={modelName('Q1')} polarity="nmos" {...common} />
                                <Wire d="M474 334V379" on={loadOn} />
                                <Ground x={474} />
                            </g>
                        }
                    />
                    <Gpio x={75} y={292} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M120 292H145" on={driveOn} />
                    <ResH id="RG" x1={145} x2={405} y={292} value={config.gateResistance} {...common} />
                    <ResV id="RGS" x={375} y={348} value={config.gatePull} label="RGS" {...common} />
                    <Wire d="M375 292V308M375 388H474" on={driveOn} />
                </g>
            );
        case 'pnp-high':
            return (
                <g>
                    <CommonLoad config={config} point={point} led={led} highSide {...common}
                        driver={<Bjt id="Q1" x={470} y={95} name={modelName('Q1')} polarity="pnp" {...common} />}
                    />
                    <Gpio x={75} y={95} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M120 95H155" on={driveOn} />
                    <ResH id="RB" x1={155} x2={405} y={95} value={config.baseResistance} {...common} />
                </g>
            );
        case 'pmos-high':
            return (
                <g>
                    <CommonLoad config={config} point={point} led={led} highSide {...common}
                        driver={<Mos id="Q1" x={470} y={95} name={modelName('Q1')} polarity="pmos" {...common} />}
                    />
                    <Gpio x={75} y={95} label={modelName('GPIO1')} state={stateText} {...common} />
                    <Wire d="M120 95H145" on={driveOn} />
                    <ResH id="RG" x1={145} x2={405} y={95} value={config.gateResistance} {...common} />
                    <ResV id="RGS" x={375} y={58} value={config.gatePull} label="RGS" {...common} />
                    <Wire d="M375 18H470V28M375 98V95" on={driveOn} />
                </g>
            );
        case 'npn-pnp':
            return <Compound config={config} point={point} led={led} outputFamily="pnp" inputFamily="npn" selected={selected} onSelect={onSelect} />;
        case 'npn-pmos':
            return <Compound config={config} point={point} led={led} outputFamily="pmos" inputFamily="npn" selected={selected} onSelect={onSelect} />;
        case 'nmos-pmos':
            return <Compound config={config} point={point} led={led} outputFamily="pmos" inputFamily="nmos" selected={selected} onSelect={onSelect} />;
        default:
            return null;
    }
}

function Compound({ config, point, led, outputFamily, inputFamily, selected, onSelect }) {
    const loadOn = (point?.current ?? 0) > 1e-9;
    const driveOn = Math.abs(point?.gpioCurrent ?? 0) > 1e-9;
    const effective = point?.effectiveGpioState ?? gpioState(config);
    const stateText = `요청 ${config.state} · 유효 ${effective}`;
    const modelName = (id) => getDeviceModel(config.deviceModels?.[id])?.id ?? id;
    const resistance = point?.config.resistance ?? config.resistance;
    const common = { selected, onSelect };
    return (
        <g className="compound-body">
            <Rail x={520} />
            {outputFamily === 'pnp'
                ? <Bjt id="Q2" x={520} y={92} name={modelName('Q2')} polarity="pnp" {...common} />
                : <Mos id="Q2" x={520} y={92} name={modelName('Q2')} polarity="pmos" {...common} />
            }
            <Wire d="M520 134V148" on={loadOn} />
            <ResV id="RLED" x={520} y={178} value={resistance} {...common} />
            <Wire d="M520 218V235" on={loadOn} />
            <Led x={520} y={270} color={led.color} name={led.id} on={loadOn} {...common} />
            <Wire d="M520 304V379" on={loadOn} />
            <Ground x={520} />

            {inputFamily === 'npn'
                ? <Bjt id="Q1" x={245} y={292} name={modelName('Q1')} polarity="npn" {...common} />
                : <Mos id="Q1" x={245} y={292} name={modelName('Q1')} polarity="nmos" {...common} />
            }
            <Wire d="M249 334V379" />
            <Ground x={249} />
            <Gpio x={70} y={292} label={modelName('GPIO1')} state={stateText} {...common} />
            <Wire d="M115 292H130" on={driveOn} />
            <ResH
                id={inputFamily === 'npn' ? 'RB' : 'RG'}
                x1={130}
                x2={180}
                y={292}
                value={inputFamily === 'npn' ? config.baseResistance : config.gateResistance}
                {...common}
            />
            <Wire d="M180 292H197" on={driveOn} />
            <Wire d="M249 250V130H415" on={driveOn} />
            <ResH id="Rdrive" x1={415} x2={455} y={130} value={config.gateResistance} label="Rdrive" {...common} />
            <Wire d="M455 130H465V92" on={driveOn} />
            <ResV
                id={outputFamily === 'pnp' ? 'RBE' : 'RGS_OUT'}
                x={430}
                y={62}
                value={config.gatePull}
                label={outputFamily === 'pnp' ? 'RBE' : 'RGS(out)'}
                {...common}
            />
            <Wire d="M430 22H520M430 102V130" on={driveOn} />
            {inputFamily === 'nmos' ? (
                <g>
                    <ResV id="RGS_IN" x={185} y={345} value={config.gatePull} label="RGS(in)" {...common} />
                    <Wire d="M185 292V305M185 385H249" />
                </g>
            ) : null}
            <text className="minor-label" x="335" y="405">RG/Rdrive 및 pull 값은 현재 공용 설정값입니다.</text>
        </g>
    );
}

export default function CircuitDiagram({ config, point, selectedInstance, onSelectInstance }) {
    const template = circuitTemplate(config.topology);
    const loadOn = (point?.current ?? 0) > 1e-9;
    const stateText = config.deviceModels?.GPIO1
        ? `요청 ${config.state} · 유효 ${point?.effectiveGpioState ?? gpioState(config)}`
        : 'GPIO 미사용';
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
            <div className="schematic-scroll">
                <svg viewBox="0 0 720 430" role="img" aria-label={`${config.topology} 회로도`}>
                    <TopologyBody config={config} point={point} selected={selectedInstance} onSelect={onSelectInstance} />
                </svg>
            </div>
            <figcaption>{template?.connections.length ?? 0}개 연결 정의 · 소자를 클릭하거나 Enter로 상세 확인</figcaption>
        </figure>
    );
}
