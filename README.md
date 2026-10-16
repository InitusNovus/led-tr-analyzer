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
src/ui/schematic.js        단자 좌표 기반 회로도 장면 (배선은 심볼의 단자에서만 만들어짐)
src/ui/viewModel.js        소자·결과·근거 표시 adapter
src/components/            실제 심볼 회로도와 오류 경계
src/App.jsx                한국어 workbench, 실제 부품 선택, JSON 내보내기
```

`dev` push와 `main` 대상 PR에서 계산 테스트·빌드·브라우저 테스트가 실행됩니다. Pages 배포는 `main`만 대상으로 하며 PR을 병합하기 전에는 공개 사이트가 바뀌지 않습니다.

모델 추가 시 출처/시험조건과 적용 범위를 먼저 기록하고 `tests/models.test.js`에 기준점·외삽 검사를 추가하세요. 데이터시트에 없는 소자 특성을 보증값으로 등록하지 않습니다. 상세 규칙은 [MODELS.md](docs/MODELS.md)를 참조하세요.


## 광도·설계 판단 흐름 (#20 / #21)

- Hubei KENTO **KT-0805 R/G/B/YG/O**는 제조사 시험점의 **광도 min/max bin**과 전형적 `relative Iv vs If`를 결합해 범위로 표시합니다. 시험점과 정규화 전류가 다르면 상대광도 **비율**로 환산합니다. 이는 다른 전류에서의 제조사 보증 범위가 아닙니다.
- 광도 목표는 **최저 bin 기준 추정**, 실제 **typ 기준**(typ 절대 anchor가 있는 경우만), 또는 명시적 **중간 대표값 가정** 중 근거가 존재하는 기준으로 역산합니다. 곡선 범위 밖을 자동 외삽하지 않습니다.
- `KT-0805W`는 5mA 절대 광도 시험점만 표시하며, `KT-0805Y`는 시험전류 미확인으로 임의 광도 역산하지 않습니다.
- mcd “사용감 가이드”는 초기판의 표시등 설계 팁을 **휴리스틱**으로 복구한 것입니다. 눈부심·지각 밝기·조도(lux)의 계산 결과나 안전 판정이 아닙니다.
- **mA/mcd 목표값은 독립 보존**됩니다. 광도 미지원 LED로 바꿔도 이전 숫자가 다른 단위로 다시 해석되지 않습니다.
- **Nominal과 sampled Min–Max를 한 요약에서** 봅니다. LED 전류 띠가 nominal과 sampled 최소·최대, 계산된 조건 수, 스윕한 축(VLED·GPIO 전원·RLED·Vf 이동)을 보여주고, 극값별 입력 조건 표와 스윕하지 않은 조건(RB/RE, 온도, 전형 곡선 등)을 함께 표시합니다. 기본 표본은 입력이 멈추면 자동으로 계산하며 계산 중에도 입력할 수 있고, DTC 내부 공차 확장(729개)은 직접 실행합니다. 입력이 바뀌면 이전 결과를 버리고, 일부 조건이 모델 적용범위 밖이면 제외한 개수를 표시하며 전체 통과로 보이지 않게 합니다. 광도는 bin 범위, 전기 조건 변동만, 둘을 결합한 추정을 따로 보여줍니다.
- **동작점 전압 예산과 구동**을 토폴로지별로 봅니다. 부하 경로(RLED · LED Vf · VCE/VDS · RE)와 구동 경로(GPIO → RB/RG → 베이스·게이트, 2단 회로는 Q1 입력과 Q2 구동을 따로)가 각각 전원 또는 단자 전압과 같아지는 전압 루프로 표시되고, 각 구간의 전류도 함께 나옵니다. BJT는 IC · IB · IE와 실제 IC/IB, 그 IC에서의 hFE, 데이터시트 VCE(sat) 시험 IC/IB와 근거 figure를 보여주며 **β 합격선은 없습니다**. DTC는 외부 IO/II · II와 내부 IB · IC/IB를 구분합니다. 에미터 팔로워는 LED의 IE와 VLED 공급 IC를, 전류 싱크는 RE 전압을 IE로 계산해 구분합니다. OFF/Hi-Z처럼 모델이 값을 정하지 못하는 조건은 임의의 0 V나 β를 표시하지 않습니다.
- **경고는 심각도와 범위를 구분**해서 보여줍니다. `한계 초과`(정격 검사 결과), `여유 부족`(직접 정한 기준 이상 사용, 한계 초과가 아님), `정격 미확인`, `모델 근사`가 따로 표시되고, 각 항목에 근거가 Nominal인지 Sampled인지 붙습니다. Sampled 초과는 전체 표본 중 몇 개에서 초과했는지와 최악 조건(공칭과 달라진 입력만)을 읽을 수 있게 보여줍니다. 각 경고의 `입력 수정` 버튼은 그 규칙에 실제로 효과가 있는 입력(예: RLED 전력 예산 → RLED 실제 정격, LED 전류 → RLED 또는 선정 모드의 목표 전류, 전류 싱크 → RE)으로 이동해 포커스를 줍니다.
- **RLED 전력 예산 막대**는 Nominal 사용률, Sampled peak, 입력 예산선을 따로 표시하고 100%를 넘어도 숫자로 보여줍니다. 필요 정격(≥ peak ÷ 사용 비율)과 generic 패키지 비교는 입력한 예산 기준이며 제조사 보증이 아닙니다. 패키지 변경은 버튼을 눌렀을 때만 적용하고 바로 다시 검증합니다.
- **설계 판단 요약**에서 nominal 정격과 sampled sensitivity 상태, 전압 경로, 저항 전력 예산, 원인 소자·시나리오를 구분해 볼 수 있습니다. 위반 여부는 구성된 전기·데이터시트 모델의 검토 결과이며 보증이 아닙니다.
- Q1/Q2/LED1/보조저항은 회로도·inspector·정격 검사에서 **같은 instance ID**를 사용하며, 잘못된 입력 중에도 정적 부품 근거와 수정할 입력창이 남습니다.
- 독립 제어 전압이 필요하면 **사용자 가정 DC 제어원**을 선택할 수 있습니다. 실제 STM32G0 모델에 5V를 임의 허용하는 방식이 아닙니다. 가정 모델의 출력전류·보호·역급전 보증은 없습니다.
- **적용한 목표는 검증 모드에서도 유지**됩니다. `검증 모드에 적용`을 누르면 목표값·광도 기준·판정 기준·E-series/선택 방식·선정 저항과 적용 시점의 구성 snapshot을 보관하고, 이후 현재 구성으로 다시 평가해 목표·실제값·차이(절대/%)와 판정을 보여줍니다. 적용 뒤 RLED·LED·전원·토폴로지·부품을 바꾸면 달라진 항목을 나열하며, 예전 합격 표시를 새 조건에 남기지 않습니다. 현재 구성에서 평가할 수 없으면(예: 광도 근거 없는 LED) '평가할 수 없음'으로 표시합니다.
- **목표 판정 기준**은 선택할 수 있습니다. `최소 목표 이상`(기본)은 실제값이 목표 이상이면 충족이고, `목표 ± 허용 오차 이내`는 초과도 허용 범위를 벗어나면 미달입니다. 최소 기준의 충족을 '정확히 목표와 같다'는 뜻으로 읽지 마세요.
- JSON 결과는 `schemaVersion: 4`이며 `optical`(range / scalar / test-point / unavailable), `designIntent`, 화면에 표시된 `goal`, 편집 중 목표 `editingGoal`, 적용한 목표 `appliedGoal`(intent·선정 저항·구성 snapshot·재평가·달라진 항목)과 sampled 근거를 저장합니다.

**제약:** DC 축약 모델이며 표본/광학 제조분포·PWM·확산판·눈부심 안전·실측 검증은 수행하지 않습니다.
