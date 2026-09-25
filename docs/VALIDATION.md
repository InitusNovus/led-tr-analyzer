# 검증 범위와 재현 방법

## 검증 계층

1. `tests/math.test.js`: 유한 입력, 선형/로그 보간, 외삽 정책, 잘못된 곡선, 수렴 실패, E24/E96 decade 경계와 정확 일치.
2. `tests/models.test.js`: 카탈로그 근거 필드, LED 기준점/광학/저전류 tail, DTC 외부 II와 내부 IB, GPIO 한계점 근사, MOSFET 곡선/약한 구동/외삽.
3. `tests/circuits.test.js`: 13개 회로의 양의 동작점/전력 수지, ON/OFF, 베이스 구동 부족, 팔로워 IC/IB/IE, 고전압 OFF 미지원, 정격을 넘는 결과가 잘리지 않는지, 코너 witness, 저항 역산 round-trip.
4. `scripts/browser_smoke.py`: production bundle에서 13개 회로 전환, ON/OFF, Hi-Z/부유 베이스, 입력 오류 복구, legacy 프리셋, 저항 선정/적용, 코너 결과, JSON 저장, 모바일 overflow, 처리되지 않은 브라우저 오류.

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
- KT 프리셋은 미검증으로 보이고 mcd는 없는가.
- 숫자를 비우거나 목표 전류에 0을 넣어도 화면이 복구 가능한가.
- 코너 분석 후 입력을 바꾸면 이전 결과를 새 설정의 결과로 보여주지 않는가.
- dev/PR에서 live 사이트를 배포하지 않는가.

완료된 테스트 숫자와 CI 실행 링크는 PR에 기록합니다. 소스 변경과 무관하게 과거의 통과 로그를 최신 상태로 표시하지 않습니다.
