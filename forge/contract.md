# 게임 모듈 계약서 (양산 에이전트용)

너는 YJ 아케이드에 들어갈 캐주얼 게임 **하나**를 만든다. 대상 플레이어는 8세 숙련 게이머(마리오 월드를 혼자 클리어하는 수준)다. 유아용으로 만들지 마라.

## 절대 규칙

1. 게임 하나 = 파일 하나. `src/games/<id>.js`. `id`는 파일명과 정확히 같아야 한다.
2. 외부 라이브러리·이미지·오디오 파일 금지. 그림은 Canvas 2D 코드, 소리는 `api.audio`.
3. 색은 `src/core/draw.js`의 `PALETTE`만 쓴다.
4. 화면은 항상 960 × 640. 좌표를 하드코딩해도 되지만 이 범위를 벗어나면 안 된다.
5. `render(ctx)`는 **그리기만** 한다. 상태 변경, `onScore`, `onGameOver` 호출 금지.
6. `dispose()`는 만든 타이머·리스너를 전부 정리한다.
7. 순수 규칙(충돌·점수·승패)은 named export로 빼서 테스트 가능하게 만든다.
8. UI 텍스트는 한글.

## 모듈 형태

```js
export default {
  id, title, tags, players, color, controls, scoreOrder, scoreLabel, archived: false,
  icon(ctx, size) {},   // 메뉴 타일 아이콘. (0,0)~(size,size)에 그린다
  init(api) {},         // this.api = api 로 저장하고 상태 초기화
  update(dt) {},        // dt는 초. 고정 1/60
  render(ctx) {},       // this.api.draw 헬퍼 사용
  dispose() {},
}
```

필수 vs 선택 (`src/shell/registry.js`의 `validateGame`이 실제로 강제하는 것):

- **필수**: `id`(파일명과 동일), `title`(빈 문자열 아님), `tags`(아래 목록 중 1개 이상), `players`(1 또는 2), `color`.
  - `color`는 **항상** `#rrggbb` 형식의 문자열이어야 한다(대소문자 무관, 정규식 `/^#[0-9a-f]{6}$/i`). `controls`/`scoreOrder`와 달리 생략 불가 — 미지정이면 검증에서 즉시 탈락한다. `PALETTE`의 값(이미 `#rrggbb` 형식)을 그대로 쓰면 된다.
  - `players`가 2면 `tags`에 `versus`가 반드시 있어야 한다.
- **선택 (생략 시 셸이 기본값을 채움)**: `controls`(기본 `pointer`), `scoreOrder`(기본 `high`), `scoreLabel`(기본 `점수`), `archived`(기본 `false`). 값을 넣을 거면 아래 허용 목록 안이어야 한다 — 목록 밖 값은 생략과 달리 에러가 된다.
- `icon`, `init`, `update`, `render`, `dispose` 다섯 함수는 전부 필수다.

- `tags`: action | puzzle | defense | sports | quiz | versus 중 하나 이상
- `players`: 1 또는 2. **2면 tags에 versus를 반드시 포함**
- `controls`: pointer | dpad | dpad+a | versus — 셸이 이걸 보고 터치 오버레이를 그린다
- `scoreOrder`: high(클수록 좋음) | low(작을수록 좋음)

## 순수 규칙 / 계약 객체 분리 패턴

`default export`는 얇은 래퍼로만 쓰고, 충돌·이동·점수·승패 판정 같은 순수 로직은 파일 상단에 **named export 함수**로 따로 뺀다. `default` 객체의 `update()`는 그 함수들을 불러 쓰고 `this.api`로 부수효과(사운드·파티클·onScore·onGameOver)만 처리한다. 이렇게 나눠야 `tests/games/<id>.test.js`가 `api`나 캔버스 없이 순수 함수만 직접 호출해서 테스트할 수 있다.

예시 (`src/games/neon-snake.js`): `createSnakeState()`, `turn(s, dx, dy)`, `stepSnake(s, spawnFood)`가 named export고, `default.update(dt)`는 이 함수들을 호출한 뒤 결과(점수 증가·사망)에 따라 `this.api.audio`/`this.api.juice`/`this.api.onScore`/`this.api.onGameOver`를 부른다.

예시 (`src/games/crossy-robot.js`): `makeLane()`, `createCrossyState()`, `advanceCars(state, dt)`, `laneHit(lane, col)`, `movePlayer(state, dcol, dlane, rng)`가 named export다.

## api

```js
api.w, api.h                 // 960, 640
api.input.p1 / p2            // { x, y, a, aHeld, b, bHeld } — x/y는 -1..1, y는 아래가 +
api.input.pointer            // { x, y, down, pressed, released } — 논리 좌표
api.draw                     // clear, rect, roundRect, circle, line, text
api.audio                    // beep(freq, ms, type), sweep(from, to, ms, type), noise(ms)
api.juice                    // shake(mag, dur), burst(x, y, opts), hitstop(sec)
api.rng                      // next(), int(n), range(a,b), pick(arr), chance(p)
api.onScore(n)               // 점수가 바뀔 때
api.onGameOver({ score })    // 끝났을 때 한 번. 2인이면 { score, winner: 1|2 }
```

**Math.random을 쓰지 말고 `api.rng`를 써라.** 테스트 재현성이 깨진다.

## 모범 예시

- `src/games/neon-snake.js` — 격자·턴제
- `src/games/crossy-robot.js` — 연속시간·이동체 충돌

## 제출 전 반드시 통과해야 하는 것

```bash
npx vitest run tests/contract.test.js       # 공통 계약 (전 게임 자동)
npx vitest run tests/games/<id>.test.js     # 네가 쓴 규칙 단위 테스트
```

`tests/contract.test.js`는 모든 게임에 자동으로 다음을 검사한다: 아이콘이 실제로 그려지는지, 60초를 돌려도 안 터지는지, 보고하는 점수가 항상 유한한 숫자인지, `render()`가 상태를 바꾸지 않는지(두 번 그려도 같은 호출), `dispose()`가 만든 타이머를 다 정리하는지, 같은 시드·입력으로 다시 `init()`하면 완전히 같은 결과가 나오는지(모듈 스코프에 상태가 새면 안 됨).

규칙 단위 테스트를 `tests/games/<id>.test.js`에 함께 작성한다. 최소 5개 — 초기 상태, 정상 진행, 점수 획득, 패배 조건, 경계값.

## 재미 기준 (이걸 못 넘기면 반려)

- 한 판이 30초~3분 안에 끝난다
- 시작 5초 안에 뭘 해야 하는지 조작만으로 알 수 있다 (설명 화면 금지)
- 점수가 오를 때와 죽을 때 소리·파티클·흔들림이 반드시 있다
- 진행할수록 빨라지거나 조밀해진다 (고정 난이도 금지)
