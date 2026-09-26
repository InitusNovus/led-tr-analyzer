# LED-TR Analyzer

데이터시트 특성곡선으로 LED 구동 회로의 **DC 동작점**을 계산하는 브라우저 도구입니다. SPICE·IBIS 엔진을 사용하지 않습니다.

[계산기](https://initusnovus.github.io/led-tr-analyzer/) · [모델과 한계](docs/MODELS.md) · [검증](docs/VALIDATION.md)

## 지원 범위

| 구분 | 구성 |
|---|---|
| 기준 | 전원 + 저항 + LED |
| 직접 구동 | GPIO Source / Sink, HIGH·LOW·Hi-Z, open-drain 및 선택적 pull |
| BJT | 디지털 NPN 로우사이드, 일반 NPN 로우사이드, NPN 에미터 팔로워, 에미터 저항 전류 싱크 |
| MOSFET / 하이사이드 | NMOS 로우사이드, PNP 하이사이드, PMOS 하이사이드 |
| 레벨 시프트 | NPN→PNP, NPN→PMOS, NMOS→PMOS |

총 **13개 토폴로지**와 동일 LED의 직렬 연결을 지원합니다. 부품 전압·전류·손실을 같은 동작점에서 계산하며, 저항 역산도 같은 모델을 사용합니다. 에미터 저항 전류 싱크는 RE 수동 설정으로 검증합니다.

**계산 결과는 설계 보증이 아닙니다.** 전형값 곡선의 수동 추출, 자료가 없는 구간의 명시적 근사, 외삽을 구분해서 표시합니다. 공차 패널은 샘플링한 민감도 분석이며 제조 편차 전체의 보증된 worst case가 아닙니다. 전원 OFF/역류 모델이 없는 조건은 미지원으로 반환합니다.

## 기존 프리셋과 달라진 점

- 기존 KT-0805 7종은 삭제하지 않고 **미검증 기존값**으로 남겼습니다. 원래의 30mA 한계와 mcd 값을 검증된 값으로 사용하지 않습니다.
- 기본 LED는 출처를 확인한 **별도의 Kingbright APT2012SURCK**입니다. KT-0805를 이 부품의 곡선으로 대체한 것이 아닙니다.
- DTC043ZEB의 외부 입력전류 II, 내부 베이스전류 IB, 외부 전류이득 GI를 구별합니다.
- 부품 정격으로 전류를 잘라내지 않습니다. 계산 뒤 별도의 한계 검사에서 초과를 표시합니다.
- `안전 설계` 대신 **입력한 한계 내 / 일부 한계 미검증 / 한계 초과**와 모델 가정을 표시합니다.

## 개발

Node.js 24 권장. 기존 React / Vite / Tailwind 의존성을 유지하고 lockfile로 고정합니다.

```sh
npm ci
npm run dev
npm test
npm run test:coverage
npm run build
npm run preview
```

브라우저 회귀 테스트:

```sh
python -m pip install -r scripts/requirements-browser.txt
python -m playwright install --with-deps chromium
npm run build
npm run test:browser
```

기본 브라우저 테스트는 실제 배포 하위 경로 `/led-tr-analyzer/`에서 실행합니다. 제한된 로컬 환경에서 `BROWSER_INLINE=1`로 실행할 수도 있지만, 이는 번들 렌더링 검증일 뿐 HTTP 전달/하위 경로 검증을 대신하지 않습니다.

## 구조

```text
src/data/catalog.js        출처·시험조건·곡선·정격
src/core/math.js           입력 검증, 보간, 이분법, E-series
src/core/devices.js        소자별 축약 비선형 함수
src/core/topologies.js     회로별 결합 동작점, 전력 수지
src/core/analysis.js       한계 검사, 코너별 witness, 저항 선정
src/components/           연결 개요도와 오류 경계
src/App.jsx               한국어 UI, 모델 근거, JSON 내보내기
```

`dev` push와 `main` 대상 PR에서 계산 테스트·빌드·브라우저 테스트가 실행됩니다. Pages 배포는 `main`만 대상으로 하며 PR을 병합하기 전에는 공개 사이트가 바뀌지 않습니다.

모델 추가 시 출처/시험조건과 적용 범위를 먼저 기록하고 `tests/models.test.js`에 기준점·외삽 검사를 추가하세요. 데이터시트에 없는 소자 특성을 보증값으로 등록하지 않습니다. 상세 규칙은 [MODELS.md](docs/MODELS.md)를 참조하세요.
