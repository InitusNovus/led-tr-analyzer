# 검증 범위와 재현 방법

## 검증 계층

1. `tests/math.test.js`: 유한 입력, 선형/로그 보간, 외삽 정책, 잘못된 곡선, 수렴 실패, E24/E96 decade 경계와 정확 일치.
2. `tests/models.test.js`: 카탈로그 근거 필드, LED 기준점/광학/저전류 tail, DTC 외부 II와 내부 IB, GPIO 한계점 근사, MOSFET 곡선/약한 구동/외삽.
3. `tests/circuits.test.js`: 13개 회로의 양의 동작점/전력 수지, ON/OFF, 베이스 구동 부족, 팔로워 IC/IB/IE, 고전압 OFF 미지원, 정격을 넘는 결과가 잘리지 않는지, 코너 witness, 저항 역산 round-trip.
4. `tests/ui-contract.test.js`: 13개 circuit template의 소자 집합과 주요 단자 연결을 독립 fixture로 검사합니다. GPIO Sink가 GND로 잘못 끝나지 않는지, follower/current sink의 C/E 의미, 복합 Q1/Q2 존재 등을 확인합니다.
5. `scripts/browser_smoke.py`: 실제 production bundle을 HTTP `/led-tr-analyzer/` 경로에서 조작합니다. 13개 회로·ON/OFF/미지원 전압도메인, 실제 품번 선택, KT 온도 복구, 숨은 입력, 전체 초기화, 모바일 로컬 회로 스크롤·글자 크기, 처리되지 않은 브라우저 오류를 검사합니다.

이 테스트는 **계산 구현의 정합성과 제품 동작**을 검증합니다. 그래프 수동 추출 오차, 제조 편차, 실제 PCB와 소자의 물리적 정확도 검증을 대체하지 않습니다. 카탈로그 기준점 테스트도 입력 데이터를 다시 재현하는 검사이지 독립적인 실측 검증이 아닙니다.

## 실행

```sh
npm ci
npm test
npm run test:coverage
npm run build
python -m pip install -r scripts/requirements-browser.txt
python -m playwright install --with-deps chromium
npm run test:browser
```

CI는 Node24에서 lockfile을 이용해 설치하고 위 경로를 실행합니다. 브라우저가 실제 `/led-tr-analyzer/`에서 production asset을 가져오는지 검사합니다. 결과 스크린샷/JSON은 workflow artifact로 보존합니다. Pages deployment는 main에서만 별도 실행합니다.

로컬 검증 환경의 Chromium은 localhost 이동을 관리 정책으로 차단했습니다. 정책을 변경하지 않고 `BROWSER_INLINE=1` 모드로 번들의 DOM 렌더와 상호작용을 검사했습니다. 이 결과는 HTTP subpath 검증과 구별하며, HTTP 모드는 GitHub Actions에서 검사합니다. 두 모드는 로그의 `mode` 필드로 구분됩니다.

## 재발 방지 이슈

- #2: 입력/E-series/동일 코너 전력/실제 구동 결합.
- #3: 데이터시트 근거와 근사·미검증 값 분리.
- #4: lockfile, dev/PR CI, production build, 브라우저 검증.
- #6: 극소 전류의 잔차와 최종 전력 수지 검사. 저전압/근단락 416조건에서 성공 결과의 일관성 및 실패 상태의 명시적 반환.
- #5: 결과 없는 상태에서 cornerSnapshot을 읽어 React가 비는 오류. 존재 여부 검사, 미지원 상태에서 복구, root error boundary.

## 리뷰 시 직접 확인할 것

