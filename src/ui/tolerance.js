/**
 * Resistor tolerance grades and the E-series context shown next to them. The series only decides which values exist;
 * the tolerance of the real part is a separate input, so nothing here ever changes it without the user pressing a button.
 */
export const TOLERANCE_GRADES = Object.freeze([
    { pct: 5, letter: 'J' }, { pct: 2, letter: 'G' }, { pct: 1, letter: 'F' }, { pct: 0.1, letter: 'B' },
]);
export const gradeOf = pct => TOLERANCE_GRADES.find(g => Number.isFinite(pct) && Math.abs(g.pct - pct) < 1e-9) ?? null;

/** Both directions of the same fact: the grade for a value, and the value for a grade. */
export function toleranceReadout(pct) {
    if (pct === '' || pct == null || !Number.isFinite(pct)) return { grade: null, text: '공차를 입력하면 등급을 표시합니다.' };
    const grade = gradeOf(pct);
    return { grade, text: grade ? `±${pct}% = ${grade.letter} 등급` : `±${pct}% — J/G/F/B 표준 등급과 다른 직접 입력값` };
}

export const SERIES_CONTEXT = Object.freeze({
    E24: { spacing: '값 간격 약 10%', typical: { pct: 5, letter: 'J' }, note: 'E24 저항은 J(±5%)와 F(±1%) 등급이 흔합니다.' },
    E96: { spacing: '값 간격 약 2.4%', typical: { pct: 1, letter: 'F' }, note: 'E96 저항은 보통 F(±1%) 이하 등급으로 나옵니다.' },
    'E24+E96': { spacing: '두 계열의 값을 모두 사용', typical: { pct: 1, letter: 'F' }, note: '두 계열을 섞으면 선정 값이 촘촘해지지만 공차는 부품마다 다릅니다.' },
});

/** What to tell the user about the chosen series, and the one tolerance it would offer to set (only on request). */
export function seriesAdvice(series, tolerancePct) {
    const ctx = SERIES_CONTEXT[series];
    if (!ctx) return null;
    const differs = !Number.isFinite(tolerancePct) || Math.abs(tolerancePct - ctx.typical.pct) > 1e-9;
    return { series, spacing: ctx.spacing, note: ctx.note, suggestion: differs ? ctx.typical : null };
}

/** Explore scales next to the goal sliders, kept apart from the model's validity and the datasheet's numbers. */
export function exploreScale(kind, led) {
    if (kind === 'current') {
        const rated = led?.limits?.current;
        return { range: '0.5–25 mA', note: '탐색용 눈금입니다 (권장·정격 범위가 아님)', rated: Number.isFinite(rated) ? rated : null };
    }
    const o = led?.optical, max = Math.max(20, Math.min(2000, Math.round(1.5 * (o?.maxMcd ?? o?.nominalMcd ?? 200))));
    const bin = Number.isFinite(o?.minMcd) && Number.isFinite(o?.maxMcd) ? { min: o.minMcd, max: o.maxMcd }
        : Number.isFinite(o?.nominalMcd) ? { typ: o.nominalMcd } : null;
    return { range: `1–${max} mcd`, note: '탐색용 눈금입니다 (모델 유효범위·제조사 보증이 아님)', datasheet: bin, testCurrent: Number.isFinite(o?.testCurrent) ? o.testCurrent : null };
}
