import React from 'react';
import { TOPOLOGIES } from '../core/topologies.js';
import { LEDS } from '../data/catalog.js';
/** A labeled connection overview, not a pin-accurate PCB schematic. */
export default function CircuitDiagram({ config, point }) {
    const t = TOPOLOGIES.find(t => t.id === config.topology);
    const high = ['npn-follower', 'pnp-high', 'pmos-high', 'npn-pnp', 'npn-pmos', 'nmos-pmos'].includes(t.id);
    const direct = t.id.startsWith('gpio-'), plain = t.id === 'resistor';
    const transistor = t.id.includes('pmos') ? 'PMOS' : t.id === 'nmos-low' ? 'NMOS' : t.id.includes('pnp') ? 'PNP' : t.id === 'digital-npn' ? 'DTC043ZEB' : 'NPN';
    const lowDevice = !plain && !direct && !high;
    const controls = t.id === 'digital-npn' ? 'IN · 내장 R1/R2' : t.id.includes('mos') ? 'G · RG / RGS' : `B · RB ${config.baseResistance}Ω`;
    const yQ = high ? 85 : 245;
    const label = t.id === 'gpio-source' ? 'GPIO HIGH' : `VLED ${config.vcc}V`;
    const end = t.id === 'gpio-sink' ? 'GPIO LOW' : 'GND';
    return <figure className="circuit">
    <svg viewBox="0 0 380 365" role="img" aria-label={`${t.name} 연결 개요`}>
      <g stroke="currentColor" fill="none" strokeWidth="1.6">
        <path d="M200 38V320"/>
        <path d="M185 323H215M190 329H210M195 335H205"/>
        <rect x="190" y="133" width="20" height="32" rx="2" className="component-fill"/>
        <path d="M188 187H212L200 207Z" fill={LEDS[config.led].color}/><path d="M186 208H214M216 187L231 172M221 198L236 183"/>
        {(high || lowDevice) && <><rect x="172" y={yQ - 22} width="56" height="44" rx="8" className="component-fill"/>
          <path d={`M172 ${yQ}H45`}/><circle cx="45" cy={yQ} r="3"/>
        </>}
        {t.id === 'npn-current-sink' && <rect x="190" y="283" width="20" height="23" rx="2" className="component-fill"/>}
      </g>
      <g fill="currentColor" fontSize="12" fontFamily="ui-monospace,monospace">
        <text x="200" y="24" textAnchor="middle">{label}</text>
        <text x="225" y="154">RLED {point?.config.resistance?.toPrecision(4) ?? config.resistance} Ω</text>
        <text x="224" y="216">LED × {config.seriesCount}</text>
        <text x="200" y="355" textAnchor="middle">{end}</text>
        {(high || lowDevice) && <>
          <text x="200" y={yQ + 4} textAnchor="middle" fontSize={transistor.length > 6 ? 9 : 12}>{transistor}</text>
          <text x="18" y={yQ - 27} fontSize="10">{t.id.startsWith('npn-') && t.id.includes('pmos') || t.id === 'npn-pnp' ? 'GPIO → NPN' : t.id === 'nmos-pmos' ? 'GPIO → NMOS' : 'GPIO'}</text>
          <text x="18" y={yQ - 12} fontSize="9">{controls}</text>
          <text x="236" y={yQ - 5} fontSize="10">{high ? (t.id === 'npn-follower' ? 'C → E' : 'S/E → D/C') : 'C/D → E/S'}</text>
        </>}
        {t.id === 'npn-current-sink' && <text x="226" y="299">RE {config.emitterResistance} Ω</text>}
      </g>
    </svg>
    <figcaption>{t.path}<span>연결 개요입니다. 보조 저항·전류 경로의 정확한 정의는 아래 회로 조건을 참고하세요.</span></figcaption>
  </figure>;
}