- 기본 디지털 NPN에서 GPIO LOW를 선택하면 LED 전류가 0이고 OFF 근사/전압 상한을 표시하는가.
- 에미터 팔로워의 emitter current와 collector/base current가 일치하는가.
- NPN base 저항을 키우면 실제 부하 전류와 TR 발열이 함께 바뀌는가.
- KT R/G/B/YG/O의 원문 곡선/정격이 표시되고, 단일 typ 광도 anchor가 없는 경우 “광학 근거 없음”이 아니라 원문 범위와 null 사유를 구분하는가.
- NPN을 MMBT3904LT1G↔BC847B, NMOS를 2N7002↔BSS138BKW로 바꾸면 회로도 품번·동작점·정격·export가 같은 모델로 함께 바뀌는가.
- 숫자를 비우거나 목표 전류에 0을 넣어도 화면이 복구 가능한가.
- 코너 분석 후 입력을 바꾸면 이전 결과를 새 설정의 결과로 보여주지 않는가.
- dev/PR에서 live 사이트를 배포하지 않는가.

완료된 테스트 숫자와 CI 실행 링크는 PR에 기록합니다. 소스 변경과 무관하게 과거의 통과 로그를 최신 상태로 표시하지 않습니다.


## PR #9~#15 추가 회귀 목적

- #10: KT curve LED의 온도 capability 누락은 ErrorBoundary가 아니라 `not-modeled:LED-temperature`로 국소 처리하고 다시 25°C로 복구 가능해야 합니다.
- #11: 현재 토폴로지에서 쓰지 않는 빈 RB/RE/RG draft가 다른 회로를 막지 않아야 하며, 전체 초기화는 sizing 옵션과 DTC 감도 옵션까지 초기값으로 돌립니다.
- #12: exact model ID가 forward/역산/checkLimits/corner/export까지 동일하게 전달되고 family mismatch는 typed input error가 됩니다.
- #13: 회로 심볼은 B/C/E와 G/D/S, GPIO port, LED A/K, 복합 Q1/Q2 및 주요 bias 저항을 읽을 수 있어야 합니다. 단순 `NPN` 텍스트 박스를 성공으로 보지 않습니다.
- #14: 회로 선택·부품 선택·소자 inspector·소자별 결과·datasheet 근거를 같은 instance/model snapshot에서 읽을 수 있어야 합니다.
- #15: 수치 coverage와 별개로 실제 브라우저 조작과 회로 의미 fixture를 통과해야 합니다.


## #20/#21 실사용 흐름 회귀 (2026-10)

기존 topology/수치 CI 외에 `tests/optics.test.js`, `tests/ui-contract.test.js`, `scripts/browser_smoke.py`는 다음을 검증합니다.

