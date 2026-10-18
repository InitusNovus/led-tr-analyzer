# 모델, 출처, 적용 한계

## 원칙

모든 계산 코어는 SI 단위(A, V, Ω, W, °C)를 사용합니다. 화면에서만 mA/mW로 변환합니다. `catalog.js`의 원시 점 데이터에는 제조사, revision, URL, 그림 번호, 시험조건, 범위, 수동 추출 여부가 연결되어 있습니다.

데이터시트 그래프를 직접 읽은 점은 **전형적인 곡선의 거친 수동 근사**입니다. 파라미터 식별/실측으로 검증한 모델도, 제조사의 보증 min/max 모델도 아닙니다. 그래프 점 사이의 선형/로그 보간은 구현 선택입니다. 표의 정격은 `limits`에 따로 보관하며 계산값을 clamp하지 않습니다.

## 사용한 제조사 자료

원문 PDF는 저장소에 재배포하지 않습니다. 아래 문서의 표/그래프에서 필요한 수치와 시험조건만 기록했습니다. 링크의 문서가 개정되면 기존 모델과 혼합하지 말고 revision을 갱신하고 기준점 테스트를 재검토해야 합니다.

| 모델 | 문서 / 읽은 범위 | 모델 특성 |
|---|---|---|
| APT2012SURCK | [Kingbright V.21A, 2025-03-17](https://www.kingbrightusa.com/images/catalog/SPEC/APT2012SURCK.pdf), p.1~3 | If–Vf, 상대 광도–If/T, 전류 디레이팅 |
| MMBT3904LT1G | [onsemi Rev.14, 2021-08](https://www.onsemi.com/download/data-sheet/pdf/mmbt3904lt1-d.pdf), Fig.15/17/18/19 | gain, VCEsat, VBEsat, 활성영역 VBE |
| BC847B | [Nexperia BC847x series Rev.13, 2022-07-01](https://assets.nexperia.com/documents/data-sheet/BC847X_SER.pdf), Fig.6~9 | 선택 가능한 두 번째 NPN; gain/VBE/VCEsat/VBEsat 전형곡선 |
| BSS138BKW | [Nexperia Rev.1, 2011-08-12](https://assets.nexperia.com/documents/data-sheet/BSS138BKW.pdf), Fig.6/7 및 Table7 | 선택 가능한 두 번째 NMOS; VGS별 output curve와 저게이트 근사 |
| BC857B | [Nexperia Rev.9, 2022-07-01](https://assets.nexperia.com/documents/data-sheet/BC856_BC857_BC858.pdf), Fig.6~9, Table6/7 | B gain group, PNP 특성은 절댓값 사용 |
| DTC043ZEB | [ROHM Rev.002, 2016-03-25](https://fscdn.rohm.com/en/products/databook/datasheet/discrete/transistor/digital/dtc043zebtl-e.pdf), R1/비율 표, Fig.4/5 | GI=IO/II 및 IO/II=10의 VO(on) 곡선 |
| 2N7002 | [Nexperia Rev.7, 2011-09-08](https://assets.nexperia.com/documents/data-sheet/2N7002.pdf), Fig.5/7, 정격/열 표 | VGS별 출력 곡선, 낮은 게이트 구동 근사 |
| BSS84 | [NXP/Nexperia Rev.06, 2008-12-16](https://assets.nexperia.com/documents/data-sheet/BSS84.pdf), Fig.4/6, 정격/열 표 | PMOS 출력·전달 특성 절댓값 |
| GPIO | [STM32G0B1 DS13560 Rev.6](https://www.st.com/resource/en/datasheet/stm32g0b1cc.pdf), Table57 및 전류 정격 표 | 일반 non-FT_c, non-PC13/14/15 I/O, VDD 2.7~3.6V |

### KT-0805 7종 — 원문 출처 복구

초기 Gemini 소스에 C2295/C2297/C2293/C2292/C2296/C110371/C34499의 LCSC datasheet URL이 이미 기록되어 있었습니다. 이를 다시 열어 원문 조건을 복구했으며, 전부를 `legacy-unverified`로 취급하던 중간 dev 상태는 폐기했습니다.

| LED | LCSC | 원문 상태 | 핵심 시험조건 / 절대정격 |
|---|---|---|---|
| KT-0805R | C2295 | Hubei KENTO A.0, 2018-12-06; p.5 curve 수동 추출 | Vf 1.8–2.4V @10mA; IV 85–210mcd @20mA; IF 25mA; Pd 40mW |
| KT-0805G | C2297 | Hubei KENTO A.0, 2018-12-06; p.5 curve 수동 추출 | Vf 2.6–3.1V @5mA; IV 175–430mcd @5mA; IF 30mA; Pd 100mW |
| KT-0805B | C2293 | Hubei KENTO A.0, 2018-12-06; p.5 curve 수동 추출 | Vf 2.6–3.1V @5mA; IV 34–100mcd @5mA; IF 30mA; Pd 100mW |
| KT-0805YG | C2292 | Hubei KENTO A.0, 2018-12-06; p.5 curve 수동 추출 | Vf 1.8–2.4V @10mA; IV 24–70mcd @20mA; IF 25mA; Pd 40mW |
| KT-0805Y | C2296 | Hubei KENTO A.0, 2018-12-06 (이슈 #41·#45에서 원문 확인); p.5 곡선은 같은 문서의 픽셀에서 `scripts/digitize_kento_y.py`로 추출 | Vf 1.8–2.4V @10mA; IV 70–175mcd @20mA; IF 25mA; IFP 60mA; Pd 40mW; VR 5V; −40…85°C |
| KT-0805O | C110371 | Hubei KENTO A.0, 2018-12-06; p.5 curve 수동 추출 | Vf 1.8–2.4V @10mA; IV 70–175mcd @20mA; IF 25mA; Pd 40mW |
| KT-0805W | C34499 | C34499-associated KENTO A3, 2017-05-16을 pin | Vf 2.6–3.2V @5mA; IV typ 350mcd @5mA; IF 25mA; Pd 80mW |

R/G/B/YG/O는 같은 원문에 실린 Typical Electrical-Optical Characteristics Curves를 거칠게 수동 판독하여 `manual-curve`로 사용합니다. 곡선은 전형값이며 생산 분포의 보증곡선이 아닙니다. R/YG/O의 p.3 Vf 행은 10mA인데 p.4 voltage-bin 표는 20mA이므로 서로 다른 시험조건으로 따로 저장합니다.

Y는 이슈 #41에서 LCSC 원문(A.0, 2018-12-06)을 직접 읽어 IV 70–175mcd @20mA, Vf 1.8–2.4V @10mA, IF/IFP/VR/Pd를 확인했고, 이슈 #45에서 p.5의 Vf–If, 상대광도–If, 상대광도–온도, 최대 전류–온도 곡선을 **같은 문서의 이미지 픽셀에서** 격자선 기준으로 읽어 `manual-curve`로 넣었습니다 (`scripts/digitize_kento_y.py`가 PDF에서 같은 값을 재현합니다. 정확도는 격자 한 칸의 수 %, 이 곡선은 전형값이며 생산 분포의 보증이 아닙니다). 형제 KT의 값은 어떤 항목에도 빌려 쓰지 않습니다.

White C34499는 웹의 다른 mirror에 같은 제품명/비슷한 revision을 가진 사본이 있으나 Pd, IF 및 광학 시험조건이 C34499-associated LCSC 문서와 충돌합니다. 이 모델은 **LCSC에 직접 연결된 A3 2017-05-16 문서**만 pin하고 다른 mirror의 숫자를 합치지 않습니다. 동일 source의 current-dependence curve를 이번 PR에서 확인하지 못했으므로 Vf는 2.6–3.2V의 midpoint 2.9V를 명시적 table-only 가정으로 사용하고, 광도 350mcd는 정확히 5mA/25°C 시험점에서만 반환합니다.

R/G/B/YG/Y/O의 데이터시트 광도는 min/max bin 범위이고 단일 typ 절대광도가 아닙니다. 상대 광도 곡선은 보관하더라도 그 범위를 임의의 midpoint “typ mcd”로 바꾸지 않으며, 현재 UI의 scalar mcd 출력은 `null`입니다. 추후 bin 선택/범위 출력 UI를 별도 구현할 수 있습니다.

## KENTO 등급(bin) 조사와 광도 등급 선택 (이슈 #41)

2026-10-16에 LCSC의 KT-0805 R/G/B/YG/Y/O/W 승인서(공통 A.0, 2018-12-06, 11쪽)를 직접 읽고 p.3–4의 **bin 표**를 정리했습니다. 승인서는 색마다 세 종류의 bin을 정의합니다.

| 종류 | 코드 | 의미 | 조건 | 허용차 |
|---|---|---|---|---|
| 광도 (§6.1) | `P12`–`P27` | 해당 시험전류에서의 광도 범위 | 색마다 5 또는 20 mA | ±10% |
| 전압 (§6.2) | `VE`–`VJ` (20 mA 색), `VM`–`VQ` (5 mA 색) | Vf 범위 | 20 또는 5 mA | ±0.05 V |
| 파장 (§6.3) | `R1`–`R5`, `G2`–`G6`, `B4`–`B8`, `YG9`–`YG14`, `Y3`–`Y7`, `O2`–`O6` | 주파장 범위 | 20 또는 5 mA | ±1 nm (YG ±0.5 nm) |

**`KT-0805R2`처럼 품번 끝에 붙는 숫자는 밝기 등급이 아닐 가능성이 큽니다.** 데이터시트에서 `R1`–`R5`는 **빨강의 파장 bin**(R2 = 618–621 nm)이고, 밝기 bin은 `P19`–`P23`입니다. 다만 승인서에는 품번(ordering code) 체계 설명이 없고 판매처에서도 `KT-0805R2` 목록을 찾지 못해서, 접미사가 실제로 무엇을 뜻하는지는 **확인되지 않았습니다** (제조사 문의나 판매처 상품 라벨이 필요). 그래서 앱은 접미사를 해석하지 않고, 데이터시트가 정의한 P코드를 광도 등급으로만 사용합니다.

### 광도 bin (§6.1)

| LED | 시험전류 | bin → 범위 (mcd) |
|---|---|---|
| KT-0805R | 20 mA | P19 85–100 · P20 100–120 · P21 120–145 · P22 145–175 · P23 175–210 |
| KT-0805G | 5 mA | P23 175–210 · P24 210–250 · P25 250–300 · P26 300–360 · P27 360–430 |
| KT-0805B | 5 mA | P14 34–40 · P15 40–58 · P16 58–70 · P17 70–85 · P18 85–100 |
| KT-0805YG | 20 mA | P12 24–28 · P13 28–34 · P14 34–40 · P15 40–48 · P16 48–58 · P17 58–70 |
| KT-0805Y | 20 mA | P18 70–85 · P19 85–100 · P20 100–120 · P21 120–145 · P22 145–175 |
| KT-0805O | 20 mA | P18 70–85 · P19 85–100 · P20 100–120 · P21 120–145 · P22 145–175 |

각 색의 bin을 이으면 기존에 쓰던 전체 범위(R 85–210, G 175–430, B 34–100, YG 24–70, Y 70–175, O 70–175)와 정확히 같습니다. 즉 기존 값은 "모든 bin의 합집합"이었고, `tests/led-bin.test.js`가 이 연속성을 확인합니다. 같은 P코드라도 색마다 범위와 시험전류가 다릅니다(예: `P23`은 R에서 175–210 mcd @20 mA, G에서 175–210 mcd @5 mA).

전압·파장 bin은 `LEDS[...].bins`에 조건과 함께 보관하고 빠른 스펙에 표시만 합니다. Vf 모델은 곡선 기반이라 전압 bin으로 좁히지 않았습니다.

### 계산에서의 동작

- `config.ledBin`(기본 `null`)이 있으면 LED의 광도 범위가 그 bin의 min–max로 좁아지고, **typ 값은 버립니다** (typ는 bin이 아니라 전체 모집단의 값이기 때문입니다). 시험전류가 아닌 전류·온도에서는 기존과 같은 상대곡선 배율 `R(I)/R(I_test)`를 그 범위에 곱합니다.
- 목표 광도 역산(`solveOpticalCurrent`)과 저항 선정, 목표 판정, 민감도 분석이 모두 같은 bin을 씁니다. 전기 동작점(전류·전압)은 bin과 무관합니다.
- bin을 고르지 않으면 이전과 수치가 완전히 같습니다. 존재하지 않는 bin은 `invalid-input`으로 거절하고, LED를 바꾸면 bin은 해제됩니다 (bin은 LED마다 다릅니다).
- JSON 내보내기: `inputDraft/appliedConfiguration.ledBin`, `modelSnapshot[LED1].selectedIntensityBin`.
- 등급은 제조사 분류 범위이며 보증이 아닙니다 (표 허용차 ±10%는 별도).

### 후속 조사 결과 (이슈 #45)

**품번 접미사(`KT-0805R2`)**: 2026-10-16에 JLCPCB 부품 DB(LCSC 데이터 포함)를 `KT-0805`, `KT-0805R`, `KT-0805R1/R2/R3`, `Hubei KENTO 0805` 등으로 검색했습니다. 등록된 KT-0805 계열은 일곱 개(YG C2292, B C2293, R C2295, Y C2296, G C2297, W C34499, O C110371)뿐이고 `R1`/`R2` 같은 변형 품번은 없습니다. 빨강 `KT-0805R`의 상품 정보에는 주파장 **615–630 nm**가 적혀 있는데, 이는 승인서의 파장 bin `R1–R5`(615–618 … 627–630 nm)를 모두 합친 범위입니다. 따라서 `R2` 같은 끝 숫자는 같은 부품 안의 **파장 sub-bin**일 가능성이 높습니다. 다만 이것은 정황이며, 판매자가 붙인 품번의 정의는 제조사나 판매자에게 확인하기 전에는 확정할 수 없습니다. 앱은 접미사를 해석하지 않습니다 (UI 설명도 "데이터시트의 R1–R5는 파장 bin"이라고만 말합니다).

**KT-0805Y p.5 곡선**: 위 Y 설명대로 반영했습니다. 이제 다른 전류·온도에서도 광도를 추정하고 목표 광도 역산이 가능합니다. 상대광도는 약 35 mA에서 최대(약 1.2배)이고 그 위로는 줄어드는 곡선이라 최소 광도 기준으로 도달할 수 있는 한계가 있습니다 (예: 최소 70 mcd 기준의 1.2배 = 84 mcd까지).

**KT-0805W 문서 충돌 → 결정**: LCSC가 지금 C34499에 연결하는 문서는 `0805BC`(A.0, 2018-12-06: IV 145–360 mcd @5 mA, Vf 2.6–3.1 V, Pd 100 mW)이고, 이 모델이 pin한 A3 2017-05-16 문서(Vf 2.6–3.2 V, typ 350 mcd, Pd 80 mW)는 더 이상 내려받을 수 없습니다. 반면 LCSC 상품 DB를 반영하는 JLCPCB의 C34499 상품 정보(−30…85 ℃, Vf 2.6–3.2 V, 25 mA, 350 mcd, 80 mW)는 **A3 문서와 일치**합니다. 그래서 White 모델은 A3(상품 DB와 일치)를 계속 따르고, 현재 연결된 `0805BC` 문서는 다른 변형으로 간주해 섞지 않습니다. 그 문서에만 있는 광도 bin(P22–P26)과 색좌표 bin(BC1–BC7)은 White에 적용하지 않습니다. A3 원본을 다시 구하거나 제조사가 두 문서의 관계를 알려 주면 재검토합니다.

## Everlight 시리즈 (0805 · 0603 · 0402)

사용자 요청("0805, 0402 각각 색상 세트, 0603도")에 따라 광도 등급이 **품번에 들어 있는** Everlight 단색 SMD LED를 크기별로 한 세트씩 추가했습니다. 선정은 2026-10-18에 JLCPCB 부품 검색 API(약 3,300건 수집)에서 재고가 많은 순으로 했고, 모두 **확장 부품**(extended)이라 조립 시 부품 추가 수수료가 붙습니다. 값은 전부 해당 품번 **자기 데이터시트**(DSE 번호가 `SOURCES`의 revision에 있음)에서 옮겼고, 다른 품번의 값은 채우지 않았습니다.

| 크기 | 색 | 품번 (LCSC) | Iv @시험전류 | 재고(10-18) |
|---|---|---|---|---|
| 0805 | 빨강 | 17-21SURC/S530-A2/4T (C2986044) | min 15 / typ 38 mcd @20 mA | 34만 |
| 0805 | 노랑 | 17-21UYC/S530-A3/4T (C2985992) | min 40 / typ 62 | 37만 |
| 0805 | 연두 | 17-21SYGC/S530-E2/4T (C2986046) | min 17 / typ 23 | 26만 |
| 0805 | 파랑 | 17-21/BHC-XL2M2TY/4T (C2986040) | 14.5–28.5 @5 mA | 8.8만 |
| 0805 | 초록 | 17-21/GHC-XS1T2M/4T (C2971978) | 180–450 @20 mA | 6.9만 |
| 0805 | 흰색 | 17-21/T1D-CP2R1TY/4T (C2986043) | 57–140 @5 mA | 3.7만 |
| 0603 | 빨강 | 19-21SURC/S530-A2/4T (C2986009) | min 16 / typ 39 @20 mA | 14만 |
| 0603 | 노랑 | 19-217/Y5C-AP1Q2/6T (C2986063) | 45–112 @20 mA | 17만 |
| 0603 | 연두 | 19-21SYGC/S530-E2/4T (C2986011) | min 16 / typ 21 @20 mA | 4.6만 |
| 0603 | 파랑 | 19-21/BHC-AP1Q2/4T (C2986003) | 45–112 @20 mA | 0.8만 |
| 0603 | 초록 | 19-21/GHC-YR1S2/4T (C2986048) | 112–285 @20 mA | 6.3만 |
| 0603 | 주황 | 19-217/S2C-AL1M2VY/6T (C2987557) | 11.5–28.5 @5 mA | 3.9만 |
| 0603 | 흰색 | 19-217/T1D-AN1P1B3X/6T (C2987476) | 28.5–57 @2 mA | 2.8만 |
| 0402 | 빨강 | 16-213/R6C-AQ2R2B/3T (C264407) | 90–180 @20 mA | 4.5만 |
| 0402 | 연두 | 16-213SYGC/S530-E3/TR8 (C264408) | min 30 / typ 35 @20 mA (chip rank E3) | 13만 |
| 0402 | 초록 | 16-213/GHC-YR1S1/3T (C74338) | 112–225 @20 mA | 32만 |
| 0402 | 파랑 | 16-213/BHC-AN1P2/3T (C131223) | 28.5–72 @5 mA | 1.6만 |
| 0402 | 흰색 | 16-916/T1D-AP1Q2QY/3T (C264412) | 45–112 @5 mA | 4.2만 |

**구하지 못한 것**: 0402 노랑(`16-213UYC/S530-A2/TR8`, C136118)은 LCSC가 연결한 문서가 다른 제조사(TUOZHAN) 시트라 쓸 수 없고, 0402 주황(`16-213UYOC/S530-A2/TR8`, C88330)은 데이터시트를 찾지 못했습니다. 0805 주황은 Everlight 재고품이 없습니다. 이 셋은 추측으로 채우지 않았습니다.

### 품번에 들어 있는 등급 읽는 법 (시트로 확인한 범위)

- 시트 라벨 설명: `CAT` = Luminous Intensity Rank, `HUE` = Chromaticity & Dom. Wavelength Rank, `REF` = Forward Voltage Rank.
- `…/S530-A2/…`·`-A3`·`-E2`·`-E3` 형태: 그 품번의 **광도 하한(min)과 typ**가 시트 E/O 표에 직접 적혀 있습니다 (예: `17-21UYC/S530-A3` = min 40 / typ 62 mcd @20 mA). JLCPCB의 "40mcd~62mcd" 표기는 bin 범위가 아니라 이 min~typ입니다. 앱은 min을 **min 기준**으로, typ를 typ 기준으로 쓰고 `min` 기준을 기본으로 합니다.
- `R6C-AQ2R2B`·`GHC-XS1T2M` 형태: 품번이 등급 조합을 나타냅니다. `AQ2R2B`는 CAT **Q2–R2**(= 시트 등급표 90–112·112–140·140–180 → E/O 표 90–180 mcd), 파장 E4–E7 합집합(617.5–633.5 nm), 전압 그룹 B(0–2)와 일치합니다. `XS1T2M`은 파장 **X**(520–525 nm)와 CAT **S1–T2**(180–450 mcd)로 확인되지만 마지막 글자 `M`은 시트에서 표로 정의된 것을 찾지 못했습니다. 이 경우 E/O 표의 min–max를 광도 범위로 쓰고, 시트 등급표의 개별 등급(예: R1 112–140)은 "광도 등급(bin)" 선택기에서 좁혀 볼 수 있습니다.
- 참고: 같은 방식(색 글자+숫자가 등급 이름)이 KENTO의 파장 bin(`R2`)과도 닮았지만, KENTO 접미사의 정의는 여전히 확인하지 못했습니다(위 이슈 #45 항목).

### 곡선 판독과 한계

`scripts/digitize_everlight.py <시트.pdf>`가 곡선 페이지를 300 dpi로 렌더링해 격자선을 기준으로 4개 차트(Vf–If, Iv–If, Iv–Ta, 열화 곡선)를 읽고, 판독 지점을 그린 확인용 이미지(`*_overlay.png`)를 만듭니다. 시트에 따라 차트가 벡터이거나 ~95 dpi 래스터(605×817)라 정밀도는 **Vf ±0.02 V, 광도비 ±3 %** 정도로 보고, 모든 곡선은 `manual-curve`(typical)로 표기합니다. 시험 전류에서 읽은 Vf가 시트 표의 min/typ/max 안에 들어가는지는 `tests/everlight.test.js`가 교차 확인합니다.

- Iv–If 차트의 가로축은 균일한 로그 눈금이 아니라 격자선이 1…9·10·20…100 mA에 대응하는 손으로 그린 눈금이라, 격자선 위치를 값에 직접 대응시켰습니다. 세로축은 격자선이 28개로 읽히면 그 위치를, 아니면 균등 10진 눈금을 썼습니다(시험 전류 기준 비율만 쓰므로 영향이 작습니다).
- Vf 가로축의 마지막 눈금 글자(예: `3.0`)는 실제로는 한 칸(0.2 V) 뒤 위치입니다. 칸 수(10칸)와 칸당 0.2 V를 기준으로 계산했습니다.
- **여러 Everlight 시트가 같은 차트 도안을 공유합니다.** 서로 다른 색·크기 시트에서 판독값이 거의 같게 나오며(예: AlGaInP 계열 Vf@20 mA ≈ 1.99 V, 상대광도 5 mA ≈ 0.22), 이는 각 시트가 같은 대표 곡선을 싣고 있기 때문입니다. 값은 시트 자체의 곡선이지만 그 품번에서 따로 측정한 곡선이라는 뜻은 아닙니다.

### 시트 문제로 곡선을 쓰지 않은 경우 (모두 `notes`에 기록)

| 품번 | 문제 | 처리 |
|---|---|---|
| 16-213/BHC-AN1P2/3T | PDF에서 Vf 곡선이 다른 차트 위에 그려지고 열화 곡선은 프레임 밖 | Vf는 표 범위만(`vfTableOnly`), 열화 그래프 없음, Iv–If는 가는 곡선만 판독 |
| 19-21/GHC-YR1S2/4T | Vf 차트(2.4–4.4 V 축)가 20 mA에서 약 3.0 V로 읽혀 자기 표(typ 3.3 V)와 모순 | 차트를 쓰지 않고 표 typ 3.3 V만 사용 |
| 17-21/T1D-CP2R1TY/4T | 온도 차트가 흐린 저해상도라 읽기 불안정 (시트 제목은 `…/4T/EU`) | 광학 온도 곡선 없음(상온 외 온도는 "미지원") |
| 17-21/BHC-XL2M2TY/4T | 등급표가 L2를 11.5–18.0 mcd로 인쇄해 자기 E/O 행(14.5–28.5)과 어긋남 (JLCPCB도 11.5–18로 표기) | E/O 행을 사용, 광도 등급 선택기는 제공하지 않음 |
| 16-916/T1D-AP1Q2QY/3T | 전압 bin 표가 2.9–3.0 V를 두 번 인쇄 | 전압 bin 표 생략 |
| 16-213SYGC/S530-E3/TR8 | 시트가 `S530-XX` 공용본(chip rank E1–E4 표) | E3 행(min 30 / typ 35)만 사용 |

### 계산에서의 동작 (min/typ 시트)

`optical.minMcd`만 있고 `maxMcd`가 없는 부품은 `kind: scalar`이며 `hasMin`·`hasTypical`입니다. 상대 광도 곡선으로 min과 typ를 같은 비율로 스케일하고, 목표 광도 역산은 min 기준(기본)·typ 기준을 지원하지만 중간 대표값 기준은 없습니다(범위가 없으므로). 시험 전류 밖에서 스케일한 min은 **제조사 보증값이 아닙니다**(typical 곡선 기반 추정).

## 실제 부품 model ID와 회로 슬롯

토폴로지 ID는 **회로 구조**, instance ID는 그 회로 안의 **역할**, model ID는 실제 특성을 제공하는 **부품 모델**을 뜻합니다. 예를 들어 NPN→PMOS는 `Q1` 입력 NPN, `Q2` 출력 PMOS, `GPIO1`, `LED1`을 별도로 갖습니다.

- NPN: `onsemi:MMBT3904LT1G`, `nexperia:BC847B`
- PNP: `nexperia:BC857B`
- digital NPN: `rohm:DTC043ZEB`
- NMOS: `nexperia:2N7002`, `nexperia:BSS138BKW`
- PMOS: `nexperia:BSS84`
- GPIO: `st:STM32G0B1-general`

family에 후보가 한 개뿐이어도 실제 model ID를 감추지 않습니다. 다른 family의 model ID는 입력 오류이며, 조용히 기본 부품으로 fallback하지 않습니다. 구버전 config처럼 `deviceModels`가 없는 입력은 PR #7 시점의 고정 family mapping으로 해석합니다.

회로 전환 시 같은 family의 선택은 가능한 한 보존하고, 새 역할에 호환되는 모델이 없으면 해당 family의 고정 default를 명시적으로 사용합니다. 이 mapping은 계산, 한계 검사, 감도 분석 및 schemaVersion 2 export의 model snapshot에 같이 들어갑니다.

## 수학 모델의 구현 선택

### LED와 광학

정상 구간의 Vf는 수동 곡선 점을 구간별 보간합니다. 첫 유효 전류보다 작은 구간에는 처음 두 점에 연결되는 로그 형태의 tail을 사용하며 **외삽**으로 표시합니다. 원점의 임의 직선이 저전류 LED를 수백 Ω의 저항처럼 만들지 않도록 하기 위한 선택이지 측정 데이터가 아닙니다. 상한 밖에서는 끝 구간 연장과 외삽 경고를 사용합니다.

APT2012SURCK의 −1.9mV/°C는 20mA에서의 값입니다. 전체 곡선에 적용한 온도 보정은 근사로 표시합니다. 광도 230mcd는 p.1의 **별표 없는** 광도 기준이며, CIE127-2007 별표의 80mcd 값과 혼합하지 않습니다. 상대 광도 곡선과 온도 곡선의 곱 역시 분리 가능하다는 근사입니다. 출력은 LED 하나의 추정 광도이며 사람의 체감 밝기나 직렬 LED 전체 광도의 합이 아닙니다.

### 일반 BJT

공개된 활성영역 gain/VBE와 특정 IC/IB 비율의 VCEsat/VBEsat를 연결합니다. 포화 기준점과 활성영역 사이에서 유효 gain을 로그 보간하는 **명시적 bridge**를 사용합니다. 더 강한 베이스 구동 구간의 연장도 근사입니다. 이것은 출력 곡선 전체를 독립적으로 측정해 만든 surface가 아닙니다.

입력 구동과 부하를 함께 풀기 때문에 구동 부족이 실제 LED 전류·VCE·발열을 바꿉니다. IC, IB, IE를 분리하고 에미터 팔로워의 LED 전류는 IE=IC+IB로 계산합니다. 활성영역 데이터의 VCE 조건에서 멀어진 효과와 온도 의존성을 모두 재현하지는 않습니다. 25°C 밖의 BJT 계산은 온도 미모델링을 표시합니다. BC847B의 VCEsat 곡선(Fig.8)은 IC/IB=20, VBEsat 곡선(Fig.9)은 IC/IB=10이므로 두 곡선을 bridge anchor로 함께 쓰는 경우 그 조건 불일치를 별도 approximation flag로 남깁니다.

### 디지털 TR

DTC043ZEB의 Fig.4 GI는 **외부 IO/II**입니다. 내부 IC/IB로 대입하지 않습니다. Fig.5의 VO(on)도 IO/II=10에서만 직접 확보된 곡선입니다. 두 특성을 잇는 출력 전압 bridge는 모델 가정입니다.

내부 VBE는 5mA에서 0.7V, 전류 decade당 60mV의 로그 근사를 사용합니다. 이는 ROHM에서 추출한 VBE 곡선이 아닙니다. R1의 0.7~1.3배와 R2/R1=8~12를 적용하며 R2를 비율로 유도합니다. II, 내부 IB, R2 전류를 따로 계산하고 내부 저항 손실도 패키지 전력에 포함합니다.

### GPIO

8mA/0.4V와 15mA/1.3V는 지정 조건의 한계점입니다. 이를 잇는 곡선은 보수적 시나리오를 위한 **limit-derived approximation**, 실제 typ 출력저항 곡선이 아닙니다. 전류 사이의 연결까지 제조사가 보증하는 것은 아닙니다.

핀 종류와 VDD 범위를 제한합니다. VDD=0, 보호 다이오드 주입/역급전, 부유 핀의 누설은 재현하지 않습니다. 계산할 수 없는 상태는 `unsupported`로 반환합니다. Open-drain HIGH는 Hi-Z로 처리하며, 사용자가 넣은 pull 저항만 분석합니다. 포트 합산 전류는 사용자가 입력한 나머지 핀 부하를 더한 값이고 MCU 전체 VDD/VSS 소비전류 검사는 아닙니다.

### MOSFET

출력 곡선의 VDS축과 VGS 곡선 사이를 보간합니다. 가장 낮은 VGS보다 약한 구동에서는 전달 곡선으로 출력 곡선의 크기를 조정한 **shape approximation**을 사용합니다. VGS(th)로 스위치를 ON/OFF하거나 정격 ID에서 전류를 자르지 않습니다.

Body diode, 역방향 동작, Miller/게이트 전하, 자가발열/SOA, 실제 누설은 해석하지 않습니다. BSS138BKW 또한 제조사 Fig.6/7의 거친 수동 판독점에 기반하며 Table8의 RDS(on) 조건을 별도 근거로 보존합니다. 25°C 밖의 전기 특성은 온도 미모델링 경고가 붙습니다. 2N7002의 Tsp 기준 0.83W를 ambient 정격으로 사용하지 않고 자료의 RthJA 기준 열 예산을 별도로 계산합니다.

## 토폴로지와 수렴

범용 노드 해석기 대신 회로별 KCL/KVL을 작은 bracket-preserving 이분법으로 풉니다. `no-bracket`, `nonconvergence`, `invalid-input`, `unsupported`를 정상 0A와 구분합니다. LED/저항으로 정해지는 물리적 부하 범위는 root bracket으로 사용할 수 있지만 절대최대정격을 root 상한으로 사용하지 않습니다.

입력 전력과 LED·저항·TR·GPIO 출력단 손실을 같은 동작점에서 집계합니다. OFF일 때 소자에 표시되는 전압 중 부유 노드가 관련된 값은 **정격 검사용 상한**이지 정확한 노드 전압이 아닙니다. OFF 0A는 누설 미모델링 근사입니다.

직접 하이사이드 및 GPIO sink에서 전압 도메인이 다른 OFF/Hi-Z 상태는 보호회로·주입 특성 없이는 보증할 수 없습니다. 계산 가능한 ON 상태라도 OFF 미검증을 표시합니다. 일반 BJT의 부유 베이스는 OFF로 가정하지 않습니다.

## 공차, 전력, 온도

민감도 패널은 VCC/VDD/RLED/Vf offset의 min/nom/max 조합을 계산합니다. DTC 옵션은 R1 배율과 R2/R1 조합을 추가합니다. 각 극값에는 그 값을 만든 **동일 시나리오의 동작점(witness)**가 보존됩니다. Imax와 다른 코너의 Rmax를 섞지 않습니다.

이는 샘플링 결과입니다. 비단조 함수의 내부 극값이나 제조 공정/온도 전체의 worst case를 보증하지 않습니다. Vf offset은 사용자 가정이며, RB/RE 및 보조 저항은 nominal로 고정됩니다. 전형적인 트랜지스터 곡선을 임의의 통계적 min/max 모델로 만들지 않습니다.

저항 패키지 값은 편집 가능한 일반 프리셋입니다. 실제 저항의 정격/전압 정격/온도 조건을 확인해야 합니다. `resistorRating × derating`은 사용자 전력 예산입니다. 보조 저항 정격도 별도 입력입니다.

전기 모델의 온도와 주위 온도 기반 열 예산을 분리합니다. 데이터시트 기준 PCB/랜드에서 얻은 열 저항으로 전력 예산을 계산할 수 있지만 실제 PCB에서의 접합온도·전기 특성 피드백은 계산하지 않습니다. 정상 한계 내 판정은 SOA, 펄스, 수명, 열 안정성, 실제 하드웨어 안전의 검증이 아닙니다.

## 아직 구현하지 않은 후보

#1 Phase5의 2소자 피드백/OPAMP 전류 싱크, 정전류 IC, 병렬 가지/RGB/바이컬러는 후속 후보입니다. 동일 LED 직렬 연결만 이번 구현에 포함됩니다. UI로 모델 파일을 가져오거나 임의 소자를 배선하는 편집기도 없습니다. PR은 이 항목을 완료로 체크하지 않습니다.


## 광도 range-aware 모델 (이슈 #20)

`src/core/optics.js`는 scalar typ, datasheet min/max range, 단일 시험점(test-point) 및 unavailable을 구분합니다.

KENTO R/G/B/YG/O는 원문 absolute optical anchor `Iv_min/max(I_test)`와 전형적인 상대 광도곡선 `R(I)`를 별도로 보존합니다. 임의 전류에서의 추정은:

```text
scale(I, T=25C) = R(I) / R(I_test)
Iv_min_est(I) = Iv_min(I_test) * scale(I)
Iv_max_est(I) = Iv_max(I_test) * scale(I)
```

예를 들어 KT-0805G의 절대 광도 시험점이 5mA이고 상대곡선이 20mA 근처에서 정규화돼 있더라도, 계산은 20mA의 기준값을 그대로 곱하지 않고 `R(20mA)/R(5mA)`를 사용합니다.

**의미상 주의:** 제조사 bin min/max는 해당 **시험점**의 특성입니다. 다른 전류·온도로 전형곡선을 곱한 결과는 보증 최저/최고값이 아닙니다. `basis='min'`은 “최저 bin *기준* 추정”이며 보증최소 광도나 생산 수율 예측이 아닙니다. 중간 대표값 역시 제조사 typ가 아닙니다.

온도 곡선은 제공된 경우 `R_T(T)/R_T(25C)`를 추가로 곱하고 전류·온도 분리가능성 근사를 플래그로 표시합니다. 곡선 바깥의 forward 추정은 extrapolation 플래그가 붙습니다. **광도 목표 역산은 곡선의 수집된 점 구간만 탐색**하고 상승 구간을 차례로 확인하여 최초 달성 전류를 찾습니다. 단일 시험점 W는 역산을 하지 않습니다.

저항 역산은 `optical basis → I_target → 동일 DC topology solver → E-series → 실제 선정 저항의 optical` 순으로 진행합니다. `safe`(큰 저항) 반올림이 최소 광도 목표 미달로 이어질 수 있으므로 목표 달성을 재확인합니다.

### 목표 판정 (`src/core/goal.js`)

`evaluateGoal(point, intent)`는 저항 선정 모드와 검증 모드가 함께 쓰는 순수 함수입니다. 판정 기준은 둘 중 하나입니다.

- `minimum`: `achieved ≥ target` (상대 허용 1e-7). 초과는 충족이며 '정확 일치'를 뜻하지 않습니다.
- `approximate`: `|achieved − target| ≤ target × tolerancePct/100`. 초과도 허용 범위를 벗어나면 미달입니다.

`status`는 `met` / `missed` / `unavailable`(선택 기준을 모델이 표현하지 못함, 예: 광도 근거 없는 LED) / `not-computed`(동작점 없음)이며, 오차는 `achieved − target`과 target 대비 %로 함께 반환합니다.

`검증 모드에 적용`은 목표 intent와 적용 시점 구성(snapshot)을 보관합니다. 검증 모드는 snapshot의 결과를 재사용하지 않고 **현재 구성으로 다시 평가**하며, `goalDrift()`가 snapshot과 달라진 동작점 입력(토폴로지, LED, 부품 model ID, 전원, 저항, 구동 상태 등)을 나열합니다. 공차·정격·주변온도 입력은 동작점을 바꾸지 않으므로 목록에 넣지 않습니다.

`opticalUsageGuide()`는 초기 버전의 mcd 숫자 해석을 돕는 **비정량적 실무 가이드**이며 광도·정격 solver의 입력이 아닙니다. 상대 광도는 눈으로 느끼는 밝기와 일대일 대응하지 않으며 색·거리·시야각·주변조도·광학구조·PWM을 모델링하지 않습니다.

## 사용자 가정 독립 제어원과 canonical 검사 (이슈 #21)

`assumed:DC-Thevenin`은 사용자가 지정한 HIGH 전압(현재 UI의 VDD)과 `sourceResistance`를 사용합니다. LOW 0V, open-drain/Hi-Z/pull 의미는 GPIO 인터페이스 계약을 재사용하되 **실제 STM32G0B1 특성·정격을 차용하지 않습니다**. `driver-pin-current`/source/sink 예산의 한계는 null=unknown이며, 표시에는 `assumption:ideal-DC-control-source-no-rated-limits`가 붙습니다. 실제 MCU가 아닌 설정값이고 역급전·보호·전원 OFF·과도전류는 미모델링입니다.

`checkLimits()`는 기존 사용자 표시 이름 `id`와 별개로 `ruleId`, `instanceId`, `metric`, `unit`, `scope`, `basis`를 반환합니다. 회로 템플릿과 ledger의 `RGS_IN/RGS_OUT` 식별자를 동일하게 사용합니다. 동작점이 계산되지 않아도 각 회로의 정적 instance는 `buildInstanceViews()`에 존재합니다. 다른 Q1으로 무음 fallback하지 않습니다.

Nominal 검사와 `analyzeCorners()`의 sampled extrema 및 위반 witness는 **서로 다른 scope**이며, sampled에서 일부 실패한 경우 전체 범위가 검증된 것으로 표시하지 않습니다. Optical bin range(동일 전류의 광학 범위)와 optical sampled range(여러 전기 조건으로 달라진 범위)도 별도의 개념입니다. 독립 광도/mA 목표 draft를 저장하므로 단위를 바꾸거나 미지원 LED로 전환해도 숫자를 잘못 재사용하지 않습니다.

### 동작점 전압 예산과 구동 (`src/core/qpoint.js`)

`qPointSummary(point)`는 풀이가 이미 낸 동작점을 읽어 전압 루프로 묶습니다. 새 회로식을 만들지 않으며, 각 루프는 `rail = Σ 항`이고 `residual`을 함께 반환합니다.

| 토폴로지 | 부하 경로 (rail) | 구동 경로 |
|---|---|---|
| 저항 직결 | VLED = VRLED + n·Vf | — |
| GPIO Source | VDD = GPIO 출력 강하 + VRLED + n·Vf | (부하 경로에 포함) |
| GPIO Sink | VLED = VRLED + n·Vf + 핀 전압 | (부하 경로에 포함) |
| digital NPN / NPN 로우사이드 / NMOS 로우사이드 | VLED = VRLED + n·Vf + VCE 또는 VDS | 핀 = II·R1 + VBE / IB·RB + VBE / IRG·RG + VGS |
| NPN 에미터 팔로워 | VLED = VCE + VRLED + n·Vf (LED·RLED는 **IE**, VCE 항은 **IC**) | 핀 = IB·RB + VBE + VE |
| NPN 에미터 저항 전류 싱크 | VLED = VRLED + n·Vf + VCE + **IE·RE** | 핀 = IB·RB + VBE + VE |
| PNP / PMOS 하이사이드 (직접) | VLED = VEC 또는 VSD + VRLED + n·Vf | VLED = VEB + IB·RB + 핀 / VLED = VRGS + VRG + 핀 |
| NPN→PNP / NPN→PMOS / NMOS→PMOS | VLED = Q2 강하 + VRLED + n·Vf | ① 핀 = Q1 입력 루프 ② VLED = Q2 구동(VEB 또는 RGS_OUT) + Rdrive·j + Q1 VCE/VDS |

BJT 행에는 `IC`, `IB`, `IE`, 실제 `IC/IB`, 그 IC에서의 `hFE`(데이터시트 gain 곡선), 데이터시트 VCE(sat) 시험 `IC/IB`와 근거 figure·조건이 들어갑니다. BC847B는 VCE(sat) 곡선이 IC/IB=20, VBE(sat) 곡선이 IC/IB=10이라 `ratioMismatch`로 표시합니다. 활성 영역의 IC/IB는 hFE를 따르며, 에미터 팔로워·전류 싱크에서는 의도된 동작이므로 불량으로 판정하지 않습니다. **IC/IB 합격선(β≤10/20)은 없습니다.**

DTC 행은 네 값을 구분합니다. `IO/II`는 외부 단자 전류비(ROHM GI 및 IO/II=10 기준의 VO(on) 곡선과 같은 정의), `II`는 R1을 지나는 외부 입력 전류, `IB`는 R2로 빠지는 전류 `VBE/R2`를 뺀 내부 베이스 전류, `IC/IB`는 그 내부 베이스 기준 비율입니다. 기본 회로에서 II≈0.5441mA, IB≈0.5289mA, IO/II≈16.53, IC/IB≈17.01입니다.

OFF(전류 0)에서는 누설을 모델링하지 않고 소자 전압은 상한만 알 수 있으므로 분담과 구동비를 만들지 않고 안내만 표시합니다. 베이스 부유(Hi-Z, pull 없음)나 전압 도메인이 다른 OFF처럼 모델이 정하지 못하는 조건은 솔버가 `unsupported`로 거절하므로 요약 자체가 만들어지지 않습니다. 이 요약은 SPICE 수준의 전하 저장·과도 해석을 포함하지 않습니다.

### 경고 분류와 입력 연결 (`src/core/warnings.js`)

경고는 새 합격선을 만들지 않고, 정격 검사(`checkLimits`)와 sampled 위반 그룹을 분류해서 보여줍니다.

| 심각도 | 근거 | 범위 |
|---|---|---|
| `exceeded` 한계 초과 | 정격 검사가 `exceeded` | `nominal`은 계산한 동작점, `sampled`는 표본 시나리오 |
| `margin` 여유 부족 | 정격 검사가 `within`이고 `actual/limit`이 **사용자가 정한 기준(기본 90%)** 이상. 단위가 A·W·V인 항목만 (온도 비율은 의미가 없음). 기준을 비우면 끔 | nominal |
| `unknown` 정격 미확인 | 한계 데이터가 없어 검사하지 못함 | nominal |
| `approximation` 모델 근사 | 솔버 플래그(외삽, 근사, 미모델링) | — |

`margin`은 판정이 아니라 알림입니다. 기준을 바꿔도 정격 검사 결과(`within-entered-limits` 등)는 바뀌지 않고 동작점 입력도 아니므로 감도 분석 결과를 무효화하지 않습니다.

Sampled 초과는 `analyzeCorners()`의 `violationGroups`(규칙·소자별, **전체 표본 기준**이라 30개로 잘린 `violations`와 다름)로 만듭니다. 각 그룹은 초과한 시나리오 수와 최악 시나리오를 갖고, 화면에는 공칭과 달라진 축만 표시합니다. 일부 시나리오가 모델 적용범위 밖이면 "계산한 N개 기준이며 전체 범위의 보증이 아닙니다"를 함께 표시합니다.

`relatedInputs(check, config, view)`는 규칙별로 효과가 있는 입력을 가장 직접적인 것부터 나열하고, 현재 토폴로지가 실제로 보여주는 입력만 남깁니다. 검증 모드에서는 `RLED`, 선정 모드에서는 목표 전류/광도 입력이 같은 자리를 대신합니다. 예: RLED 전력 예산 → RLED 실제 정격 · 사용 비율 · RLED · VLED, 전류 싱크의 LED 전류 → RE 먼저, GPIO 합계 전류 → 다른 핀 합계 입력. 새 정격 규칙이 추가되면 `tests/warnings.test.js`가 매핑 누락을 잡습니다.

전력 예산(`powerBudget`)은 `예산 = 정격 × 사용 비율`, `필요 정격 = 기준 전력 ÷ 사용 비율`이며 기준 전력은 sampled peak가 있으면 그 값, 없으면 nominal입니다. Generic preset은 **정격 오름차순**으로 비교합니다(객체 키 순서로 순회하면 정수처럼 보이는 `1206`이 맨 앞에 와서 항상 1206을 추천하던 버그가 있었습니다).

### 감도 분석 실행 정책과 응답성

`analyzeCorners()`는 `planCorners()`(시나리오 격자와 축 정보) → `evaluateCorner()`(시나리오 1개) → `summarizeCorners()`(극값·위반·광도 범위)로 나뉘고, 한 번에 실행해도 같은 결과를 냅니다. 화면은 `src/ui/cornerRunner.js`가 약 12ms 단위로 UI 스레드를 양보하며 실행하고, 입력이 바뀌면 취소합니다.

- **기본 표본**(VLED·GPIO 전원·RLED·Vf 이동 각 3점, 최대 81개)은 입력이 250ms 멈추면 자동으로 계산합니다.
- **DTC 확장**(R1 배율·R2/R1 추가, 729개)은 직접 실행합니다.
- 결과 상태는 `unavailable`(동작점 없음) · `idle`(미실행) · `running`(계산 중, 진행률 표시) · `stale`(입력이 바뀌어 무효, 수동 모드) · `error` · `partial`(일부 조건 제외) · `complete`입니다. 이전 입력의 결과는 현재 값처럼 표시하지 않습니다.
- 결과에는 스윕한 축(`axes.swept`)과 공칭값으로 둔 조건(`axes.fixed`)이 들어 있어 Min/Max를 보증 worst case로 읽지 않게 합니다. 광도는 `opticalSpread`로 bin 범위(공칭 전류), 전기 조건 변동만(대표값 기준), 둘을 결합한 추정을 분리합니다.

**측정** (`node scripts/measure_sensitivity.mjs`, `python scripts/measure_ui_stall.py`; 이 개발 환경의 값이며 기기마다 다릅니다). 시나리오당 비용은 토폴로지마다 크게 다릅니다.

| 구성 | 시나리오 | 한 번에 계산 (중앙값) |
|---|---|---|
| 저항 직결 | 27 | 약 2ms |
| GPIO / digital NPN / NMOS / PMOS | 81 | 약 5–15ms |
| NPN 로우사이드 / PNP 하이사이드 / 레벨 시프트 | 81 | 약 17–39ms |
| **NPN 에미터 팔로워** | 81 | **약 240ms** |
| **NPN 에미터 저항 전류 싱크** | 81 | **약 380ms** |
| digital NPN + DTC 확장 | 729 | 약 110ms |

한 번에 동기 계산하면 에미터 팔로워·전류 싱크에서 입력을 멈출 때마다 UI가 0.25–0.35초 멈췄습니다(브라우저 측정: 최악 정지 254ms / 349ms). 시간 예산 방식으로 바꾼 뒤 같은 조작의 최악 정지는 약 33ms / 32ms(digital NPN은 38ms → 16ms)입니다.

모든 모드에서 정격 입력은 계산 결과 조건문 밖에서 렌더링하고, 빈칸은 0으로 강제 대체하지 않고 필드 오류 및 유효하지 않은 계산 상태로 취급합니다. JSON `schemaVersion:3`에서 `designIntent`과 `optical` 구조화 근거를 내보냅니다.
