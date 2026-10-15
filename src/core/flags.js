/** Human-readable text for solver flags (approximations, extrapolations, not-modeled conditions). */
export const FLAGS={
 'legacy-led-unverified':'legacy LED 데이터입니다.',
 'approximation:LED-table-midpoint':'LED: typ Vf가 없어 표의 min/max 가운데값을 계산 가정으로 사용합니다.',
 'not-modeled:LED-vf-current-shape':'LED: 시험 전류에 따른 Vf 형상은 모델링하지 않았습니다.',
 'not-modeled:LED-temperature':'LED: 선택 온도의 전기적 온도 의존성 자료가 없어 25°C 곡선을 유지합니다.',
 'not-modeled:LED-absolute-optical-anchor':'LED: 원문 광도 범위는 있지만 단일 typ anchor가 없어 scalar mcd를 만들지 않습니다.',
 'not-modeled:LED-optical-current-shape':'LED: 단일 광도 시험점은 있으나 전류-광도 곡선이 없습니다.',
 'approximation:GPIO-limit-points-not-typical':'GPIO: 한계 시험점을 잇는 가정 곡선입니다.',
 'approximation:BJT-active-saturation-bridge':'BJT: 활성/포화 곡선 사이를 축약 근사합니다.',
 'approximation:BJT-saturation-drive-ratio-mismatch':'BJT: 서로 다른 강제 전류비의 datasheet 곡선을 bridge anchor로 사용합니다.',
 'approximation:BJT-strong-base-drive':'BJT: 강한 베이스 구동 구간은 근사입니다.',
 'approximation:DTC-terminal-bridge-and-internal-Vbe':'DTC: 외부 IO/II 곡선 기반 연결 근사이며 내부 VBE는 별도 가정입니다.',
 'not-modeled:self-heating-feedback':'자가발열의 전기 특성 피드백은 계산하지 않습니다.',
 'not-modeled:transistor-electrical-temperature':'TR 전기 곡선은 25°C 기준입니다.',
 'not-modeled:off-leakage':'OFF 누설/역급전/과도는 모델링하지 않습니다.',
 'not-verified:direct-high-side-OFF-domain':'직접 하이사이드의 다른 전압 도메인 OFF는 별도 모델이 필요합니다.'
};
export const flagText = value => FLAGS[value] ?? (value.startsWith('extrapolation:') ? '곡선 범위 밖 외삽: ' + value.slice(14)
    : value.replace('approximation:', '명시적 근사: ').replace('not-modeled:', '미모델화: '));