- KENTO R/G/B/YG/O의 min/max 시험점 복원 및 `nominalMcd=null` 유지
- 절대 광도 시험전류와 relative 곡선 정규화 구분 (KT-G 5mA→20mA)
- 광도 상승/비단조 곡선의 유효 범위 내 최초 역산, `out-of-domain` 및 미지원 typed error
- W 단일 시험점만 지원, Y 시험전류 미확인 유지, 25°C 외 광학 조건에서 가정 표시
- 선정된 E-series 저항으로 실제 목표 광도 또는 전류를 **재검증**
- 광도 usage guide는 전기·정격 계산과 독립이며, range에 걸치는 여러 밴드를 표시
- mA/mcd 목표값 보존, 다른 LED로 바꿔 광도 불가일 때 원래 mA를 유지
- resistorRating/auxRating/derating/ambient 입력 오류 발생 후 **같은 필드에서 수정 가능**
- 계산 실패 중에도 정적 instance 유지, Q1.R1/2 및 RGS_IN/OUT canonical 식별
- `checkLimits`가 ruleId/instanceId/unit/scope를 포함하고 같은 inspector에 연결
- nominal 통과 + sampled 초과를 같은 설계 요약에서 **범위를 구별해** 표시
- 13개 토폴로지(변형 6종)에서 부하 경로와 구동 경로의 KVL 잔차가 1e-6 V 이하이고, 전력 수지 잔차도 함께 맞는지 확인 (`tests/qpoint.test.js`)
- DTC 기본 회로에서 II≈0.5441mA, IB≈0.5289mA, 외부 IO/II≈16.53, 내부 IC/IB≈17.01이 함께 표시되고 서로 다른 값인지 확인
- 에미터 팔로워는 LED에 IE, VLED 공급에 IC를 표시하고, 전류 싱크의 RE 전압이 IE×RE인지 확인 (IC×RE가 아님)
- 2단 하이사이드는 GPIO→Q1 입력 경로와 Q2 구동 경로가 별도 루프로 나뉘는지 확인
- OFF 상태에서 전압 분담·구동비를 만들어 내지 않고, 모델이 판정하지 못하는 조건은 솔버가 거절하는지 확인
- BJT에 β 합격선이 없고 활성 영역을 불량으로 표시하지 않는지, 근거 figure와 시험 IC/IB가 모델별로 맞는지 확인
- 이슈 #26 기준 사례(RLED 220Ω, 0402 62.5mW, 사용 비율 0.7)에서 Nominal 37.17mW / 예산 43.75mW / Sampled 최대 46.51mW가 나오고, 81개 중 10개 조건 초과와 최악 조건(VLED 5.25V, GPIO 전원 3.399V, RLED 217.8Ω, Vf 이동 −0.1V)이 표시되는지 확인
- 모든 정격 규칙(13종)이 해당 토폴로지에 실제로 존재하는 입력으로 연결되고(숨은 입력으로 연결 금지), 규칙·모드별로 첫 입력이 맞는지 확인 (`tests/warnings.test.js`)
- 여유 경고가 사용자가 정한 기준에서만 나타나고(기준을 올리거나 비우면 사라짐) 한계 초과와 섞이지 않는지, 온도 같은 비율이 무의미한 항목에는 나오지 않는지 확인
- 경고를 눌러 입력을 고친 뒤 sampled 경고가 사라지는지, preset 적용이 정격만 바꾸고 사용 비율을 바꾸지 않는지 확인
- 기본 설계에서 nominal 전류와 sampled 최소·최대가 같은 요약에 표시되고, 값이 극값 witness 시나리오로 재현되는지 확인 (`tests/sensitivity.test.js`)
- 스윕한 축과 스윕하지 않은 조건(RB/RE, 온도, 전형 곡선, DTC 내부 공차)이 결과에 함께 나오는지 확인
- 일부 조건이 모델 적용범위 밖(예: GPIO VDD 3.5V ±5%)이면 `partial`로 제외 개수와 이유를 표시하고 전체 통과 문구가 나오지 않는지 확인
- 입력 변경 시 이전 sampled 결과를 현재 값처럼 보이지 않고(`stale`), 계산 중·실패·미실행을 구별하는지 확인
- 광도 bin 범위, 전기 조건 변동만, 결합 추정이 서로 다른 값으로 표시되는지 확인
- 별도의 사용자 가정 5V 제어원과 실제 STM32 GPIO 제한을 구분
- 모바일에서 핵심 회로 소자가 가로 스크롤 초기 위치에 보이는지 확인
- JSON v4 export에서 exact 부품 model ID, 독립 목표값, structured optical 결과, 적용한 목표와 구성 snapshot, 화면과 같은 판정을 확인
- KT-0805R '최저 bin 40mcd' → E24 선택 → 적용 → 검증 후 같은 목표·기준·실제 mcd·차이·판정이 남는지 확인 (`closest`/`safe`/`bright` 포함)
- 적용 뒤 VLED·RLED·LED를 바꾸면 달라진 항목이 표시되고, 광도 근거 없는 LED로 바꾸면 합격 표시 없이 '평가할 수 없음'이 되는지 확인
- 최소 목표 기준과 허용 오차 기준이 서로 다른 문구로 판정되는지 확인

**범위:** CI의 sampled grid는 지정한 입력 공차 축을 표본화한 것입니다. 반도체 생산 분포·모든 thermal corner·광학 bin 조합의 보증 worst case가 아닙니다. SVG 스크린샷과 coverage는 테스트 산출물이며 실측/제조승인이 아닙니다.
