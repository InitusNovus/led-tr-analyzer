import React, { useState, useMemo } from 'react';

import { AlertCircle, Zap, Cpu, CheckCircle2, Info, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';



// --- 부품 데이터베이스 ---

const RESISTOR_PACKAGES = {

  '0402': { name: '0402 (1005)', powerLimit: 62.5 }, // 1/16W

  '0603': { name: '0603 (1608)', powerLimit: 100 },  // 1/10W

  '0805': { name: '0805 (2012)', powerLimit: 125 },  // 1/8W

  '1206': { name: '1206 (3216)', powerLimit: 250 },  // 1/4W

};



// 정렬된 패키지 키 배열 (작은 것부터 큰 순서)

const PACKAGE_ORDER = ['0402', '0603', '0805', '1206'];



const TRANSISTORS = {

  'DTC043ZEB': {

    name: 'DTC043ZEB',

    // Datasheet: https://fscdn.rohm.com/en/products/databook/datasheet/discrete/transistor/digital/dtc043zebtl-e.pdf

    type: 'Digital NPN',

    r1: 4.7, // kOhm (Base series resistor)

    r2: 47,  // kOhm (Base-Emitter resistor)

    vce0: 0.02, // Offset voltage (V)

    rce: 5.0,   // Dynamic resistance (Ohm)

    maxIc: 100  // mA

  }

};



const LEDS = {

  // Datasheet: https://www.lcsc.com/datasheet/C2295.pdf

  'KT-0805R': { name: 'KT-0805R (Red)', color: '#ff0000', vfMin: 1.8, vfTyp: 2.0, vfMax: 2.4, vfTh: 1.8, iMax: 30, iTyp: 20, mcdTyp: 120 },

  // Datasheet: https://www.lcsc.com/datasheet/C2297.pdf

  'KT-0805G': { name: 'KT-0805G (Green)', color: '#00ff00', vfMin: 2.8, vfTyp: 3.2, vfMax: 3.4, vfTh: 2.7, iMax: 30, iTyp: 20, mcdTyp: 450 }, 

  // Datasheet: https://www.lcsc.com/datasheet/C2293.pdf

  'KT-0805B': { name: 'KT-0805B (Blue)', color: '#0000ff', vfMin: 2.8, vfTyp: 3.1, vfMax: 3.4, vfTh: 2.7, iMax: 30, iTyp: 20, mcdTyp: 150 },

  // Datasheet: https://www.lcsc.com/datasheet/C2292.pdf

  'KT-0805YG': { name: 'KT-0805YG (Y-Green)', color: '#adff2f', vfMin: 1.9, vfTyp: 2.1, vfMax: 2.4, vfTh: 1.9, iMax: 30, iTyp: 20, mcdTyp: 45 },

  // Datasheet: https://www.lcsc.com/datasheet/C2296.pdf

  'KT-0805Y': { name: 'KT-0805Y (Yellow)', color: '#ffff00', vfMin: 1.8, vfTyp: 2.0, vfMax: 2.4, vfTh: 1.8, iMax: 30, iTyp: 20, mcdTyp: 140 },

  // Datasheet: https://www.lcsc.com/datasheet/C110371.pdf

  'KT-0805O': { name: 'KT-0805O (Orange)', color: '#ffa500', vfMin: 1.8, vfTyp: 2.0, vfMax: 2.4, vfTh: 1.8, iMax: 30, iTyp: 20, mcdTyp: 150 },

  // Datasheet: https://www.lcsc.com/datasheet/C34499.pdf

  'KT-0805W': { name: 'KT-0805W (White)', color: '#ffffff', vfMin: 2.8, vfTyp: 3.1, vfMax: 3.4, vfTh: 2.7, iMax: 30, iTyp: 20, mcdTyp: 550 },

};



// --- E-Series 표준 저항값 ---

const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];

const E96 = [

  1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.30, 1.33, 1.37, 1.40, 1.43, 1.47, 1.50, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,

  1.78, 1.82, 1.87, 1.91, 1.96, 2.00, 2.05, 2.10, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.80, 2.87, 2.94, 3.01, 3.09,

  3.16, 3.24, 3.32, 3.40, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49,

  5.62, 5.76, 5.90, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.50, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76

];

// E24와 E96을 합친 후 중복 제거 및 정렬

const E24_E96 = Array.from(new Set([...E24, ...E96])).sort((a, b) => a - b);



// 표준 저항 찾기 알고리즘

function findStandardResistor(targetR, series, strategy) {

  if (targetR <= 0) return 0;



  let values;

  if (series === 'E24') values = E24;

  else if (series === 'E96') values = E96;

  else values = E24_E96;



  const magnitude = Math.pow(10, Math.floor(Math.log10(targetR)));

  const normalizedR = targetR / magnitude;



  let closest = values[0];

  let minDiff = Infinity;

  let lower = values[0];

  let higher = Infinity; // 버그 수정: Infinity로 시작하여 정확히 일치할 때 끝값으로 밀리는 현상 방지



  for (let i = 0; i < values.length; i++) {

    const val = values[i];

    const diff = Math.abs(val - normalizedR);

    if (diff < minDiff) {

      minDiff = diff;

      closest = val;

    }

    if (val <= normalizedR) lower = val;

    if (val >= normalizedR && val < higher) higher = val; // 최소 higher 갱신

  }



  if (!Number.isFinite(higher)) higher = values[0] * 10; 



  let selectedNormalized;

  if (strategy === 'closest') selectedNormalized = closest;

  else if (strategy === 'safe') selectedNormalized = higher; 

  else if (strategy === 'bright') selectedNormalized = lower; 



  return Math.round((selectedNormalized * magnitude) * 100) / 100;

}



// 일관된 전류 계산 헬퍼

const clamp0 = (x) => (Number.isFinite(x) && x > 0 ? x : 0);

