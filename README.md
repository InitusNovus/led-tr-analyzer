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

총 **13개 토폴로지**와 동일 LED의 직렬 연결을 지원합니다. 토폴로지는 회로 구조를 정하고, 회로 안의 `LED1 / Q1 / Q2 / GPIO1` 슬롯에는 호환되는 실제 부품 모델을 선택합니다. 선택된 model ID는 forward 계산, 저항 역산, 정격 검사, 감도 분석, 회로도, JSON 내보내기에 동일하게 사용됩니다. 에미터 저항 전류 싱크는 RE 수동 설정으로 검증합니다.

**계산 결과는 설계 보증이 아닙니다.** 전형값 곡선의 수동 추출, 자료가 없는 구간의 명시적 근사, 외삽을 구분해서 표시합니다. 공차 패널은 샘플링한 민감도 분석이며 제조 편차 전체의 보증된 worst case가 아닙니다. 전원 OFF/역류 모델이 없는 조건은 미지원으로 반환합니다.

## 부품 선택과 데이터 근거

- KT-0805 R/G/B/YG/O는 기존 소스에 기록되어 있던 LCSC/KENTO 원문을 복구해 characteristic curve와 정격을 다시 연결했습니다. Y/W는 확인 가능한 표/metadata만 쓰고, 읽지 못한 시험조건은 형제 품번에서 추정하지 않습니다.
- 기본 LED인 **Kingbright APT2012SURCK**는 KT 계열과 별개의 reference 모델입니다.
- 일반 NPN은 **MMBT3904LT1G / BC847B**, NMOS는 **2N7002 / BSS138BKW**를 실제 품번으로 선택할 수 있습니다. PNP, PMOS, digital NPN, GPIO는 현재 family당 한 개의 검증 모델만 노출하며 가짜 후보를 만들지 않습니다.
- DTC043ZEB의 외부 입력전류 II, 내부 베이스전류 IB, 외부 전류이득 GI를 구별합니다.
- 부품 정격으로 전류를 잘라내지 않습니다. 계산 뒤 선택된 소자의 정격/열 조건으로 별도 검사합니다.
- `안전 설계` 대신 **입력한 한계 내 / 일부 한계 미검증 / 한계 초과**와 모델 가정을 표시합니다.
- 회로도는 장식용 블록이 아니라 13개 고정 토폴로지의 Q1/Q2/저항/GPIO/LED 단자를 표시하며, 소자를 선택하면 같은 instance ID의 결과와 근거를 보여줍니다.

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
src/ui/circuitTemplates.js 회로별 instance/terminal 연결 계약
src/ui/viewModel.js        소자·결과·근거 표시 adapter
src/components/            실제 심볼 회로도와 오류 경계
src/App.jsx                한국어 workbench, 실제 부품 선택, JSON 내보내기
```

`dev` push와 `main` 대상 PR에서 계산 테스트·빌드·브라우저 테스트가 실행됩니다. Pages 배포는 `main`만 대상으로 하며 PR을 병합하기 전에는 공개 사이트가 바뀌지 않습니다.

모델 추가 시 출처/시험조건과 적용 범위를 먼저 기록하고 `tests/models.test.js`에 기준점·외삽 검사를 추가하세요. 데이터시트에 없는 소자 특성을 보증값으로 등록하지 않습니다. 상세 규칙은 [MODELS.md](docs/MODELS.md)를 참조하세요.
