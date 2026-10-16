# 글꼴

앱은 글꼴을 직접 배포(self-host)합니다. 외부 CDN을 쓰지 않으므로 오프라인·사내망에서도 같은 글꼴로 보이고, OS마다 한글이 다른 fallback 글꼴로 그려지던 문제(#40)가 없습니다.

| 용도 | 글꼴 | 라이선스 | 공급 |
|---|---|---|---|
| 영문·숫자·단위 | JetBrains Mono (variable, 굵기 100–800) | OFL 1.1 | `@fontsource-variable/jetbrains-mono` |
| 한글 | Pretendard (variable, 동적 subset 92개) | OFL 1.1 | `pretendard` |

- 글꼴 스택은 `src/index.css`의 `--mono` 한 곳에 있습니다. 회로도(SVG) 글자도 같은 토큰을 씁니다. 두 글꼴에 없는 글리프는 시스템 monospace로 내려갑니다 (현재 `ⓘ ▸ ▾`).
- 글꼴 라이선스 전문은 사이트와 함께 `/fonts-license.txt`로 배포됩니다 (`public/fonts-license.txt`).
- 합자(`->`, `>=` 등)는 끄고 (`font-variant-ligatures: none`) 입력한 문자 그대로 보입니다.

## 비교와 선택

같은 화면에서 비교한 후보: 이전 시스템 스택, JetBrains Mono + Pretendard, IBM Plex Mono + Plex Sans KR, D2Coding, Pretendard 단독.
- JetBrains Mono + Pretendard를 고른 이유: 숫자·단위는 고정폭이라 표와 결과 띠에서 정렬이 유지되고, 한글은 가독성 높은 산세리프로 보이며, 메인페이지의 모노스페이스 정체성도 유지됩니다.
- D2Coding은 한글까지 고정폭이지만 글자가 작고 가늘어 보이고 파일이 큽니다 (subset 357KB). Pretendard 단독은 깔끔하지만 모노스페이스 느낌이 사라집니다. IBM Plex 조합은 JetBrains 조합과 비슷했고 한글 서브셋 용량이 훨씬 큽니다.
- 전후 화면: `docs/assets/fonts-before-after-desktop.png`, `docs/assets/fonts-before-after-mobile.png` (왼쪽 = 이전 시스템 스택, 오른쪽 = 새 글꼴. 왼쪽은 촬영 환경의 fallback 글꼴이라 OS에 따라 다르게 보였던 상태의 한 예입니다).

## 용량 (첫 화면, 데스크톱 1365px)

- 이전: 글꼴 전송 0 바이트, 대신 OS별 fallback.
- 이후: 약 440KB (JetBrains Mono latin 39KB + greek 8KB, Pretendard 조각 14개 약 390KB). Pretendard는 화면에 나온 글자가 속한 조각만 내려받고, 이후 방문은 브라우저 캐시를 씁니다. 배포물(dist)에는 조각 전체(약 3.6MB)가 들어 있지만 쓰지 않은 조각은 전송되지 않습니다.
- `font-display: swap`이라 글꼴이 오기 전에는 시스템 글꼴로 먼저 보이고 도착하면 바뀝니다.

## 회로도 글자 폭

`src/ui/schematic.js`의 `textWidth()`는 영문·숫자 0.6em, 한글 1em으로 폭을 추정합니다. 새 글꼴에서 실제 폭 / 추정 폭의 최대값은 1.0이어서(13개 토폴로지, 값 표기 전체 단계) 추정이 실제보다 작지 않고, 겹침 검사(`tests/schematic.test.js`, 브라우저 G13의 390px 검사)가 그대로 유효합니다.

## 검증

- 브라우저 smoke BASE: 두 글꼴이 subpath에서 로드되고 실패한 글꼴이 없으며 본문과 회로도 글자가 같은 토큰을 쓰는지 확인. Pretendard import를 일부러 빼면 이 검사가 실패합니다.
- 확인한 환경은 Chromium(Linux)뿐입니다. 글꼴을 직접 배포하므로 글자 폭이 OS에 의존하지 않지만, Windows/macOS/모바일 브라우저에서의 실제 모습은 아직 사람이 확인하지 않았습니다.