const calcI_A = (vcc, r, vfTh, rd, vce0, rce) => {

  const denom = r + rd + rce;

  const numer = vcc - vfTh - vce0;

  return (denom > 0 && numer > 0) ? (numer / denom) : 0;

};



// TR 베이스 전류 계산 헬퍼

const calcIb_A = (vin, r1, r2, vbe) => {

  if (vin <= vbe) return 0;

  const iR1 = (vin - vbe) / r1;

  const iR2 = vbe / r2;

  return Math.max(0, iR1 - iR2);

};





export default function App() {

  const [mode, setMode] = useState('calcR'); 



  // 회로 파라미터 상태

  const [vcc, setVcc] = useState(5.0);

  const [indVoltage, setIndVoltage] = useState(3.3);

  const [ledId, setLedId] = useState('KT-0805R');

  const [trId, setTrId] = useState('DTC043ZEB');

  const [pkgSize, setPkgSize] = useState('0805');



  // 입력 상태

  const [targetI, setTargetI] = useState(10); 

  const [targetMcd, setTargetMcd] = useState(60); 

  const [targetType, setTargetType] = useState('current'); 

  const [inputR, setInputR] = useState(150); 



  // UI 상태

  const [showLedInfo, setShowLedInfo] = useState(false);

  const [showTrInfo, setShowTrInfo] = useState(false);

  const [showMcdInfo, setShowMcdInfo] = useState(false); 

  const [showAdvancedQPoint, setShowAdvancedQPoint] = useState(false); // 상세 검증 패널 상태

  const [showBetaInfo, setShowBetaInfo] = useState(false);



  // 계산 옵션

  const [eSeries, setESeries] = useState('E24+E96');

  const [strategy, setStrategy] = useState('closest');

  const [resTol, setResTol] = useState(1); // 기본 1% (E24+E96 기본)



  const led = LEDS[ledId];

  const tr = TRANSISTORS[trId];



  // E-Series 변경 시 호환되는 저항 오차율(Tolerance)로 자동 조정

  const handleSeriesChange = (series) => {

    setESeries(series);

    if (series === 'E24') {

      if (![5, 2, 1].includes(resTol)) setResTol(5); // E24는 보통 5% J급 기본

    } else {

      if (![1, 0.1].includes(resTol)) setResTol(1);  // E96/하이브리드는 1% F급 기본

    }

  };



  // LED 동적 저항 모델링: Rd = (Vf_typ - Vf_th) / I_typ

  const ledRd = (led.vfTyp - led.vfTh) / (led.iTyp / 1000); 



  // 입력값 안전 변환 헬퍼 (빈칸일때 0 처리)

  const safeNum = (val, fallback = 0) => (val === '' || isNaN(Number(val))) ? fallback : Number(val);



  // 핵심 계산 로직

  const calcResult = useMemo(() => {

    const sVcc = safeNum(vcc);

    const sIndVoltage = safeNum(indVoltage);

    let exactR = 0;

    let stdR = 0;

    let actualI_A = 0; 

    let effectiveTargetI_mA = 0;

    let warnings = [];

    let softWarnings = [];



    if (mode === 'calcR') {

      effectiveTargetI_mA = safeNum(targetI);

      if (targetType === 'brightness') {

        effectiveTargetI_mA = (safeNum(targetMcd) / led.mcdTyp) * led.iTyp;

      }



      const targetI_A = effectiveTargetI_mA / 1000;

      exactR = (sVcc - led.vfTh - tr.vce0) / targetI_A - ledRd - tr.rce;



      if (exactR <= 0) {

        warnings.push(`목표 조건을 달성할 수 없습니다. Vcc가 너무 낮거나 목표값이 너무 높습니다.`);

        exactR = 0; stdR = 0; actualI_A = 0;

      } else {

        stdR = findStandardResistor(exactR, eSeries, strategy);

        actualI_A = calcI_A(sVcc, stdR, led.vfTh, ledRd, tr.vce0, tr.rce);

      }

    } else {

      stdR = safeNum(inputR);

      exactR = stdR;

      actualI_A = calcI_A(sVcc, stdR, led.vfTh, ledRd, tr.vce0, tr.rce);

    }



    const actualI_mA = actualI_A * 1000;

    const vF = led.vfTh + actualI_A * ledRd;

    const vCE = tr.vce0 + actualI_A * tr.rce;



    // --- (A) 디지털 TR 포화(Saturation) 정밀/범위 분석 ---

    const vbeTyp = 0.7;

    const vbeMin = 0.65; // Vbe가 낮을 때 -> Ib 큼 -> 베타 유리

    const vbeMax = 0.85; // Vbe가 높을 때 -> Ib 작음 -> 베타 불리 (Worst Case)



    const r1_ohm = tr.r1 * 1000;

    const r2_ohm = tr.r2 * 1000;



    const ibTyp_A = calcIb_A(sIndVoltage, r1_ohm, r2_ohm, vbeTyp);

    const ibMin_A = calcIb_A(sIndVoltage, r1_ohm, r2_ohm, vbeMax); // Worst case base current

    const ibMax_A = calcIb_A(sIndVoltage, r1_ohm, r2_ohm, vbeMin);



    const icForBeta_A = (mode === 'calcR' && effectiveTargetI_mA > 0) ? (effectiveTargetI_mA / 1000) : actualI_A;



    const forcedBetaTyp = ibTyp_A > 0 ? icForBeta_A / ibTyp_A : Infinity;

    const forcedBetaMax = ibMin_A > 0 ? icForBeta_A / ibMin_A : Infinity; // Worst case Beta

    const forcedBetaMin = ibMax_A > 0 ? icForBeta_A / ibMax_A : Infinity;



    if (ibMin_A <= 0) {

      warnings.push(`IND 전압(${sIndVoltage}V) 환경에서 Vbe 변동(최대 0.85V) 시 TR 베이스 전류가 차단되어 켜지지 않을 위험이 있습니다.`);

    } else if (forcedBetaMax > 20) {

      warnings.push(`[TR 포화 실패 위험] 온도/부품 편차 시 강제 베타(β)가 최대 ${forcedBetaMax.toFixed(1)}까지 치솟습니다(권장 20 이하). 스위치가 완전히 도통되지 않아 예측보다 LED가 어두울 수 있습니다.`);

    } else if (forcedBetaMax > 10) {

      softWarnings.push(`강제 베타(β) 최대 예측치가 ${forcedBetaMax.toFixed(1)}로 포화 경계선에 있습니다. 안정적인 구동을 위해 10 이하를 권장합니다.`);

    }



    // --- (B) Worst-Case Tolerance (오차율) 분석 ---

    const vccTol = 5; // Vcc는 일반적인 레귤레이터 오차 5%로 고정 가정

    const vccMax = sVcc * (1 + vccTol / 100);

    const vccMin = sVcc * (1 - vccTol / 100);

    const rMax = stdR * (1 + resTol / 100);

    const rMin = stdR * (1 - resTol / 100);



    const dvUp = led.vfMax - led.vfTyp;

    const dvDown = led.vfTyp - led.vfMin;

    const vfThMax = led.vfTh + dvUp;

    // 모델링 과낙관 방지 클램프: vfThMin이 데이터시트의 vfMin보다 더 낮아지지 않도록 제한

    const vfThMin_raw = led.vfTh - dvDown;

    const vfThMin = Math.max(0, Math.min(led.vfMin, vfThMin_raw)); 



    const iMax_A = calcI_A(vccMax, rMin, vfThMin, ledRd, tr.vce0, tr.rce);

    const iMin_A = calcI_A(vccMin, rMax, vfThMax, ledRd, tr.vce0, tr.rce);



    const iMax_mA = clamp0(iMax_A * 1000);

    const iMin_mA = clamp0(iMin_A * 1000);



    // --- (C) 저항 소비 전력 Worst-Case 분석 및 패키지 추천 ---

    const pR_typ_mW = actualI_A * actualI_A * stdR * 1000;

    const pR_wc_mW = iMax_A * iMax_A * rMax * 1000; 

    const pR = Math.max(pR_typ_mW, pR_wc_mW); 



    // 패키지 추천 로직 (70% 디레이팅 기준)

    let recommendedPkg = '1206 (초과)';

    for (const k of PACKAGE_ORDER) {

      if (pR <= RESISTOR_PACKAGES[k].powerLimit * 0.7) {

        recommendedPkg = k;

        break;

      }

    }



    // 밝기 산출 (Typ, Min, Max)

    let brightnessPercent = clamp0((actualI_mA / led.iTyp) * 100);

    let actualMcd = clamp0((actualI_mA / led.iTyp) * led.mcdTyp);

    let mcdMin = clamp0((iMin_mA / led.iTyp) * led.mcdTyp);

    let mcdMax = clamp0((iMax_mA / led.iTyp) * led.mcdTyp);



    // --- 기본 한계 경고 ---

    if (iMax_mA > led.iMax) {

      warnings.push(`최대 허용 전류(${led.iMax}mA) 초과 위험! Vcc/저항/Vf 편차가 겹칠 시 최대 ${iMax_mA.toFixed(1)}mA까지 흐를 수 있습니다.`);

    } else if (iMax_mA > led.iTyp * 1.2) {

      softWarnings.push(`부품 편차에 따라 LED 권장 전류를 초과(최대 ${iMax_mA.toFixed(1)}mA)하여 장기 수명이 단축될 가능성이 있습니다.`);

    }



    const currentPkg = RESISTOR_PACKAGES[pkgSize];

    if (pR > currentPkg.powerLimit) {

      warnings.push(`저항 소비 전력(Worst-Case: ${pR.toFixed(1)}mW)이 ${pkgSize} 패키지 한계치(${currentPkg.powerLimit}mW)를 초과합니다! 화재/소손 위험. 최소 ${recommendedPkg} 이상 패키지로 변경하세요.`);

    } else if (pR > currentPkg.powerLimit * 0.7) {

      softWarnings.push(`저항 전력 마진이 부족합니다(Worst-Case 발열이 한계의 70% 초과). 밀폐/고온 환경 시 디레이팅(Derating)을 위해 최소 ${recommendedPkg} 이상 패키지를 권장합니다.`);

    }



    if (sVcc < led.vfTh + tr.vce0) {

      warnings.push(`Vcc 전압이 LED와 TR을 켜기에 물리적으로 충분하지 않습니다.`);

    }



    return {

      exactR, stdR, actualI_mA, iMin_mA, iMax_mA, vF, vCE, pR, brightnessPercent, actualMcd, mcdMin, mcdMax,

      forcedBetaTyp, forcedBetaMin, forcedBetaMax, ibTyp_mA: ibTyp_A * 1000, ibMin_mA: ibMin_A * 1000, ibMax_mA: ibMax_A * 1000, 

      vfThMin, vfThMax, vccMin, vccMax, rMin, rMax, warnings, softWarnings

    };

  }, [mode, vcc, indVoltage, led, tr, targetI, targetMcd, targetType, inputR, eSeries, strategy, ledRd, pkgSize, resTol]);





  // 회로도 렌더링 헬퍼

  const CircuitDiagram = () => {

    const glowOpacity = Math.min(Math.max(calcResult.actualI_mA / led.iTyp, 0.1), 1);

    const ledColor = led.color === '#ffffff' ? '#e0e0e0' : led.color;



    return (

      <div className="bg-slate-900 p-8 rounded-xl flex items-center justify-center min-h-[400px] border border-slate-700 shadow-inner relative overflow-hidden">

        <svg width="240" height="380" viewBox="0 0 240 380" className="drop-shadow-lg">

          {/* VCC */}

          <text x="120" y="30" fill="#38bdf8" textAnchor="middle" className="font-mono font-bold">{vcc}V</text>

          <path d="M 120 40 L 120 60" stroke="#38bdf8" strokeWidth="2" />

          <path d="M 110 50 L 120 40 L 130 50" stroke="#38bdf8" strokeWidth="2" fill="none" />



          {/* Resistor */}

          <path d="M 120 60 L 120 90" stroke="#94a3b8" strokeWidth="2" />

          <rect x="110" y="90" width="20" height="40" fill="#cbd5e1" stroke="#475569" strokeWidth="2" rx="2" />

          <path d="M 120 130 L 120 160" stroke="#94a3b8" strokeWidth="2" />

          <text x="140" y="115" fill="#f8fafc" className="font-mono text-sm font-bold">{calcResult.stdR > 1000 ? (calcResult.stdR/1000).toFixed(1)+'k' : calcResult.stdR}Ω</text>



          {/* LED Glow Effect */}

          {calcResult.actualI_mA > 0.5 && (

            <circle cx="120" cy="180" r="24" fill={led.color} opacity={glowOpacity * 0.4} style={{ filter: 'blur(8px)' }} />

          )}



          {/* LED */}

          <path d="M 105 170 L 135 170 L 120 190 Z" fill={ledColor} stroke="#cbd5e1" strokeWidth="2" />

          <path d="M 105 190 L 135 190" stroke="#cbd5e1" strokeWidth="2" />

          <path d="M 140 165 L 155 150 M 145 175 L 160 160" stroke={ledColor} strokeWidth="2" fill="none" opacity={glowOpacity} />

          <path d="M 155 150 L 145 150 L 155 160 Z" fill={ledColor} opacity={glowOpacity} />

          <path d="M 160 160 L 150 160 L 160 170 Z" fill={ledColor} opacity={glowOpacity} />



          <path d="M 120 190 L 120 240" stroke="#94a3b8" strokeWidth="2" />

          <text x="140" y="185" fill="#f8fafc" className="font-mono text-sm">{ledId}</text>



          {/* Transistor (NPN) */}

          <circle cx="120" cy="270" r="25" fill="none" stroke="#cbd5e1" strokeWidth="2" />

          <path d="M 120 240 L 120 255" stroke="#94a3b8" strokeWidth="2" /> {/* C */}

          <path d="M 120 285 L 120 310" stroke="#94a3b8" strokeWidth="2" /> {/* E */}

          <path d="M 90 270 L 110 270" stroke="#94a3b8" strokeWidth="2" /> {/* B */}



          <path d="M 110 255 L 110 285" stroke="#cbd5e1" strokeWidth="3" /> {/* Base line */}

          <path d="M 110 262 L 120 255" stroke="#cbd5e1" strokeWidth="2" /> {/* C to Base */}

          <path d="M 110 278 L 120 285" stroke="#cbd5e1" strokeWidth="2" /> {/* E to Base */}



          {/* Emitter Arrow */}

          <path d="M 115 285 L 120 285 L 118 279 Z" fill="#cbd5e1" />



          <text x="150" y="265" fill="#f8fafc" className="font-mono text-sm">{trId}</text>

          {tr.r1 && tr.r2 && (

            <text x="150" y="280" fill="#94a3b8" className="font-mono text-[10px]">

              R1:{tr.r1}k / R2:{tr.r2}k

            </text>

          )}



          {/* IND input */}

          <path d="M 50 270 L 90 270" stroke="#94a3b8" strokeWidth="2" />

          <circle cx="50" cy="270" r="3" fill="#38bdf8" />

          <text x="45" y="265" fill="#38bdf8" textAnchor="end" className="font-mono text-xs">IND ({indVoltage}V)</text>



          {/* GND */}

          <path d="M 120 310 L 120 330" stroke="#94a3b8" strokeWidth="2" />

          <path d="M 105 330 L 135 330" stroke="#94a3b8" strokeWidth="2" />

          <path d="M 112 338 L 128 338" stroke="#94a3b8" strokeWidth="2" />

          <path d="M 118 346 L 122 346" stroke="#94a3b8" strokeWidth="2" />

          <text x="120" y="365" fill="#94a3b8" textAnchor="middle" className="font-mono font-bold">GND</text>

        </svg>



        {calcResult.actualI_mA > 0 && (

           <div className="absolute right-4 top-4 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-600 flex items-center gap-2">

             <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: led.color }}></div>

             <span className="text-slate-300 font-mono text-sm">{calcResult.actualI_mA.toFixed(1)} mA</span>

           </div>

        )}

      </div>

    );

  };



  return (

    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">

      <div className="max-w-5xl mx-auto">



        <header className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-4">

          <div className="p-3 bg-blue-600 rounded-lg text-white">

            <Zap size={28} />

          </div>

          <div>

            <h1 className="text-2xl font-bold text-slate-900">LED-TR 회로 분석기 (Pro)</h1>

            <p className="text-sm text-slate-500">포화 마진, Worst-Case 공차, 디레이팅을 고려한 실무용 계산기</p>

          </div>

        </header>



        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">



          {/* Left Column: Diagram & Settings */}

          <div className="lg:col-span-5 space-y-6">

            <CircuitDiagram />



            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

              <h3 className="text-md font-semibold mb-4 flex items-center gap-2">

                <Cpu size={18} className="text-slate-500" />

                부품 및 환경 설정

              </h3>



              <div className="space-y-4">

                <div className="grid grid-cols-3 gap-3">

                  <div>

                    <label className="block text-xs font-medium text-slate-600 mb-1">VCC 전압 (V)</label>

                    <input 

                      type="number" step="0.1" 

                      value={vcc} onChange={(e) => setVcc(e.target.value)}

                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"

                    />

                  </div>

                  <div>

                    <label className="block text-xs font-medium text-slate-600 mb-1">IND(제어) 전압</label>

                    <input 

                      type="number" step="0.1" 

                      value={indVoltage} onChange={(e) => setIndVoltage(e.target.value)}

                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"

                    />

                  </div>

                  <div>

                    <label className="block text-xs font-medium text-slate-600 mb-1">저항 패키지</label>

                    <select 

                      value={pkgSize} onChange={(e) => setPkgSize(e.target.value)}

                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"

                    >

                      {PACKAGE_ORDER.map(key => (

                        <option key={key} value={key}>{RESISTOR_PACKAGES[key].name}</option>

                      ))}

                    </select>

                  </div>

                </div>



                <div className="grid grid-cols-2 gap-3">

                  <div>

                    <label className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1">

                      <span>LED 스펙</span>

                      <button onClick={() => setShowLedInfo(!showLedInfo)} className="text-slate-400 hover:text-blue-500 transition-colors">

                        <Info size={14} />

                      </button>

                    </label>

                    <select 

                      value={ledId} onChange={(e) => setLedId(e.target.value)}

                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"

                    >

                      {Object.keys(LEDS).map(key => (

                        <option key={key} value={key}>{LEDS[key].name}</option>

                      ))}

                    </select>

                    {showLedInfo && (

                      <div className="mt-2 p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600 font-mono space-y-1 shadow-inner">

                        <div className="flex justify-between"><span>Vf(typ):</span> <span>{led.vfTyp}V @ {led.iTyp}mA</span></div>

                        <div className="flex justify-between"><span>Vf(th):</span> <span className="text-slate-400">{led.vfTh}V (모델링)</span></div>

                        <div className="flex justify-between"><span>I(max):</span> <span>{led.iMax}mA</span></div>

                        <div className="flex justify-between"><span>Luminous:</span> <span>{led.mcdTyp}mcd @ {led.iTyp}mA</span></div>

                      </div>

                    )}

                  </div>

                  <div>

                    <label className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1">

                      <span>TR 스펙</span>

                      <button onClick={() => setShowTrInfo(!showTrInfo)} className="text-slate-400 hover:text-blue-500 transition-colors">

                        <Info size={14} />

                      </button>

                    </label>

                    <select 

                      value={trId} onChange={(e) => setTrId(e.target.value)}

                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"

                    >

                      {Object.keys(TRANSISTORS).map(key => (

                        <option key={key} value={key}>{TRANSISTORS[key].name}</option>

                      ))}

                    </select>

                    {showTrInfo && (

                      <div className="mt-2 p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-600 font-mono space-y-1 shadow-inner">

                        <div className="flex justify-between"><span>R1 / R2:</span> <span>{tr.r1}kΩ / {tr.r2}kΩ</span></div>

                        <div className="flex justify-between"><span>Vce(offset):</span> <span className="text-slate-400">{tr.vce0}V</span></div>

                        <div className="flex justify-between"><span>Rce(동적):</span> <span className="text-slate-400">{tr.rce}Ω</span></div>

                        <div className="flex justify-between"><span>Ic(max):</span> <span>{tr.maxIc}mA</span></div>

                      </div>

                    )}

                  </div>

                </div>

              </div>

            </div>

          </div>



          {/* Right Column: Calculator */}

          <div className="lg:col-span-7 space-y-6">



            {/* Tab Navigation */}

            <div className="flex bg-slate-200/50 p-1 rounded-lg">

              <button 

                onClick={() => setMode('calcR')}

                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'calcR' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}

              >

                타겟 전류/밝기로 저항 역산

              </button>

              <button 

                onClick={() => setMode('calcI')}

                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'calcI' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}

              >

                현재 저항으로 상태 검증

              </button>

            </div>



            {/* Input Panel */}

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">

              {mode === 'calcR' ? (

                <div className="space-y-6">

                  <div>

                    <div className="flex justify-between items-end mb-2">

                      <label className="block text-sm font-medium text-slate-700">목표값 설정</label>
                      <div className="flex bg-slate-100 p-0.5 rounded-md">

                        <button 

                          onClick={() => setTargetType('current')}

                          className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${targetType === 'current' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}

                        >전류 (mA)</button>

                        <button 

                          onClick={() => setTargetType('brightness')}

                          className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${targetType === 'brightness' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}

                        >밝기 (mcd)</button>

                      </div>

                    </div>



                    {targetType === 'current' ? (

                      <div className="flex items-center gap-4">

                        <input 

                          type="range" min="1" max="30" step="0.5"

                          value={targetI} onChange={(e) => setTargetI(e.target.value)}

                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"

                        />

                        <div className="flex items-center gap-2">

                          <input 

                            type="number" step="0.5"

                            value={targetI} onChange={(e) => setTargetI(e.target.value)}

                            className="w-20 text-center bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 font-mono text-sm"

                          />

                          <span className="text-slate-500 font-medium text-sm w-8">mA</span>

                        </div>

                      </div>

                    ) : (

                      <div className="flex items-center gap-4">

                        <input 

                          type="range" min="10" max={led.mcdTyp * 1.5} step="10"

                          value={targetMcd} onChange={(e) => setTargetMcd(e.target.value)}

                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"

                        />

                        <div className="flex items-center gap-2">

                          <input 

                            type="number" step="10"

                            value={targetMcd} onChange={(e) => setTargetMcd(e.target.value)}

                            className="w-20 text-center bg-slate-50 border border-slate-300 rounded-md px-2 py-1.5 font-mono text-sm"

                          />

                          <span className="text-slate-500 font-medium text-sm w-8">mcd</span>

                        </div>

                      </div>

                    )}

                  </div>



                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">

                    <div className="space-y-4">

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">표준 저항 계열</label>

                        <div className="flex flex-wrap gap-x-4 gap-y-2">

                          <label className="flex items-center gap-2 text-sm cursor-pointer">

                            <input type="radio" checked={eSeries==='E24'} onChange={()=>handleSeriesChange('E24')} className="text-blue-600" /> E24

                          </label>

                          <label className="flex items-center gap-2 text-sm cursor-pointer">

                            <input type="radio" checked={eSeries==='E96'} onChange={()=>handleSeriesChange('E96')} className="text-blue-600" /> E96

                          </label>

                          <label className="flex items-center gap-2 text-sm cursor-pointer">

                            <input type="radio" checked={eSeries==='E24+E96'} onChange={()=>handleSeriesChange('E24+E96')} className="text-blue-600" /> E24+E96

                          </label>

                        </div>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">저항 정밀도 (Tolerance)</label>

                        <div className="flex flex-wrap gap-x-3 gap-y-2">

                          {eSeries === 'E24' ? (

                            <>

                              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={resTol===5} onChange={()=>setResTol(5)} className="text-blue-600"/> ±5%(J)</label>

                              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={resTol===2} onChange={()=>setResTol(2)} className="text-blue-600"/> ±2%(G)</label>

                              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={resTol===1} onChange={()=>setResTol(1)} className="text-blue-600"/> ±1%(F)</label>

                            </>

                          ) : (

                            <>

                              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={resTol===1} onChange={()=>setResTol(1)} className="text-blue-600"/> ±1%(F)</label>

                              <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" checked={resTol===0.1} onChange={()=>setResTol(0.1)} className="text-blue-600"/> ±0.1%(B)</label>

                            </>

                          )}

                        </div>

                      </div>

                    </div>

                    <div>

                      <label className="block text-sm font-medium text-slate-700 mb-2">매칭 전략</label>

                      <select 

                        value={strategy} onChange={(e)=>setStrategy(e.target.value)}

                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none"

                      >

                        <option value="closest">가장 가까운 값 (정밀)</option>

                        <option value="safe">안전 우선 (높은 저항)</option>

                        <option value="bright">밝기 우선 (낮은 저항)</option>

                      </select>

                    </div>

                  </div>

                </div>

              ) : (

                <div className="space-y-6">

                  <div className="grid grid-cols-2 gap-4">

                    <div>

                      <label className="block text-sm font-medium text-slate-700 mb-2">테스트할 저항 값 (Ω)</label>

                      <div className="flex items-center gap-3">

                        <input 

                          type="number"

                          value={inputR} onChange={(e) => setInputR(e.target.value)}

                          className="flex-1 text-lg bg-slate-50 border border-slate-300 rounded-md px-4 py-2 font-mono outline-none focus:border-blue-500"

                          placeholder="예: 330"

                        />

                        <span className="text-slate-500 font-semibold text-lg">Ohm</span>

                      </div>

                    </div>

                    <div>

                      <label className="block text-sm font-medium text-slate-700 mb-2">저항 정밀도</label>

                      <select 

                        value={resTol} onChange={(e)=>setResTol(Number(e.target.value))}

                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm outline-none"

                      >

                        <option value={5}>±5% (J급)</option>

                        <option value={2}>±2% (G급)</option>

                        <option value={1}>±1% (F급)</option>

                        <option value={0.1}>±0.1% (B급)</option>

                      </select>

                    </div>

                  </div>

                </div>

              )}

            </div>



            {/* Warnings Display */}

            {(calcResult.warnings.length > 0 || calcResult.softWarnings.length > 0) && (

              <div className="space-y-2">

                {calcResult.warnings.map((warn, idx) => (

                  <div key={`w-${idx}`} className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2 text-rose-700 text-sm font-medium shadow-sm leading-relaxed">

                    <AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{warn}</span>

                  </div>

                ))}

                {calcResult.softWarnings.map((warn, idx) => (

                  <div key={`s-${idx}`} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-amber-700 text-sm shadow-sm leading-relaxed">

                    <AlertTriangle size={18} className="mt-0.5 shrink-0" /> <span>{warn}</span>

                  </div>

                ))}

              </div>

            )}



            {/* Results Panel */}

            <div className="bg-slate-900 rounded-xl border border-slate-800 text-slate-200 overflow-hidden shadow-xl">

              <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">

                <h3 className="font-semibold text-slate-100 flex items-center gap-2">

                  <TrendingUp size={18} className="text-blue-400" /> 실무 검증 리포트

                </h3>

                {calcResult.actualI_mA > 0 && calcResult.warnings.length === 0 && (

                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">

                    <CheckCircle2 size={14} /> 안전 설계

                  </span>

                )}

              </div>



              <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-6">

                {mode === 'calcR' && (

                  <div className="col-span-2 flex items-end justify-between gap-4 pb-4 border-b border-slate-800">

                    <div>

                      <div className="text-slate-400 text-sm mb-1">선택된 표준 저항</div>

                      <div className="text-4xl font-mono text-blue-400 font-bold tracking-tight">

                        {calcResult.stdR} <span className="text-2xl text-slate-500">Ω</span>

                      </div>

                    </div>

                    <div className="text-right">

                      <div className="text-xs text-slate-400 mb-1">이론상 필요 저항</div>

                      <div className="text-lg font-mono text-slate-300">{calcResult.exactR.toFixed(1)} Ω</div>

                    </div>

                  </div>

                )}



                <div>

                  <div className="text-slate-300 text-sm mb-1 flex items-center gap-2">

                    정격(Typ) 전류 

                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-medium tracking-wide">Vcc ±5%, R ±{resTol}%</span>

                  </div>

                  <div className={`text-2xl font-mono font-semibold mb-1 ${calcResult.actualI_mA > led.iTyp ? 'text-amber-400' : 'text-slate-100'}`}>

                    {calcResult.actualI_mA.toFixed(2)} mA

                  </div>

                  {/* 오차율 Min/Max 분석 */}

                  {calcResult.actualI_mA > 0 && (

                    <div className="text-sm font-mono flex items-center gap-2 mt-1">

                      <span className="text-slate-400">Min: {calcResult.iMin_mA.toFixed(1)}</span>

                      <span className="text-slate-500">-</span>

                      <span className={calcResult.iMax_mA > led.iMax ? 'text-rose-400 font-bold' : 'text-slate-300'}>

                        Max: {calcResult.iMax_mA.toFixed(1)}

                      </span>

                    </div>

                  )}

                  <div className="text-xs text-slate-500 mt-1">

                    (LED 전류 오차 범위)

                  </div>

                </div>



                <div className="relative">

                  <div className="flex items-center gap-2 mb-1">

                    <div className="text-slate-300 text-sm font-medium">예상 체감 밝기</div>

                    <button onClick={() => setShowMcdInfo(!showMcdInfo)} className="text-slate-400 hover:text-amber-400 transition-colors">

                      <Info size={16} />

                    </button>

                  </div>

                  <div className="flex items-baseline gap-2">

                    <div className="text-2xl font-mono font-semibold text-slate-100">

                      {calcResult.actualMcd.toFixed(0)} <span className="text-base font-sans text-slate-400 font-normal">mcd</span>

                    </div>

                  </div>



                  {calcResult.actualI_mA > 0 && (

                    <div className="text-sm font-mono flex items-center gap-2 mt-1">

                      <span className="text-slate-400">Min: {calcResult.mcdMin.toFixed(0)}</span>

                      <span className="text-slate-500">-</span>

                      <span className="text-slate-300">

                        Max: {calcResult.mcdMax.toFixed(0)}

                      </span>

                    </div>

                  )}



                  {showMcdInfo && (

                    <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-slate-800 border border-slate-600 rounded-md text-sm text-slate-300 shadow-2xl z-10">

                      <div className="font-semibold text-amber-400 mb-2">💡 밝기(mcd) 실무 팁</div>

                      <ul className="list-disc pl-5 space-y-1 mb-3 text-slate-200">

                        <li><b>~10 mcd:</b> 어두운 실내, 눈부심 방지용</li>

                        <li><b>20-50 mcd:</b> 일반적인 기기 상태 표시등</li>

                        <li><b>100-200 mcd:</b> 밝은 실내용</li>

                      </ul>

                      <div className="text-slate-400 border-t border-slate-700 pt-2 text-xs leading-relaxed">

                        * 사람 눈은 밝기를 선형이 아닌 <b>로그(Log) 단위</b>로 인지합니다. 두 배 밝아 보이려면 전류를 2배가 아니라 거의 10배 늘려야 할 수도 있습니다. 

                      </div>

                    </div>

                  )}

                </div>



                <div className="col-span-2">

                  <div className="flex items-center justify-between mb-2">

                    <span className="text-slate-300 text-sm font-medium">소자별 전압 강하 (Q-Point) 및 포화 마진</span>

                    <button 

                      onClick={() => setShowAdvancedQPoint(!showAdvancedQPoint)} 

                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/30 px-2 py-1 rounded-md border border-blue-800/50"

                    >

                      <Info size={14} /> 상세 검증 패널 {showAdvancedQPoint ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}

                    </button>

                  </div>



                  <div className="bg-slate-950/80 rounded-lg p-3 grid grid-cols-4 gap-2 font-mono items-center border border-slate-800">

                    <div className="text-center">

                      <div className="text-slate-400 text-xs mb-1">Resistor (VR)</div>

                      <div className="text-emerald-400 text-base font-semibold">{(calcResult.actualI_mA/1000 * calcResult.stdR).toFixed(2)}V</div>

                    </div>

                    <div className="text-center border-l border-slate-800">

                      <div className="text-slate-400 text-xs mb-1">LED (Vf)</div>

                      <div className="text-rose-400 text-base font-semibold">{calcResult.vF.toFixed(2)}V</div>

                    </div>

                    <div className="text-center border-l border-slate-800">

                      <div className="text-slate-400 text-xs mb-1">TR (Vce)</div>

                      <div className="text-amber-400 text-base font-semibold">{calcResult.vCE.toFixed(2)}V</div>

                    </div>

                    <div className="text-center border-l border-slate-800 bg-slate-900 rounded pr-1 py-1 border border-slate-700/50 relative">

                      <div className="flex items-center justify-center gap-1 mb-1">

                        <div className="text-slate-400 text-xs" title="Forced Beta = Ic / Ib">TR 강제 β (Typ)</div>

                        <button onClick={() => setShowBetaInfo(!showBetaInfo)} className="text-slate-400 hover:text-amber-400 transition-colors">

                          <Info size={12} />

                        </button>

                      </div>

                      <div className={`text-base font-semibold leading-none ${calcResult.forcedBetaMax > 20 ? 'text-rose-400' : calcResult.forcedBetaMax > 10 ? 'text-amber-400' : 'text-blue-400'}`}>

                        {calcResult.forcedBetaTyp > 0 ? calcResult.forcedBetaTyp.toFixed(1) : 'OFF'}

                      </div>

                      <div className="text-[11px] text-slate-400 mt-1.5 font-medium">Ib: {calcResult.ibTyp_mA.toFixed(2)}mA</div>



                      {showBetaInfo && (

                        <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-md text-sm text-slate-300 shadow-2xl z-20 text-left font-sans">

                          <div className="font-semibold text-amber-400 mb-2">💡 강제 베타(Forced β)란?</div>

                          <div className="text-xs space-y-2 leading-relaxed text-slate-200">

                            <p>TR을 스위치로 완전히 켜기(Saturation) 위해 억지로 밀어넣는 전류 비율(<code className="bg-slate-700 px-1 rounded font-mono text-amber-200">Ic / Ib</code>)입니다.</p>

                            <p>일반적으로 이 값이 <b>10-20 이하</b>여야 TR이 완전히 열려(Vce 강하 최소화) 목표한 LED 밝기가 정상적으로 나옵니다.</p>

                            <p className="text-slate-400 border-t border-slate-700 pt-2">수치가 너무 높다면, 제어 전압(IND)을 높이거나 내부 저항(R1)이 작은 TR을 선택해야 합니다.</p>

                          </div>

                        </div>

                      )}

                    </div>

                  </div>



                  {/* 상세 물리 모델링 검증 패널 (인라인 확장형) */}

                  {showAdvancedQPoint && (

                    <div className="mt-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-xs space-y-4 shadow-inner">

                       <div className="font-semibold text-blue-300 border-b border-slate-700 pb-2">🔍 상세 물리 모델링 검증 (Worst-case 코너 분석)</div>

                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                         <div>

                           <div className="font-medium text-slate-200 mb-2">전원/저항 공차</div>

                           <ul className="space-y-1.5 text-slate-400 font-mono">

                             <li>Vcc 가정: <span className="text-slate-300">±5% ({calcResult.vccMin.toFixed(2)}V - {calcResult.vccMax.toFixed(2)}V)</span></li>

                             <li>Resistor: <span className="text-slate-300">±{resTol}%</span></li>

                             <li>R 범위: <span className="text-slate-300">{calcResult.rMin.toFixed(1)} - {calcResult.rMax.toFixed(1)} Ω</span></li>

                           </ul>

                         </div>

                         <div>

                           <div className="font-medium text-slate-200 mb-2">TR 베이스 구동 불확실성</div>

                           <ul className="space-y-1.5 text-slate-400 font-mono">

                             <li>Vbe 가정: <span className="text-slate-300">0.65V - 0.85V</span></li>

                             <li>Ib 범위: <span className="text-slate-300">{(calcResult.ibMin_mA).toFixed(3)} - {(calcResult.ibMax_mA).toFixed(3)} mA</span></li>

                             <li>β_forced (Typ): <span className="text-slate-300">{calcResult.forcedBetaTyp > 0 && calcResult.forcedBetaTyp !== Infinity ? calcResult.forcedBetaTyp.toFixed(1) : 'OFF'}</span></li>

                             <li>β_forced (Worst): <span className={calcResult.forcedBetaMax > 20 ? "text-rose-400 font-bold" : calcResult.forcedBetaMax > 10 ? "text-amber-400 font-bold" : "text-slate-300"}>{calcResult.forcedBetaMax > 0 && calcResult.forcedBetaMax !== Infinity ? calcResult.forcedBetaMax.toFixed(1) : 'OFF'}</span></li>

                           </ul>

                         </div>

                         <div>

                           <div className="font-medium text-slate-200 mb-2">LED 편차 (Datasheet)</div>

                           <ul className="space-y-1.5 text-slate-400 font-mono">

                             <li>Datasheet Vf: <span className="text-slate-300">{led.vfMin.toFixed(1)}V - {led.vfMax.toFixed(1)}V</span></li>

                             <li>동적 저항(Rd): <span className="text-slate-300">{ledRd.toFixed(1)} Ω</span></li>

                             <li>Vf_th (모델링): <span className="text-slate-300">{calcResult.vfThMin.toFixed(2)}V - {calcResult.vfThMax.toFixed(2)}V</span></li>

                           </ul>

                         </div>

                       </div>

                       <div className="text-slate-500 pt-2 border-t border-slate-700/50 leading-relaxed">

                         * 경고 시스템은 가장 보수적인 조건(Vbe=0.85V 시나리오의 최대 β, Vf/Vcc 공차가 겹친 최대 전류)을 기준으로 작동합니다.

                       </div>

                    </div>

                  )}

                </div>



                <div className="col-span-2">

                  <div className="flex justify-between items-center mb-2">

                    <span className="text-slate-300 text-sm font-medium">저항 소비 전력 (Worst-Case 분석)</span>

                    <span className={`font-mono text-base ${calcResult.pR > RESISTOR_PACKAGES[pkgSize].powerLimit ? 'text-rose-400 font-bold' : calcResult.pR > RESISTOR_PACKAGES[pkgSize].powerLimit * 0.7 ? 'text-amber-400 font-semibold' : 'text-slate-200 font-semibold'}`}>

                      {calcResult.pR.toFixed(1)} mW <span className="text-sm text-slate-500 font-normal">/ {RESISTOR_PACKAGES[pkgSize].powerLimit}mW</span>

                    </span>

                  </div>

                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex relative">

                     {/* 디레이팅 마진 70% 가이드라인 */}

                     <div className="absolute left-[70%] top-0 bottom-0 w-px bg-slate-400 z-10 shadow-sm"></div>

                    <div 

                      className={`h-full transition-all ${calcResult.pR > RESISTOR_PACKAGES[pkgSize].powerLimit ? 'bg-rose-500' : calcResult.pR > RESISTOR_PACKAGES[pkgSize].powerLimit * 0.7 ? 'bg-amber-500' : 'bg-blue-500'}`} 

                      style={{ width: `${Math.min((calcResult.pR / RESISTOR_PACKAGES[pkgSize].powerLimit) * 100, 100)}%` }}

                    ></div>

                  </div>

                  <div className="flex justify-between text-xs font-medium text-slate-400 mt-1.5">

                    <span>안전 구역 (0 - 70%)</span>

                    <span>디레이팅 고려 (70 - 100%)</span>

                  </div>

                </div>



              </div>

            </div>



          </div>

        </div>

      </div>

    </div>

  );

}