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
| KT-0805Y | C2296 | LCSC/JLCPCB 원문 표 확인, curve는 이번 PR에서 미 digitize | Vf 1.8–2.4V @10mA; IV 70–175mcd @20mA; IF 25mA; Pd 40mW |
| KT-0805O | C110371 | Hubei KENTO A.0, 2018-12-06; p.5 curve 수동 추출 | Vf 1.8–2.4V @10mA; IV 70–175mcd @20mA; IF 25mA; Pd 40mW |
| KT-0805W | C34499 | C34499-associated KENTO A3, 2017-05-16을 pin | Vf 2.6–3.2V @5mA; IV typ 350mcd @5mA; IF 25mA; Pd 80mW |

R/G/B/YG/O는 같은 원문에 실린 Typical Electrical-Optical Characteristics Curves를 거칠게 수동 판독하여 `manual-curve`로 사용합니다. 곡선은 전형값이며 생산 분포의 보증곡선이 아닙니다. R/YG/O의 p.3 Vf 행은 10mA인데 p.4 voltage-bin 표는20mA이므로 서로 다른 시험조건으로 따로 저장합니다.

Y는 source/table은 확인했지만 이번 audit에서 같은 원문의 characteristic curve를 안정적으로 digitize하지 못했습니다. 따라서 `datasheet-table-only`로 두고 1.8–2.4V 범위의 가운데 2.1V를 **명시적 계산 가정**으로만 사용합니다. 해당 시험전류에서 벗어나면 외삽 플래그를 냅니다.

White C34499는 웹의 다른 mirror에 같은 제품명/비슷한 revision을 가진 사본이 있으나 Pd, IF 및 광학 시험조건이 C34499-associated LCSC 문서와 충돌합니다. 이 모델은 **LCSC에 직접 연결된 A3 2017-05-16 문서**만 pin하고 다른 mirror의 숫자를 합치지 않습니다. 동일 source의 current-dependence curve를 이번 PR에서 확인하지 못했으므로 Vf는 2.6–3.2V의 midpoint 2.9V를 명시적 table-only 가정으로 사용하고, 광도 350mcd는 정확히5mA/25°C 시험점에서만 반환합니다.

R/G/B/YG/Y/O의 데이터시트 광도는 min/max bin 범위이고 단일 typ 절대광도가 아닙니다. 상대 광도 곡선은 보관하더라도 그 범위를 임의의 midpoint “typ mcd”로 바꾸지 않으며, 현재 UI의 scalar mcd 출력은 `null`입니다. 추후 bin 선택/범위 출력 UI를 별도 구현할 수 있습니다.

## 수학 모델의 구현 선택

### LED와 광학

정상 구간의 Vf는 수동 곡선 점을 구간별 보간합니다. 첫 유효 전류보다 작은 구간에는 처음 두 점에 연결되는 로그 형태의 tail을 사용하며 **외삽**으로 표시합니다. 원점의 임의 직선이 저전류 LED를 수백 Ω의 저항처럼 만들지 않도록 하기 위한 선택이지 측정 데이터가 아닙니다. 상한 밖에서는 끝 구간 연장과 외삽 경고를 사용합니다.

APT2012SURCK의 −1.9mV/°C는 20mA에서의 값입니다. 전체 곡선에 적용한 온도 보정은 근사로 표시합니다. 광도 230mcd는 p.1의 **별표 없는** 광도 기준이며, CIE127-2007 별표의 80mcd 값과 혼합하지 않습니다. 상대 광도 곡선과 온도 곡선의 곱 역시 분리 가능하다는 근사입니다. 출력은 LED 하나의 추정 광도이며 사람의 체감 밝기나 직렬 LED 전체 광도의 합이 아닙니다.

### 일반 BJT

공개된 활성영역 gain/VBE와 특정 IC/IB 비율의 VCEsat/VBEsat를 연결합니다. 포화 기준점과 활성영역 사이에서 유효 gain을 로그 보간하는 **명시적 bridge**를 사용합니다. 더 강한 베이스 구동 구간의 연장도 근사입니다. 이것은 출력 곡선 전체를 독립적으로 측정해 만든 surface가 아닙니다.

입력 구동과 부하를 함께 풀기 때문에 구동 부족이 실제 LED 전류·VCE·발열을 바꿉니다. IC, IB, IE를 분리하고 에미터 팔로워의 LED 전류는 IE=IC+IB로 계산합니다. 활성영역 데이터의 VCE 조건에서 멀어진 효과와 온도 의존성을 모두 재현하지는 않습니다. 25°C 밖의 BJT 계산은 온도 미모델링을 표시합니다.

### 디지털 TR

DTC043ZEB의 Fig.4 GI는 **외부 IO/II**입니다. 내부 IC/IB로 대입하지 않습니다. Fig.5의 VO(on)도 IO/II=10에서만 직접 확보된 곡선입니다. 두 특성을 잇는 출력 전압 bridge는 모델 가정입니다.

내부 VBE는 5mA에서 0.7V, 전류 decade당 60mV의 로그 근사를 사용합니다. 이는 ROHM에서 추출한 VBE 곡선이 아닙니다. R1의 0.7~1.3배와 R2/R1=8~12를 적용하며 R2를 비율로 유도합니다. II, 내부 IB, R2 전류를 따로 계산하고 내부 저항 손실도 패키지 전력에 포함합니다.

### GPIO

8mA/0.4V와 15mA/1.3V는 지정 조건의 한계점입니다. 이를 잇는 곡선은 보수적 시나리오를 위한 **limit-derived approximation**, 실제 typ 출력저항 곡선이 아닙니다. 전류 사이의 연결까지 제조사가 보증하는 것은 아닙니다.

핀 종류와 VDD 범위를 제한합니다. VDD=0, 보호 다이오드 주입/역급전, 부유 핀의 누설은 재현하지 않습니다. 계산할 수 없는 상태는 `unsupported`로 반환합니다. Open-drain HIGH는 Hi-Z로 처리하며, 사용자가 넣은 pull 저항만 분석합니다. 포트 합산 전류는 사용자가 입력한 나머지 핀 부하를 더한 값이고 MCU 전체 VDD/VSS 소비전류 검사는 아닙니다.

### MOSFET

출력 곡선의 VDS축과 VGS 곡선 사이를 보간합니다. 가장 낮은 VGS보다 약한 구동에서는 전달 곡선으로 출력 곡선의 크기를 조정한 **shape approximation**을 사용합니다. VGS(th)로 스위치를 ON/OFF하거나 정격 ID에서 전류를 자르지 않습니다.

Body diode, 역방향 동작, Miller/게이트 전하, 자가발열/SOA, 실제 누설은 해석하지 않습니다. 25°C 밖의 전기 특성은 온도 미모델링 경고가 붙습니다. 2N7002의 Tsp 기준 0.83W를 ambient 정격으로 사용하지 않고 자료의 RthJA 기준 열 예산을 별도로 계산합니다.

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
