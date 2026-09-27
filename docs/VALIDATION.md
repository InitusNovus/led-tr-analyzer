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
