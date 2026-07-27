# YJ 아케이드 — 단계 A(뼈대) + B(금형 검증) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오프라인 PWA 게임 허브의 뼈대(코어 엔진 + 셸 + 계약 테스트)를 만들고, 손으로 만든 게임 2개로 "게임 1개 = 파일 1개" 계약이 실제로 통하는지 검증한다.

**Architecture:** 셸은 개별 게임을 모른다. `src/games/*.js`를 `import.meta.glob`으로 자동 수집하고, 각 모듈은 고정된 계약(`init/update/render/dispose`)만 지킨다. 코어(`loop/input/draw/audio/juice/rng/storage`)는 게임에 `api` 객체로 주입된다. 모든 게임은 공통 계약 테스트를 통과해야 메뉴에 오른다.

**Tech Stack:** 바닐라 JS (ES 모듈), HTML5 Canvas 2D, Vite 5, Vitest 2, jsdom. **런타임 의존성 0개.**

**범위 밖:** 단계 C(나머지 22개 양산), 단계 D(정예 3개 + AI 아트). 스펙 `docs/superpowers/specs/2026-07-27-yj-arcade-design.md` 참조.

## Global Constraints

- 작업 디렉터리는 `/Users/junghakjun/ai_work/game/100game`. 모든 경로는 이 폴더 기준.
- 런타임 의존성 0개. `package.json`의 `dependencies`는 비어 있어야 한다. devDependencies는 `vite ^5.4.0`, `vitest ^2.1.0`, `jsdom ^25.0.0`만.
- 논리 해상도는 **960 × 640 고정**. 물리 캔버스는 레터박스로 스케일. 게임은 항상 `api.w === 960`, `api.h === 640`으로 그린다.
- 이미지·오디오 **파일 0개**. 모든 그래픽은 Canvas 2D 코드, 모든 소리는 WebAudio 합성.
- 색은 `src/core/draw.js`의 `PALETTE`에 있는 값만 쓴다. 하드코딩 색상 금지.
- UI 텍스트는 한글.
- 게임 1개 = `src/games/<id>.js` 파일 1개. `id`는 파일명(확장자 제외)과 정확히 일치.
- 고정 타임스텝 `dt = 1/60`. `update(dt)`의 dt는 초 단위.
- 커밋 메시지는 `feat(arcade): ...` / `test(arcade): ...` / `chore(arcade): ...` 형식이며 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`을 넣는다.
- 브랜치는 `feat/yj-arcade` (이미 생성됨).

## 게임 모듈 계약 (전 태스크 공통 참조)

```js
export default {
  id: 'neon-snake',        // 파일명과 동일, kebab-case
  title: '네온 스네이크',
  tags: ['action'],        // action | puzzle | defense | sports | quiz | versus 중 1개 이상
  players: 1,              // 1 | 2
  color: '#39f6ff',        // PALETTE 값
  controls: 'dpad',        // pointer | dpad | dpad+a | versus
  scoreOrder: 'high',      // high | low
  scoreLabel: '점수',
  archived: false,

  icon(ctx, size) {},      // 메뉴 타일 아이콘 (0,0)~(size,size) 안에 그림
  init(api) {},            // 상태 생성. api 저장
  update(dt) {},           // 로직만
  render(ctx) {},          // 그리기만. 상태 변경·콜백 호출 금지
  dispose() {}             // 타이머·리스너 정리
}
```

주입되는 `api`:

```js
{
  w: 960, h: 640,
  input,      // { p1, p2, pointer } — 아래 Task 8 참조
  draw,       // Task 5
  audio,      // Task 6
  juice,      // Task 7
  rng,        // Task 3
  onScore(n),      // 점수 보고 (유한한 숫자)
  onGameOver(res)  // { score, win?, winner? }
}
```

## File Structure

| 파일 | 책임 |
|---|---|
| `package.json`, `vite.config.js`, `index.html` | 워크스페이스·번들·캔버스 부트스트랩 |
| `src/core/loop.js` | 고정 타임스텝 루프 (기존 코드 이식) |
| `src/core/rng.js` | 시드 가능한 난수 |
| `src/core/storage.js` | localStorage 래퍼 (JSON, 실패 무해) |
| `src/core/draw.js` | 팔레트 + 네온 도형·텍스트 헬퍼 |
| `src/core/audio.js` | WebAudio 합성 효과음 |
| `src/core/juice.js` | 화면 흔들림·파티클·히트스톱 (스크린 스페이스) |
| `src/core/input.js` | 키보드·게임패드·터치 → p1/p2 패드 + 포인터 |
| `src/shell/registry.js` | 게임 모듈 수집 + 계약 검증 (순수 함수) |
| `src/shell/records.js` | 최고기록·플레이 횟수 |
| `src/shell/session.js` | 게임 마운트/언마운트, 일시정지, 결과 처리 |
| `src/shell/menu.js` | 메뉴 레이아웃·타일·탭 히트테스트 |
| `src/main.js` | 결선 + 캔버스 스케일링 + SW 등록 |
| `src/games/neon-snake.js` | 게임 (금형 검증 1) |
| `src/games/crossy-robot.js` | 게임 (금형 검증 2) |
| `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-180.png` | PWA |
| `forge/contract.md`, `forge/catalog.json` | 양산 에이전트용 계약서·큐 |
| `tests/**` | 계약 테스트 + 단위 테스트 |

---

### Task 1: 워크스페이스 부트스트랩

**Files:**
- Create: `100game/package.json`, `100game/vite.config.js`, `100game/index.html`, `100game/.gitignore`, `100game/src/main.js`
- Test: `100game/tests/bootstrap.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `npm test`, `npm run dev`, `npm run build`가 동작하는 워크스페이스. 논리 해상도 상수 `LOGICAL_W = 960`, `LOGICAL_H = 640`은 Task 14에서 `src/main.js`에 정의된다.

- [ ] **Step 1: 파일 4개 생성**

`100game/package.json`:
```json
{
  "name": "yj-arcade",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

`100game/vite.config.js`:
```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true },
  test: { environment: 'node' },
});
```

`100game/.gitignore`:
```
node_modules
dist
```

`100game/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#05060d" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./icon-180.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>YJ 아케이드</title>
    <style>
      html, body { margin: 0; height: 100%; background: #05060d; overflow: hidden;
                   touch-action: none; overscroll-behavior: none; }
      #game { display: block; position: absolute; inset: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`100game/src/main.js` (이번 태스크에서는 자리만 잡는다):
```js
// 결선은 Task 14에서. 지금은 캔버스가 검게 채워지는지만 확인한다.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = innerWidth;
canvas.height = innerHeight;
ctx.fillStyle = '#05060d';
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

- [ ] **Step 2: 의존성 설치**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm install`
Expected: `added N packages` 출력, `dependencies` 없음.

- [ ] **Step 3: 실패하는 테스트 작성**

`100game/tests/bootstrap.test.js`:
```js
import { describe, it, expect } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

describe('워크스페이스', () => {
  it('런타임 의존성이 0개다', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it('ES 모듈 워크스페이스다', () => {
    expect(pkg.type).toBe('module');
  });
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm test`
Expected: `2 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add package.json package-lock.json vite.config.js index.html .gitignore src/main.js tests/bootstrap.test.js
git commit -m "chore(arcade): 워크스페이스 부트스트랩 — vite + vitest, 무의존성

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: core/loop.js — 고정 타임스텝 루프 이식

**Files:**
- Create: `100game/src/core/loop.js`
- Test: `100game/tests/core/loop.test.js`
- 참조(복사 원본): `/Users/junghakjun/ai_work/game/src/engine/loop.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createLoop({ update, render, dt })` → `{ tick(frameMs) → number, start(), stop() }`. `tick`은 이번 프레임에 실행한 update 횟수를 반환한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/core/loop.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createLoop } from '../../src/core/loop.js';

describe('createLoop 고정 타임스텝', () => {
  it('경과 시간만큼 update를 돌린다', () => {
    let updates = 0;
    const loop = createLoop({ dt: 1 / 60, update: () => updates++, render: () => {} });
    expect(loop.tick((1000 / 60) * 3)).toBe(3);
    expect(updates).toBe(3);
  });

  it('남은 시간을 버리지 않고 누적한다', () => {
    let updates = 0;
    const loop = createLoop({ dt: 1 / 60, update: () => updates++, render: () => {} });
    loop.tick((1000 / 60) * 0.5);
    loop.tick((1000 / 60) * 0.5);
    expect(updates).toBe(1);
  });

  it('긴 정지 후에도 죽음의 나선에 빠지지 않는다 (최대 5스텝)', () => {
    let updates = 0;
    const loop = createLoop({ dt: 1 / 60, update: () => updates++, render: () => {} });
    expect(loop.tick(5000)).toBe(5);
    expect(updates).toBe(5);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/loop.test.js`
Expected: FAIL — `Failed to resolve import "../../src/core/loop.js"`

- [ ] **Step 3: 구현**

`100game/src/core/loop.js`:
```js
// 고정 타임스텝 루프. 프로젝트 YJ 네온 테스트 챔버에서 이식.
export function createLoop({ update, render, dt }) {
  const stepMs = dt * 1000;
  let acc = 0;
  let running = false;
  let rafId = 0;
  let last = 0;

  function tick(frameMs) {
    acc += frameMs;
    let count = 0;
    // 긴 정지(탭 전환 등) 후 죽음의 나선을 막는다.
    if (acc > stepMs * 5) acc = stepMs * 5;
    // -1e-9: 누산기가 부동소수 반올림으로 stepMs 바로 아래에 걸리는 경우 방어.
    while (acc >= stepMs - 1e-9) {
      update(dt);
      acc -= stepMs;
      count++;
    }
    render(acc / stepMs);
    return count;
  }

  function frame(now) {
    if (!running) return;
    tick(now - last);
    last = now;
    rafId = requestAnimationFrame(frame);
  }

  return {
    tick,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/loop.test.js`
Expected: `3 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/loop.js tests/core/loop.test.js
git commit -m "feat(arcade): core/loop — 고정 타임스텝 루프 이식

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: core/rng.js — 시드 난수

**Files:**
- Create: `100game/src/core/rng.js`
- Test: `100game/tests/core/rng.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `makeRng(seed?: number)` → `{ next() → [0,1), int(n) → 0..n-1, range(a,b) → [a,b), pick(arr) → 원소, chance(p) → boolean }`

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/core/rng.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';

describe('makeRng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열을 낸다', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('next는 0 이상 1 미만이다', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n)은 0..n-1을 낸다', () => {
    const r = makeRng(3);
    for (let i = 0; i < 500; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('range(a,b)는 a 이상 b 미만이다', () => {
    const r = makeRng(9);
    for (let i = 0; i < 200; i++) {
      const v = r.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('pick은 배열 원소를 낸다', () => {
    const r = makeRng(11);
    const arr = ['가', '나', '다'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });

  it('시드 0도 안전하게 동작한다', () => {
    const r = makeRng(0);
    expect(r.next()).toBeGreaterThanOrEqual(0);
    expect(r.next()).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/rng.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/core/rng.js`:
```js
// mulberry32 — 짧고 빠르고 시드 가능. 리플레이·테스트 재현성을 위해 Math.random 대신 쓴다.
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9; // 시드 0이면 수열이 죽는다

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int: (n) => Math.floor(next() * n),
    range: (a, b) => a + next() * (b - a),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/rng.test.js`
Expected: `7 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/rng.js tests/core/rng.test.js
git commit -m "feat(arcade): core/rng — 시드 가능한 난수

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: core/storage.js — localStorage 래퍼

**Files:**
- Create: `100game/src/core/storage.js`
- Test: `100game/tests/core/storage.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createStorage(prefix: string, backend?)` → `{ get(key, fallback = null), set(key, value), remove(key) }`. backend를 안 주면 `globalThis.localStorage`를 쓰고, 없거나 예외가 나면 조용히 fallback을 돌려준다(사파리 프라이빗 모드 방어). 저장 키는 `` `${prefix}:${key}` ``.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/core/storage.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createStorage } from '../../src/core/storage.js';

function fakeBackend() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('createStorage', () => {
  it('값을 저장하고 되읽는다', () => {
    const s = createStorage('yj', fakeBackend());
    s.set('best', 120);
    expect(s.get('best')).toBe(120);
  });

  it('객체도 왕복한다', () => {
    const s = createStorage('yj', fakeBackend());
    s.set('cfg', { mute: true, level: 3 });
    expect(s.get('cfg')).toEqual({ mute: true, level: 3 });
  });

  it('없는 키는 fallback을 준다', () => {
    const s = createStorage('yj', fakeBackend());
    expect(s.get('nope', 0)).toBe(0);
    expect(s.get('nope')).toBe(null);
  });

  it('prefix를 키에 붙인다', () => {
    const be = fakeBackend();
    createStorage('yj', be).set('best', 1);
    expect([...be.map.keys()]).toEqual(['yj:best']);
  });

  it('remove가 지운다', () => {
    const s = createStorage('yj', fakeBackend());
    s.set('best', 5);
    s.remove('best');
    expect(s.get('best', -1)).toBe(-1);
  });

  it('깨진 JSON이면 fallback을 준다', () => {
    const be = fakeBackend();
    be.map.set('yj:best', '{깨짐');
    expect(createStorage('yj', be).get('best', 0)).toBe(0);
  });

  it('backend가 던져도 앱이 죽지 않는다', () => {
    const throwing = {
      getItem() { throw new Error('보안 오류'); },
      setItem() { throw new Error('용량 초과'); },
      removeItem() { throw new Error('보안 오류'); },
    };
    const s = createStorage('yj', throwing);
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a', 'fallback')).toBe('fallback');
    expect(() => s.remove('a')).not.toThrow();
  });

  it('backend가 아예 없어도 동작한다', () => {
    const s = createStorage('yj', null);
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a', 9)).toBe(9);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/storage.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/core/storage.js`:
```js
// localStorage 래퍼. 사파리 프라이빗 모드·용량 초과에서 예외가 나도 게임이 죽으면 안 된다.
export function createStorage(prefix, backend) {
  const store = backend === undefined
    ? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null)
    : backend;
  const key = (k) => `${prefix}:${k}`;

  return {
    get(k, fallback = null) {
      if (!store) return fallback;
      try {
        const raw = store.getItem(key(k));
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(k, value) {
      if (!store) return;
      try {
        store.setItem(key(k), JSON.stringify(value));
      } catch {
        /* 저장 실패는 무해하게 무시 */
      }
    },
    remove(k) {
      if (!store) return;
      try {
        store.removeItem(key(k));
      } catch {
        /* 무시 */
      }
    },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/storage.test.js`
Expected: `8 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/storage.js tests/core/storage.test.js
git commit -m "feat(arcade): core/storage — 실패에 안전한 localStorage 래퍼

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: core/draw.js — 팔레트 + 네온 헬퍼 (+ 테스트용 stub 캔버스)

**Files:**
- Create: `100game/src/core/draw.js`, `100game/tests/helpers/stubCtx.js`
- Test: `100game/tests/core/draw.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `PALETTE` — `{ bg, panel, dim, cyan, magenta, yellow, green, orange, white, red }` (모두 hex 문자열)
  - `createDraw(ctx)` → `{ clear(color?), rect(x,y,w,h,color,opts?), circle(cx,cy,r,color,opts?), line(x1,y1,x2,y2,color,opts?), text(str,x,y,opts?), roundRect(x,y,w,h,r,color,opts?) }`
    - `opts`: `{ glow = 0, fill = true, width = 2, alpha = 1 }`
    - `text` opts: `{ size = 20, color = PALETTE.white, align = 'center', baseline = 'middle', glow = 0, bold = false }`
  - `stubCtx()` (테스트 헬퍼) → 모든 Canvas 2D 메서드를 받아 `calls` 배열에 기록하는 가짜 컨텍스트

- [ ] **Step 1: 테스트용 stub 캔버스 작성**

`100game/tests/helpers/stubCtx.js`:
```js
// 모든 Canvas 2D 메서드를 삼키고 호출을 기록하는 가짜 컨텍스트.
// 계약 테스트와 draw 테스트가 공유한다.
const METHODS = [
  'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo',
  'rect', 'roundRect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fill',
  'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
  'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
  'drawImage', 'setLineDash', 'putImageData',
];

export function stubCtx(width = 960, height = 640) {
  const calls = [];
  const ctx = {
    calls,
    canvas: { width, height },
    measureText: (s) => ({ width: String(s).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  for (const m of METHODS) {
    ctx[m] = (...args) => { calls.push([m, ...args]); };
  }
  return ctx;
}

export function callNames(ctx) {
  return ctx.calls.map((c) => c[0]);
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`100game/tests/core/draw.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { PALETTE, createDraw } from '../../src/core/draw.js';
import { stubCtx, callNames } from '../helpers/stubCtx.js';

describe('PALETTE', () => {
  it('필요한 색이 모두 hex로 정의돼 있다', () => {
    for (const k of ['bg', 'panel', 'dim', 'cyan', 'magenta', 'yellow', 'green', 'orange', 'white', 'red']) {
      expect(PALETTE[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('createDraw', () => {
  it('clear는 캔버스 전체를 배경색으로 채운다', () => {
    const ctx = stubCtx(960, 640);
    createDraw(ctx).clear();
    expect(ctx.calls).toContainEqual(['fillRect', 0, 0, 960, 640]);
    expect(ctx.fillStyle).toBe(PALETTE.bg);
  });

  it('rect는 채운다', () => {
    const ctx = stubCtx();
    createDraw(ctx).rect(10, 20, 30, 40, PALETTE.cyan);
    expect(ctx.calls).toContainEqual(['fillRect', 10, 20, 30, 40]);
  });

  it('fill:false면 외곽선만 그린다', () => {
    const ctx = stubCtx();
    createDraw(ctx).rect(10, 20, 30, 40, PALETTE.cyan, { fill: false });
    expect(ctx.calls).toContainEqual(['strokeRect', 10, 20, 30, 40]);
    expect(callNames(ctx)).not.toContain('fillRect');
  });

  it('circle은 호를 그린다', () => {
    const ctx = stubCtx();
    createDraw(ctx).circle(50, 60, 12, PALETTE.magenta);
    expect(ctx.calls).toContainEqual(['arc', 50, 60, 12, 0, Math.PI * 2]);
  });

  it('text는 문자열을 그리고 정렬을 세팅한다', () => {
    const ctx = stubCtx();
    createDraw(ctx).text('점수 12', 100, 50, { size: 24, align: 'left' });
    expect(ctx.calls).toContainEqual(['fillText', '점수 12', 100, 50]);
    expect(ctx.textAlign).toBe('left');
    expect(ctx.font).toContain('24px');
  });

  it('glow 옵션은 shadowBlur를 세우고 save/restore로 감싼다', () => {
    const ctx = stubCtx();
    createDraw(ctx).circle(10, 10, 5, PALETTE.cyan, { glow: 14 });
    const names = callNames(ctx);
    expect(names[0]).toBe('save');
    expect(names[names.length - 1]).toBe('restore');
  });

  it('모든 그리기는 상태를 save/restore로 복원한다', () => {
    const ctx = stubCtx();
    const d = createDraw(ctx);
    d.rect(0, 0, 1, 1, PALETTE.cyan);
    d.text('가', 0, 0);
    d.line(0, 0, 5, 5, PALETTE.green);
    const names = callNames(ctx);
    expect(names.filter((n) => n === 'save').length)
      .toBe(names.filter((n) => n === 'restore').length);
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/draw.test.js`
Expected: FAIL — `Failed to resolve import "../../src/core/draw.js"`

- [ ] **Step 4: 구현**

`100game/src/core/draw.js`:
```js
// 네온 팔레트와 그리기 헬퍼. 게임은 색을 직접 하드코딩하지 않고 PALETTE만 쓴다.
export const PALETTE = {
  bg: '#05060d',
  panel: '#0d1226',
  dim: '#3a4460',
  cyan: '#39f6ff',
  magenta: '#ff2e88',
  yellow: '#ffd23f',
  green: '#39ff88',
  orange: '#ff8a3b',
  white: '#eaffff',
  red: '#ff4d5e',
};

export function createDraw(ctx) {
  function begin(color, { glow = 0, alpha = 1, width = 2 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = glow;
    ctx.shadowColor = glow ? color : 'transparent';
  }

  return {
    clear(color = PALETTE.bg) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    },

    rect(x, y, w, h, color, opts = {}) {
      begin(color, opts);
      if (opts.fill === false) ctx.strokeRect(x, y, w, h);
      else ctx.fillRect(x, y, w, h);
      ctx.restore();
    },

    roundRect(x, y, w, h, r, color, opts = {}) {
      begin(color, opts);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (opts.fill === false) ctx.stroke();
      else ctx.fill();
      ctx.restore();
    },

    circle(cx, cy, r, color, opts = {}) {
      begin(color, opts);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (opts.fill === false) ctx.stroke();
      else ctx.fill();
      ctx.restore();
    },

    line(x1, y1, x2, y2, color, opts = {}) {
      begin(color, opts);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    },

    text(str, x, y, opts = {}) {
      const { size = 20, color = PALETTE.white, align = 'center',
              baseline = 'middle', bold = false } = opts;
      begin(color, opts);
      ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      ctx.fillText(String(str), x, y);
      ctx.restore();
    },
  };
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/draw.test.js`
Expected: `7 passed`

- [ ] **Step 6: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/draw.js tests/core/draw.test.js tests/helpers/stubCtx.js
git commit -m "feat(arcade): core/draw — 네온 팔레트와 그리기 헬퍼

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: core/audio.js — WebAudio 합성 효과음

**Files:**
- Create: `100game/src/core/audio.js`
- Test: `100game/tests/core/audio.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createAudio(AudioCtor?)` → `{ beep(freq = 440, ms = 80, type = 'square'), sweep(from, to, ms, type = 'sawtooth'), noise(ms = 120), setMuted(bool), isMuted() → bool }`
  - AudioContext는 **첫 소리 요청 때 지연 생성**한다(iOS 자동재생 정책).
  - `AudioCtor`를 안 주면 `globalThis.AudioContext || globalThis.webkitAudioContext`를 쓰고, 없으면 모든 호출이 조용히 무시된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/core/audio.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createAudio } from '../../src/core/audio.js';

function fakeAudioCtx() {
  const created = { oscillators: [], gains: [], buffers: 0 };
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; Ctx.instances++; }
    createOscillator() {
      const o = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, start() { o.started = true; }, stop() { o.stopped = true; },
      };
      created.oscillators.push(o);
      return o;
    }
    createGain() {
      const g = { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
      created.gains.push(g);
      return g;
    }
    createBuffer(ch, len, rate) { created.buffers++; return { getChannelData: () => new Float32Array(len), length: len, sampleRate: rate }; }
    createBufferSource() { const s = { buffer: null, connect() {}, start() { s.started = true; }, stop() {} }; created.oscillators.push(s); return s; }
    resume() { this.state = 'running'; }
  }
  Ctx.instances = 0;
  return { Ctx, created };
}

describe('createAudio', () => {
  it('소리를 내기 전에는 AudioContext를 만들지 않는다', () => {
    const { Ctx } = fakeAudioCtx();
    createAudio(Ctx);
    expect(Ctx.instances).toBe(0);
  });

  it('첫 beep에서 AudioContext를 한 번만 만든다', () => {
    const { Ctx } = fakeAudioCtx();
    const a = createAudio(Ctx);
    a.beep(440, 50);
    a.beep(660, 50);
    expect(Ctx.instances).toBe(1);
  });

  it('beep은 오실레이터를 만들어 시작·정지한다', () => {
    const { Ctx, created } = fakeAudioCtx();
    createAudio(Ctx).beep(880, 60, 'square');
    const o = created.oscillators[0];
    expect(o.started).toBe(true);
    expect(o.stopped).toBe(true);
    expect(o.type).toBe('square');
    expect(o.frequency.value).toBe(880);
  });

  it('음소거면 소리를 만들지 않는다', () => {
    const { Ctx, created } = fakeAudioCtx();
    const a = createAudio(Ctx);
    a.setMuted(true);
    a.beep(440, 50);
    a.sweep(200, 800, 100);
    a.noise(80);
    expect(created.oscillators.length).toBe(0);
    expect(a.isMuted()).toBe(true);
  });

  it('sweep과 noise도 소스를 만든다', () => {
    const { Ctx, created } = fakeAudioCtx();
    const a = createAudio(Ctx);
    a.sweep(200, 800, 120);
    a.noise(80);
    expect(created.oscillators.length).toBe(2);
    expect(created.buffers).toBe(1);
  });

  it('AudioContext가 없는 환경에서도 던지지 않는다', () => {
    const a = createAudio(null);
    expect(() => { a.beep(); a.sweep(100, 200, 50); a.noise(); }).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/audio.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/core/audio.js`:
```js
// WebAudio 합성 효과음. 오디오 파일 0개가 원칙이므로 전부 합성한다.
// iOS는 사용자 제스처 전에는 소리를 막으므로 AudioContext를 지연 생성한다.
export function createAudio(AudioCtor) {
  const Ctor = AudioCtor === undefined
    ? (globalThis.AudioContext || globalThis.webkitAudioContext || null)
    : AudioCtor;
  let ac = null;
  let muted = false;

  function ensure() {
    if (muted || !Ctor) return null;
    if (!ac) ac = new Ctor();
    if (ac.state === 'suspended') ac.resume?.();
    return ac;
  }

  function envelope(c, gain, ms) {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    g.connect(c.destination);
    return g;
  }

  return {
    beep(freq = 440, ms = 80, type = 'square') {
      const c = ensure();
      if (!c) return;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(envelope(c, 0.06, ms));
      o.start(c.currentTime);
      o.stop(c.currentTime + ms / 1000);
    },

    sweep(from = 200, to = 800, ms = 150, type = 'sawtooth') {
      const c = ensure();
      if (!c) return;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = from;
      o.frequency.setValueAtTime(from, c.currentTime);
      o.frequency.linearRampToValueAtTime(to, c.currentTime + ms / 1000);
      o.connect(envelope(c, 0.05, ms));
      o.start(c.currentTime);
      o.stop(c.currentTime + ms / 1000);
    },

    noise(ms = 120) {
      const c = ensure();
      if (!c) return;
      const rate = c.sampleRate || 44100;
      const len = Math.max(1, Math.floor((rate * ms) / 1000));
      const buf = c.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(envelope(c, 0.08, ms));
      src.start(c.currentTime);
    },

    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/audio.test.js`
Expected: `6 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/audio.js tests/core/audio.test.js
git commit -m "feat(arcade): core/audio — 파일 없는 WebAudio 합성 효과음

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: core/juice.js — 흔들림·파티클·히트스톱

**Files:**
- Create: `100game/src/core/juice.js`
- Test: `100game/tests/core/juice.test.js`

**Interfaces:**
- Consumes: `makeRng` (Task 3)
- Produces: `createJuice(rng)` → `{ shake(mag = 8, dur = 0.25), hitstop(sec = 0.06), frozen() → bool, burst(x, y, opts?), update(dt), draw(ctx), offset() → {x, y}, count() → number, reset() }`
  - `burst` opts: `{ color = PALETTE.white, count = 10, speed = 160, life = 0.45, size = 3, gravity = 320, angle?, spread = Math.PI * 2 }`
  - **스크린 스페이스**다(카메라 없음). 세션이 매 프레임 `update(dt)`를 먼저 부르고, `frozen()`이 true면 게임 `update`를 건너뛴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/core/juice.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { stubCtx, callNames } from '../helpers/stubCtx.js';

const mk = () => createJuice(makeRng(5));

describe('createJuice — 히트스톱', () => {
  it('처음에는 얼지 않았다', () => {
    expect(mk().frozen()).toBe(false);
  });

  it('hitstop 직후 얼고, 시간이 지나면 풀린다', () => {
    const j = mk();
    j.hitstop(0.1);
    expect(j.frozen()).toBe(true);
    j.update(0.05);
    expect(j.frozen()).toBe(true);
    j.update(0.06);
    expect(j.frozen()).toBe(false);
  });
});

describe('createJuice — 흔들림', () => {
  it('흔들기 전 오프셋은 0이다', () => {
    expect(mk().offset()).toEqual({ x: 0, y: 0 });
  });

  it('흔드는 동안 오프셋이 0이 아니고 크기 안에 있다', () => {
    const j = mk();
    j.shake(10, 0.3);
    j.update(1 / 60);
    const o = j.offset();
    expect(Math.abs(o.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(o.y)).toBeLessThanOrEqual(10);
    expect(Math.abs(o.x) + Math.abs(o.y)).toBeGreaterThan(0);
  });

  it('지속시간이 끝나면 오프셋이 0으로 돌아온다', () => {
    const j = mk();
    j.shake(10, 0.1);
    for (let i = 0; i < 20; i++) j.update(1 / 60);
    expect(j.offset()).toEqual({ x: 0, y: 0 });
  });
});

describe('createJuice — 파티클', () => {
  it('burst가 파티클을 만든다', () => {
    const j = mk();
    j.burst(100, 100, { count: 12 });
    expect(j.count()).toBe(12);
  });

  it('수명이 다하면 사라진다', () => {
    const j = mk();
    j.burst(100, 100, { count: 5, life: 0.1 });
    for (let i = 0; i < 20; i++) j.update(1 / 60);
    expect(j.count()).toBe(0);
  });

  it('draw는 파티클이 있을 때만 그리고 save/restore 짝이 맞는다', () => {
    const j = mk();
    const empty = stubCtx();
    j.draw(empty);
    expect(callNames(empty)).not.toContain('fillRect');

    j.burst(50, 50, { count: 3 });
    const ctx = stubCtx();
    j.draw(ctx);
    const names = callNames(ctx);
    expect(names).toContain('fillRect');
    expect(names.filter((n) => n === 'save').length)
      .toBe(names.filter((n) => n === 'restore').length);
  });

  it('reset이 전부 지운다', () => {
    const j = mk();
    j.burst(1, 1, { count: 9 });
    j.shake(10, 1);
    j.hitstop(1);
    j.reset();
    expect(j.count()).toBe(0);
    expect(j.frozen()).toBe(false);
    expect(j.offset()).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/juice.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/core/juice.js`:
```js
import { PALETTE } from './draw.js';

// 손맛 담당: 화면 흔들림, 파티클, 히트스톱. 전부 스크린 스페이스(카메라 없음).
export function createJuice(rng) {
  const parts = [];
  let shakeMag = 0;
  let shakeLeft = 0;
  let shakeDur = 0;
  let freeze = 0;
  let ox = 0;
  let oy = 0;

  return {
    shake(mag = 8, dur = 0.25) {
      shakeMag = Math.max(shakeMag, mag);
      shakeLeft = Math.max(shakeLeft, dur);
      shakeDur = Math.max(shakeDur, dur);
    },

    hitstop(sec = 0.06) {
      freeze = Math.max(freeze, sec);
    },

    frozen() {
      return freeze > 0;
    },

    burst(x, y, opts = {}) {
      const {
        color = PALETTE.white, count = 10, speed = 160, life = 0.45,
        size = 3, gravity = 320, angle = null, spread = Math.PI * 2,
      } = opts;
      for (let i = 0; i < count; i++) {
        const a = angle === null
          ? rng.next() * Math.PI * 2
          : angle + (rng.next() - 0.5) * spread;
        const s = speed * (0.4 + rng.next() * 0.6);
        parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life, maxLife: life, color, size, gravity,
        });
      }
    },

    update(dt) {
      if (freeze > 0) freeze = Math.max(0, freeze - dt);

      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const falloff = shakeDur > 0 ? shakeLeft / shakeDur : 0;
        const m = shakeMag * falloff;
        // 0이 나와 "안 흔들림"으로 보이지 않도록 최소 크기를 준다.
        const jitter = () => (rng.next() < 0.5 ? -1 : 1) * (0.35 + rng.next() * 0.65) * m;
        ox = jitter();
        oy = jitter();
        if (shakeLeft === 0) { ox = 0; oy = 0; shakeMag = 0; shakeDur = 0; }
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
    },

    draw(ctx) {
      if (parts.length === 0) return;
      ctx.save();
      for (const p of parts) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const s = p.size * (0.5 + a * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    },

    offset() {
      return { x: ox, y: oy };
    },

    count() {
      return parts.length;
    },

    reset() {
      parts.length = 0;
      shakeMag = 0; shakeLeft = 0; shakeDur = 0; freeze = 0; ox = 0; oy = 0;
    },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/juice.test.js`
Expected: `9 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/juice.js tests/core/juice.test.js
git commit -m "feat(arcade): core/juice — 흔들림·파티클·히트스톱

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: core/input.js — 키보드·게임패드·터치 통합

**Files:**
- Create: `100game/src/core/input.js`
- Test: `100game/tests/core/input.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `emptyPad()` → `{ x: 0, y: 0, a: false, aHeld: false, b: false, bHeld: false }`
    - `x`/`y`는 -1..1 (y는 **아래가 +**), `a`/`b`는 **이번 프레임에 눌린 순간(edge)**, `aHeld`/`bHeld`는 누르고 있는 상태
  - `KEYMAP_P1`, `KEYMAP_P2` — `{ left: string[], right, up, down, a, b }` (KeyboardEvent.code)
  - `padFromKeys(downSet: Set, prevSet: Set, keymap)` → pad
  - `padFromGamepad(gp, prev: {a,b})` → `{ pad, next: {a,b} }`
  - `padLayout(w, h, controls)` → `{ p1: { dpad, a } | null, p2: { dpad, a } | null }` (각 zone은 `{ cx, cy, r }`, 없으면 null)
  - `padFromTouches(points: {x,y}[], layout, prevHeld: {p1:{a},p2:{a}})` → `{ p1, p2, held }`
  - `mergePads(...pads)` → pad (절댓값이 큰 축이 이기고, 불리언은 OR)
  - `createInput({ canvas, toLogical, win, nav })` → `{ p1, p2, pointer, setControls(mode), update(), dispose() }`
    - `pointer` = `{ x, y, down, pressed, released }` (논리 좌표)
    - `p1`/`p2` 객체는 **매 프레임 같은 객체를 갱신**한다. 게임이 참조를 들고 있어도 안전.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/core/input.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  emptyPad, KEYMAP_P1, KEYMAP_P2, padFromKeys, padFromGamepad,
  padLayout, padFromTouches, mergePads,
} from '../../src/core/input.js';

describe('emptyPad', () => {
  it('중립 상태다', () => {
    expect(emptyPad()).toEqual({ x: 0, y: 0, a: false, aHeld: false, b: false, bHeld: false });
  });
});

describe('padFromKeys', () => {
  it('좌우 키를 x축으로 바꾼다', () => {
    expect(padFromKeys(new Set(['KeyD']), new Set(), KEYMAP_P1).x).toBe(1);
    expect(padFromKeys(new Set(['KeyA']), new Set(), KEYMAP_P1).x).toBe(-1);
  });

  it('양쪽을 같이 누르면 0이다', () => {
    expect(padFromKeys(new Set(['KeyA', 'KeyD']), new Set(), KEYMAP_P1).x).toBe(0);
  });

  it('아래가 y+ 다', () => {
    expect(padFromKeys(new Set(['KeyS']), new Set(), KEYMAP_P1).y).toBe(1);
    expect(padFromKeys(new Set(['KeyW']), new Set(), KEYMAP_P1).y).toBe(-1);
  });

  it('a는 누른 첫 프레임에만 true다', () => {
    const first = padFromKeys(new Set(['KeyF']), new Set(), KEYMAP_P1);
    expect(first.a).toBe(true);
    expect(first.aHeld).toBe(true);
    const second = padFromKeys(new Set(['KeyF']), new Set(['KeyF']), KEYMAP_P1);
    expect(second.a).toBe(false);
    expect(second.aHeld).toBe(true);
  });

  it('P2는 방향키를 쓴다', () => {
    expect(padFromKeys(new Set(['ArrowRight']), new Set(), KEYMAP_P2).x).toBe(1);
    expect(padFromKeys(new Set(['ArrowRight']), new Set(), KEYMAP_P1).x).toBe(0);
  });
});

describe('padFromGamepad', () => {
  const gp = (axes, buttons) => ({ axes, buttons: buttons.map((p) => ({ pressed: p })) });

  it('게임패드가 없으면 중립을 준다', () => {
    expect(padFromGamepad(null, { a: false, b: false }).pad).toEqual(emptyPad());
  });

  it('스틱을 축으로 바꾸고 데드존을 적용한다', () => {
    expect(padFromGamepad(gp([0.9, 0], [false, false]), { a: false, b: false }).pad.x).toBeCloseTo(0.9);
    expect(padFromGamepad(gp([0.1, 0], [false, false]), { a: false, b: false }).pad.x).toBe(0);
  });

  it('A 버튼 edge를 잡는다', () => {
    const r1 = padFromGamepad(gp([0, 0], [true, false]), { a: false, b: false });
    expect(r1.pad.a).toBe(true);
    const r2 = padFromGamepad(gp([0, 0], [true, false]), r1.next);
    expect(r2.pad.a).toBe(false);
    expect(r2.pad.aHeld).toBe(true);
  });
});

describe('padLayout', () => {
  it('pointer 모드는 존이 없다', () => {
    expect(padLayout(960, 640, 'pointer')).toEqual({ p1: null, p2: null });
  });

  it('dpad 모드는 P1 dpad만 준다', () => {
    const L = padLayout(960, 640, 'dpad');
    expect(L.p1.dpad).toBeTruthy();
    expect(L.p1.a).toBe(null);
    expect(L.p2).toBe(null);
  });

  it('dpad+a 모드는 A 버튼도 준다', () => {
    const L = padLayout(960, 640, 'dpad+a');
    expect(L.p1.a).toBeTruthy();
    expect(L.p1.a.cx).toBeGreaterThan(480); // 오른손 쪽
  });

  it('versus 모드는 두 플레이어 존을 좌우로 나눈다', () => {
    const L = padLayout(960, 640, 'versus');
    expect(L.p1.dpad.cx).toBeLessThan(480);
    expect(L.p2.dpad.cx).toBeGreaterThan(480);
  });
});

describe('padFromTouches', () => {
  const layout = padLayout(960, 640, 'dpad+a');
  const noHeld = { p1: { a: false }, p2: { a: false } };

  it('dpad 중앙을 누르면 0이다', () => {
    const { cx, cy } = layout.p1.dpad;
    const r = padFromTouches([{ x: cx, y: cy }], layout, noHeld);
    expect(r.p1.x).toBe(0);
    expect(r.p1.y).toBe(0);
  });

  it('dpad 오른쪽을 끌면 x가 양수다', () => {
    const { cx, cy, r } = layout.p1.dpad;
    const res = padFromTouches([{ x: cx + r * 0.8, y: cy }], layout, noHeld);
    expect(res.p1.x).toBeGreaterThan(0.5);
  });

  it('A 존을 누르면 a edge가 선다', () => {
    const { cx, cy } = layout.p1.a;
    const res = padFromTouches([{ x: cx, y: cy }], layout, noHeld);
    expect(res.p1.a).toBe(true);
    expect(res.held.p1.a).toBe(true);

    const again = padFromTouches([{ x: cx, y: cy }], layout, res.held);
    expect(again.p1.a).toBe(false);
    expect(again.p1.aHeld).toBe(true);
  });

  it('존 밖 터치는 무시한다', () => {
    const res = padFromTouches([{ x: 480, y: 40 }], layout, noHeld);
    expect(res.p1).toEqual(emptyPad());
  });
});

describe('mergePads', () => {
  it('절댓값이 큰 축이 이긴다', () => {
    const a = { ...emptyPad(), x: 0.3 };
    const b = { ...emptyPad(), x: -0.9 };
    expect(mergePads(a, b).x).toBe(-0.9);
  });

  it('버튼은 OR로 합친다', () => {
    const a = { ...emptyPad(), a: true };
    const b = { ...emptyPad(), bHeld: true };
    const m = mergePads(a, b);
    expect(m.a).toBe(true);
    expect(m.bHeld).toBe(true);
  });

  it('null 소스는 건너뛴다', () => {
    expect(mergePads(null, undefined, { ...emptyPad(), y: 1 }).y).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/input.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 순수 함수 구현**

`100game/src/core/input.js`:
```js
// 입력 통합. 순수 함수(테스트 대상)와 DOM 결선(createInput)을 분리한다.
// 축: x는 오른쪽이 +, y는 아래가 + (캔버스 좌표와 같은 방향).

export function emptyPad() {
  return { x: 0, y: 0, a: false, aHeld: false, b: false, bHeld: false };
}

export const KEYMAP_P1 = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  a: ['KeyF', 'Space'], b: ['KeyG'],
};

export const KEYMAP_P2 = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  a: ['Slash', 'ShiftRight'], b: ['Period'],
};

const anyDown = (set, codes) => codes.some((c) => set.has(c));

export function padFromKeys(downSet, prevSet, keymap) {
  const pad = emptyPad();
  pad.x = (anyDown(downSet, keymap.right) ? 1 : 0) - (anyDown(downSet, keymap.left) ? 1 : 0);
  pad.y = (anyDown(downSet, keymap.down) ? 1 : 0) - (anyDown(downSet, keymap.up) ? 1 : 0);
  pad.aHeld = anyDown(downSet, keymap.a);
  pad.bHeld = anyDown(downSet, keymap.b);
  pad.a = pad.aHeld && !anyDown(prevSet, keymap.a);
  pad.b = pad.bHeld && !anyDown(prevSet, keymap.b);
  return pad;
}

const DEAD = 0.2;
const dead = (v) => (Math.abs(v) < DEAD ? 0 : v);

export function padFromGamepad(gp, prev = { a: false, b: false }) {
  if (!gp) return { pad: emptyPad(), next: { a: false, b: false } };
  const pad = emptyPad();
  // 아날로그 스틱과 D패드(버튼 12~15) 둘 다 받는다.
  const dpadX = (gp.buttons?.[15]?.pressed ? 1 : 0) - (gp.buttons?.[14]?.pressed ? 1 : 0);
  const dpadY = (gp.buttons?.[13]?.pressed ? 1 : 0) - (gp.buttons?.[12]?.pressed ? 1 : 0);
  pad.x = dpadX || dead(gp.axes?.[0] ?? 0);
  pad.y = dpadY || dead(gp.axes?.[1] ?? 0);
  const aDown = !!gp.buttons?.[0]?.pressed;
  const bDown = !!gp.buttons?.[1]?.pressed || !!gp.buttons?.[2]?.pressed;
  pad.aHeld = aDown;
  pad.bHeld = bDown;
  pad.a = aDown && !prev.a;
  pad.b = bDown && !prev.b;
  return { pad, next: { a: aDown, b: bDown } };
}

// 터치 오버레이 존. 논리 해상도 기준으로 계산한다.
export function padLayout(w, h, controls) {
  const R = 78;         // dpad 반지름
  const BR = 52;        // 버튼 반지름
  const M = 24;         // 화면 여백
  const none = { p1: null, p2: null };

  if (controls === 'pointer') return none;

  if (controls === 'dpad') {
    return { p1: { dpad: { cx: M + R, cy: h - M - R, r: R }, a: null }, p2: null };
  }

  if (controls === 'dpad+a') {
    return {
      p1: {
        dpad: { cx: M + R, cy: h - M - R, r: R },
        a: { cx: w - M - BR, cy: h - M - BR, r: BR },
      },
      p2: null,
    };
  }

  if (controls === 'versus') {
    return {
      p1: {
        dpad: { cx: M + R, cy: h - M - R, r: R },
        a: { cx: M + R * 2 + BR + 16, cy: h - M - BR, r: BR },
      },
      p2: {
        dpad: { cx: w - M - R, cy: h - M - R, r: R },
        a: { cx: w - M - R * 2 - BR - 16, cy: h - M - BR, r: BR },
      },
    };
  }

  return none;
}

function zonePad(points, zone, prevA) {
  const pad = emptyPad();
  if (!zone) return pad;
  for (const p of points) {
    if (zone.dpad) {
      const dx = p.x - zone.dpad.cx;
      const dy = p.y - zone.dpad.cy;
      const mag = Math.hypot(dx, dy);
      if (mag <= zone.dpad.r * 1.35) {
        if (mag > zone.dpad.r * 0.22) {
          const k = zone.dpad.r * 0.7;
          pad.x = Math.max(-1, Math.min(1, dx / k));
          pad.y = Math.max(-1, Math.min(1, dy / k));
        }
        continue;
      }
    }
    if (zone.a && Math.hypot(p.x - zone.a.cx, p.y - zone.a.cy) <= zone.a.r * 1.2) {
      pad.aHeld = true;
    }
  }
  pad.a = pad.aHeld && !prevA;
  return pad;
}

export function padFromTouches(points, layout, prevHeld) {
  const p1 = zonePad(points, layout.p1, prevHeld?.p1?.a ?? false);
  const p2 = zonePad(points, layout.p2, prevHeld?.p2?.a ?? false);
  return { p1, p2, held: { p1: { a: p1.aHeld }, p2: { a: p2.aHeld } } };
}

export function mergePads(...pads) {
  const out = emptyPad();
  for (const p of pads) {
    if (!p) continue;
    if (Math.abs(p.x) > Math.abs(out.x)) out.x = p.x;
    if (Math.abs(p.y) > Math.abs(out.y)) out.y = p.y;
    out.a ||= p.a;
    out.aHeld ||= p.aHeld;
    out.b ||= p.b;
    out.bHeld ||= p.bHeld;
  }
  return out;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/core/input.test.js`
Expected: `20 passed`

- [ ] **Step 5: DOM 결선 추가 (같은 파일 하단)**

`100game/src/core/input.js` 끝에 이어붙인다:
```js
// ─────────────────────────────────────────────────────────────────────────────
// DOM 결선. 순수 함수들을 실제 이벤트에 묶는다.
// toLogical(clientX, clientY) → { x, y } 논리 좌표 변환기는 main.js가 준다.
export function createInput({ canvas, toLogical, win = globalThis, nav = globalThis.navigator }) {
  const down = new Set();
  let prevKeys = new Set();
  let gpPrev = [{ a: false, b: false }, { a: false, b: false }];
  let touchHeld = { p1: { a: false }, p2: { a: false } };
  let controls = 'pointer';
  let layout = padLayout(960, 640, controls);

  const touches = new Map(); // pointerId → {x, y}
  const p1 = emptyPad();
  const p2 = emptyPad();
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  let pointerDownEdge = false;
  let pointerUpEdge = false;

  const onKeyDown = (e) => {
    down.add(e.code);
    // 방향키·스페이스가 페이지를 스크롤하지 않게 막는다.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onBlur = () => down.clear();

  const onPointerDown = (e) => {
    const p = toLogical(e.clientX, e.clientY);
    touches.set(e.pointerId, p);
    pointer.x = p.x; pointer.y = p.y;
    pointerDownEdge = true;
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    if (!touches.has(e.pointerId)) return;
    const p = toLogical(e.clientX, e.clientY);
    touches.set(e.pointerId, p);
    pointer.x = p.x; pointer.y = p.y;
    e.preventDefault();
  };
  const onPointerUp = (e) => {
    if (touches.delete(e.pointerId)) pointerUpEdge = true;
    e.preventDefault();
  };

  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  win.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function readGamepads() {
    const list = nav?.getGamepads?.() ?? [];
    const connected = [...list].filter(Boolean);
    const r0 = padFromGamepad(connected[0] ?? null, gpPrev[0]);
    const r1 = padFromGamepad(connected[1] ?? null, gpPrev[1]);
    gpPrev = [r0.next, r1.next];
    return [r0.pad, r1.pad];
  }

  return {
    p1, p2, pointer,

    setControls(mode) {
      controls = mode;
      layout = padLayout(960, 640, mode);
      touchHeld = { p1: { a: false }, p2: { a: false } };
    },

    layout() { return layout; },

    // 매 프레임 게임 update 전에 한 번 호출한다.
    update() {
      const pts = [...touches.values()];
      const t = padFromTouches(pts, layout, touchHeld);
      touchHeld = t.held;
      const [g0, g1] = readGamepads();

      Object.assign(p1, mergePads(padFromKeys(down, prevKeys, KEYMAP_P1), g0, t.p1));
      Object.assign(p2, mergePads(padFromKeys(down, prevKeys, KEYMAP_P2), g1, t.p2));
      prevKeys = new Set(down);

      pointer.down = touches.size > 0;
      pointer.pressed = pointerDownEdge;
      pointer.released = pointerUpEdge;
      pointerDownEdge = false;
      pointerUpEdge = false;
    },

    dispose() {
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      touches.clear();
      down.clear();
    },
  };
}
```

- [ ] **Step 6: 전체 테스트 실행 — 회귀 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm test`
Expected: 모든 테스트 통과 (Task 1~8 누적)

- [ ] **Step 7: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/core/input.js tests/core/input.test.js
git commit -m "feat(arcade): core/input — 키보드·게임패드·터치 통합 (p1/p2 + 포인터)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: shell/registry.js — 게임 자동 수집 + 계약 검증

**Files:**
- Create: `100game/src/shell/registry.js`
- Test: `100game/tests/shell/registry.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `TAGS = ['action','puzzle','defense','sports','quiz','versus']`
  - `CONTROLS = ['pointer','dpad','dpad+a','versus']`
  - `SCORE_ORDERS = ['high','low']`
  - `baseName(path)` → 확장자 없는 파일명
  - `validateGame(mod, path)` → `string[]` (빈 배열이면 합격). `mod`은 `import.meta.glob` 결과의 모듈 객체(`{ default: {...} }`)
  - `collectGames(modules)` → `{ games: Game[], errors: string[] }`. `modules`는 `{ [path]: module }`. 정렬은 태그 순서 → 제목 한글 가나다순
  - `visibleGames(games, filter = 'all')` → archived 제외 + 태그 필터

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/shell/registry.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { baseName, validateGame, collectGames, visibleGames, TAGS } from '../../src/shell/registry.js';

const noop = () => {};
const okGame = (over = {}) => ({
  default: {
    id: 'neon-snake', title: '네온 스네이크', tags: ['action'], players: 1,
    color: '#39f6ff', controls: 'dpad', scoreOrder: 'high', scoreLabel: '점수',
    icon: noop, init: noop, update: noop, render: noop, dispose: noop,
    ...over,
  },
});

describe('baseName', () => {
  it('경로에서 확장자 없는 파일명을 뽑는다', () => {
    expect(baseName('../src/games/neon-snake.js')).toBe('neon-snake');
  });
});

describe('validateGame', () => {
  it('올바른 게임은 오류가 없다', () => {
    expect(validateGame(okGame(), 'x/neon-snake.js')).toEqual([]);
  });

  it('default export가 없으면 잡는다', () => {
    expect(validateGame({}, 'x/neon-snake.js').join()).toMatch(/default/);
  });

  it('id가 파일명과 다르면 잡는다', () => {
    expect(validateGame(okGame({ id: 'other' }), 'x/neon-snake.js').join()).toMatch(/id/);
  });

  it('필수 함수가 빠지면 잡는다', () => {
    expect(validateGame(okGame({ update: undefined }), 'x/neon-snake.js').join()).toMatch(/update/);
  });

  it('모르는 태그를 잡는다', () => {
    expect(validateGame(okGame({ tags: ['shooter'] }), 'x/neon-snake.js').join()).toMatch(/tags/);
  });

  it('태그가 비면 잡는다', () => {
    expect(validateGame(okGame({ tags: [] }), 'x/neon-snake.js').join()).toMatch(/tags/);
  });

  it('players는 1 또는 2만 허용한다', () => {
    expect(validateGame(okGame({ players: 3 }), 'x/neon-snake.js').join()).toMatch(/players/);
  });

  it('color는 hex여야 한다', () => {
    expect(validateGame(okGame({ color: 'cyan' }), 'x/neon-snake.js').join()).toMatch(/color/);
  });

  it('모르는 controls를 잡는다', () => {
    expect(validateGame(okGame({ controls: 'gyro' }), 'x/neon-snake.js').join()).toMatch(/controls/);
  });

  it('scoreOrder를 검사한다', () => {
    expect(validateGame(okGame({ scoreOrder: 'best' }), 'x/neon-snake.js').join()).toMatch(/scoreOrder/);
  });

  it('players 2면 versus 태그를 요구한다', () => {
    expect(validateGame(okGame({ players: 2 }), 'x/neon-snake.js').join()).toMatch(/versus/);
  });
});

describe('collectGames', () => {
  it('모듈 맵에서 게임을 모은다', () => {
    const { games, errors } = collectGames({
      '../src/games/neon-snake.js': okGame(),
      '../src/games/crossy-robot.js': okGame({ id: 'crossy-robot', title: '길 건너기 로봇' }),
    });
    expect(errors).toEqual([]);
    expect(games.map((g) => g.id).sort()).toEqual(['crossy-robot', 'neon-snake']);
  });

  it('잘못된 게임은 목록에서 빼고 오류로 보고한다', () => {
    const { games, errors } = collectGames({
      '../src/games/neon-snake.js': okGame(),
      '../src/games/broken.js': okGame({ id: 'broken', tags: [] }),
    });
    expect(games.map((g) => g.id)).toEqual(['neon-snake']);
    expect(errors.length).toBe(1);
  });

  it('id가 중복되면 오류다', () => {
    const { errors } = collectGames({
      '../src/games/a.js': okGame({ id: 'a' }),
      '../src/games/b.js': okGame({ id: 'a', title: '비' }),
    });
    expect(errors.join()).toMatch(/중복/);
  });

  it('태그 순서 다음 제목 가나다순으로 정렬한다', () => {
    const { games } = collectGames({
      '../src/games/zeta.js': okGame({ id: 'zeta', title: '하하', tags: ['puzzle'] }),
      '../src/games/alpha.js': okGame({ id: 'alpha', title: '나나', tags: ['action'] }),
      '../src/games/beta.js': okGame({ id: 'beta', title: '가가', tags: ['action'] }),
    });
    expect(games.map((g) => g.id)).toEqual(['beta', 'alpha', 'zeta']);
    expect(TAGS.indexOf('action')).toBeLessThan(TAGS.indexOf('puzzle'));
  });

  it('기본값을 채워준다', () => {
    const { games } = collectGames({
      '../src/games/neon-snake.js': okGame({ controls: undefined, scoreOrder: undefined, scoreLabel: undefined, archived: undefined }),
    });
    expect(games[0].controls).toBe('pointer');
    expect(games[0].scoreOrder).toBe('high');
    expect(games[0].scoreLabel).toBe('점수');
    expect(games[0].archived).toBe(false);
  });
});

describe('visibleGames', () => {
  const games = [
    { id: 'a', tags: ['action'], archived: false },
    { id: 'b', tags: ['puzzle'], archived: false },
    { id: 'c', tags: ['action'], archived: true },
  ];

  it('archived는 숨긴다', () => {
    expect(visibleGames(games).map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('태그로 거른다', () => {
    expect(visibleGames(games, 'action').map((g) => g.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/registry.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/shell/registry.js`:
```js
// 게임 모듈 수집과 계약 검증. 셸이 개별 게임을 모르게 하는 유일한 접점.
export const TAGS = ['action', 'puzzle', 'defense', 'sports', 'quiz', 'versus'];
export const CONTROLS = ['pointer', 'dpad', 'dpad+a', 'versus'];
export const SCORE_ORDERS = ['high', 'low'];
const REQUIRED_FUNCS = ['icon', 'init', 'update', 'render', 'dispose'];

export function baseName(path) {
  return path.split('/').pop().replace(/\.js$/, '');
}

export function validateGame(mod, path) {
  const errors = [];
  const g = mod?.default;
  const name = baseName(path);

  if (!g || typeof g !== 'object') {
    return [`${name}: default export가 없습니다`];
  }
  if (g.id !== name) errors.push(`${name}: id("${g.id}")가 파일명과 다릅니다`);
  if (typeof g.title !== 'string' || g.title.length === 0) errors.push(`${name}: title이 없습니다`);

  if (!Array.isArray(g.tags) || g.tags.length === 0) {
    errors.push(`${name}: tags가 비었습니다`);
  } else {
    const bad = g.tags.filter((t) => !TAGS.includes(t));
    if (bad.length) errors.push(`${name}: 모르는 tags ${bad.join(',')}`);
  }

  if (g.players !== 1 && g.players !== 2) errors.push(`${name}: players는 1 또는 2여야 합니다`);
  if (g.players === 2 && Array.isArray(g.tags) && !g.tags.includes('versus')) {
    errors.push(`${name}: players가 2면 tags에 versus가 있어야 합니다`);
  }
  if (typeof g.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(g.color)) {
    errors.push(`${name}: color는 #rrggbb 형식이어야 합니다`);
  }
  if (g.controls !== undefined && !CONTROLS.includes(g.controls)) {
    errors.push(`${name}: 모르는 controls "${g.controls}"`);
  }
  if (g.scoreOrder !== undefined && !SCORE_ORDERS.includes(g.scoreOrder)) {
    errors.push(`${name}: scoreOrder는 high 또는 low여야 합니다`);
  }
  for (const fn of REQUIRED_FUNCS) {
    if (typeof g[fn] !== 'function') errors.push(`${name}: ${fn}() 함수가 없습니다`);
  }
  return errors;
}

function withDefaults(g) {
  return {
    controls: 'pointer',
    scoreOrder: 'high',
    scoreLabel: '점수',
    archived: false,
    ...g,
  };
}

export function collectGames(modules) {
  const games = [];
  const errors = [];
  const seen = new Map();

  for (const path of Object.keys(modules).sort()) {
    const errs = validateGame(modules[path], path);
    if (errs.length) { errors.push(...errs); continue; }
    const g = withDefaults(modules[path].default);
    if (seen.has(g.id)) {
      errors.push(`${g.id}: id가 중복입니다 (${seen.get(g.id)}, ${path})`);
      continue;
    }
    seen.set(g.id, path);
    games.push(g);
  }

  games.sort((a, b) => {
    const ta = TAGS.indexOf(a.tags[0]);
    const tb = TAGS.indexOf(b.tags[0]);
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title, 'ko');
  });

  return { games, errors };
}

export function visibleGames(games, filter = 'all') {
  return games.filter((g) => !g.archived && (filter === 'all' || g.tags.includes(filter)));
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/registry.test.js`
Expected: `19 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/shell/registry.js tests/shell/registry.test.js
git commit -m "feat(arcade): shell/registry — 게임 자동 수집과 계약 검증

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: 계약 테스트 하네스 — 양산의 안전장치

이 태스크가 **양산 파이프라인의 핵심**이다. 앞으로 에이전트가 만드는 모든 게임은 이 테스트만 통과하면 사람이 코드를 안 봐도 "최소한 안 터진다"가 보장된다. 아직 게임이 0개여도 통과해야 한다.

**Files:**
- Create: `100game/tests/helpers/fakeApi.js`, `100game/tests/contract.test.js`
- Test: 위 `contract.test.js` 자체

**Interfaces:**
- Consumes: `stubCtx` (Task 5), `createDraw`(Task 5), `createAudio`(Task 6), `createJuice`(Task 7), `makeRng`(Task 3), `emptyPad`(Task 8), `collectGames`/`validateGame`(Task 9)
- Produces: `createFakeApi(ctx, { seed })` → `{ api, events, setRendering(bool) }`
  - `events` = `{ scores: number[], gameOvers: object[], illegal: string[] }`
  - `illegal`에는 **render 중에 호출된 콜백**이 기록된다

- [ ] **Step 1: 가짜 api 헬퍼 작성**

`100game/tests/helpers/fakeApi.js`:
```js
import { createDraw } from '../../src/core/draw.js';
import { createAudio } from '../../src/core/audio.js';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { emptyPad } from '../../src/core/input.js';

// 게임에 주입할 가짜 api. render 중 콜백 호출 같은 계약 위반을 기록한다.
export function createFakeApi(ctx, { seed = 1 } = {}) {
  const events = { scores: [], gameOvers: [], illegal: [] };
  let rendering = false;

  const api = {
    w: 960,
    h: 640,
    input: {
      p1: emptyPad(),
      p2: emptyPad(),
      pointer: { x: 480, y: 320, down: false, pressed: false, released: false },
    },
    draw: createDraw(ctx),
    audio: createAudio(null),       // AudioContext 없는 환경 → 전부 무해하게 무시
    juice: createJuice(makeRng(seed)),
    rng: makeRng(seed),
    onScore(n) {
      if (rendering) events.illegal.push('render 중 onScore 호출');
      events.scores.push(n);
    },
    onGameOver(res) {
      if (rendering) events.illegal.push('render 중 onGameOver 호출');
      events.gameOvers.push(res ?? {});
    },
  };

  return { api, events, setRendering: (v) => { rendering = v; } };
}

// 60초치 입력을 흉내낸다. 방향·버튼·포인터를 골고루 흔들어 코드 경로를 넓게 친다.
export function driveInput(api, frame, rng) {
  const p = api.input.p1;
  if (frame % 17 === 0) { p.x = rng.int(3) - 1; p.y = rng.int(3) - 1; }
  p.a = frame % 23 === 0;
  p.aHeld = frame % 23 < 6;
  p.b = frame % 41 === 0;
  p.bHeld = frame % 41 < 4;
  Object.assign(api.input.p2, p);
  const ptr = api.input.pointer;
  if (frame % 13 === 0) { ptr.x = rng.int(960); ptr.y = rng.int(640); }
  ptr.pressed = frame % 29 === 0;
  ptr.released = frame % 29 === 14;
  ptr.down = frame % 29 < 14;
}
```

- [ ] **Step 2: 계약 테스트 작성**

`100game/tests/contract.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectGames } from '../src/shell/registry.js';
import { stubCtx } from './helpers/stubCtx.js';
import { createFakeApi, driveInput } from './helpers/fakeApi.js';
import { makeRng } from '../src/core/rng.js';

const modules = import.meta.glob('../src/games/*.js', { eager: true });
const { games, errors } = collectGames(modules);

describe('게임 계약 — 전체', () => {
  it('계약 위반 없이 전부 수집된다', () => {
    expect(errors).toEqual([]);
  });

  it('수집된 게임 수가 파일 수와 같다', () => {
    expect(games.length).toBe(Object.keys(modules).length);
  });
});

// 게임이 0개여도 이 파일은 통과해야 한다.
describe.each(games.map((g) => [g.id, g]))('게임 계약 — %s', (id, game) => {
  let timers;
  let originals;

  beforeEach(() => {
    // 게임이 만든 타이머를 dispose가 정리하는지 감시한다.
    timers = { open: new Set(), nextId: 1 };
    originals = {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
    globalThis.setInterval = () => { const t = timers.nextId++; timers.open.add(t); return t; };
    globalThis.setTimeout = () => { const t = timers.nextId++; timers.open.add(t); return t; };
    globalThis.clearInterval = (t) => timers.open.delete(t);
    globalThis.clearTimeout = (t) => timers.open.delete(t);
  });

  afterEach(() => {
    Object.assign(globalThis, originals);
  });

  it('아이콘을 그린다', () => {
    const ctx = stubCtx(64, 64);
    expect(() => game.icon(ctx, 64)).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it('60초를 돌려도 터지지 않는다', () => {
    const ctx = stubCtx();
    const { api, events, setRendering } = createFakeApi(ctx);
    const rng = makeRng(1234);

    game.init(api);
    for (let f = 0; f < 3600; f++) {
      driveInput(api, f, rng);
      game.update(1 / 60);
      if (f % 10 === 0) {
        setRendering(true);
        game.render(ctx);
        setRendering(false);
      }
    }
    game.dispose();

    expect(events.illegal).toEqual([]);
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it('보고하는 점수는 유한한 숫자다', () => {
    const ctx = stubCtx();
    const { api, events } = createFakeApi(ctx);
    const rng = makeRng(77);

    game.init(api);
    for (let f = 0; f < 1800; f++) {
      driveInput(api, f, rng);
      game.update(1 / 60);
    }
    game.dispose();

    for (const s of events.scores) {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
    }
    for (const r of events.gameOvers) {
      if (r.score !== undefined) expect(Number.isFinite(r.score)).toBe(true);
    }
  });

  it('render는 상태를 바꾸지 않는다 (두 번 그려도 같은 호출)', () => {
    // api.draw는 이 ctx에 묶여 있으므로 같은 ctx에 두 번 그리고 앞뒤를 비교한다.
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 120; f++) game.update(1 / 60);

    game.render(ctx);
    const first = ctx.calls.map((c) => c[0]).join(',');
    const mark = ctx.calls.length;
    game.render(ctx);
    const second = ctx.calls.slice(mark).map((c) => c[0]).join(',');
    game.dispose();

    expect(second).toBe(first);
  });

  it('dispose가 만든 타이머를 모두 정리한다', () => {
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 60; f++) game.update(1 / 60);
    game.dispose();
    expect([...timers.open]).toEqual([]);
  });

  it('init을 다시 부르면 깨끗하게 재시작한다', () => {
    const ctx = stubCtx();
    const { api, events } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 300; f++) game.update(1 / 60);
    game.dispose();

    const before = events.gameOvers.length;
    game.init(api);
    expect(() => {
      for (let f = 0; f < 60; f++) game.update(1 / 60);
      game.render(ctx);
    }).not.toThrow();
    game.dispose();
    expect(events.gameOvers.length).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 3: 테스트 실행 — 게임 0개 상태에서 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/contract.test.js`
Expected: `2 passed` (게임이 아직 없으므로 `describe.each`는 비어 있음)

- [ ] **Step 4: 하네스가 실제로 위반을 잡는지 확인 (일회용 검증)**

일부러 계약을 어기는 게임을 잠깐 만든다.

`100game/src/games/bad-probe.js`:
```js
export default {
  id: 'bad-probe', title: '불량 탐침', tags: ['action'], players: 1,
  color: '#ff2e88', controls: 'pointer',
  icon(ctx) { ctx.fillRect(0, 0, 1, 1); },
  init(api) { this.api = api; this.t = 0; },
  update(dt) { this.t += dt; },
  render() { this.api.onScore(this.t); },   // 계약 위반: render에서 콜백 호출
  dispose() {},
};
```

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/contract.test.js`
Expected: FAIL — `bad-probe` 의 "60초를 돌려도 터지지 않는다"가 `render 중 onScore 호출`로 실패

- [ ] **Step 5: 탐침 파일 삭제 후 재확인**

```bash
cd /Users/junghakjun/ai_work/game/100game
rm src/games/bad-probe.js
npx vitest run tests/contract.test.js
```
Expected: `2 passed`

- [ ] **Step 6: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add tests/contract.test.js tests/helpers/fakeApi.js
git commit -m "test(arcade): 전 게임 공통 계약 테스트 하네스

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: shell/records.js — 최고기록·플레이 횟수

**Files:**
- Create: `100game/src/shell/records.js`
- Test: `100game/tests/shell/records.test.js`

**Interfaces:**
- Consumes: `createStorage` (Task 4)
- Produces: `createRecords(storage)` → `{ best(id) → number|null, plays(id) → number, submit(id, score, order = 'high') → { best, isNew } }`
  - `submit`은 **유효한(유한한) 점수 제출마다** 플레이 횟수를 1 올린다. 점수가 유한한 숫자가 아니면 아무것도 바꾸지 않고 `{ best: 기존값, isNew: false }`를 돌려준다 — 쓰레기 입력은 플레이로 세지 않는다. `order === 'low'`면 작은 값이 기록.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/shell/records.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createRecords } from '../../src/shell/records.js';
import { createStorage } from '../../src/core/storage.js';

function mem() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
const mk = () => createRecords(createStorage('yj', mem()));

describe('createRecords', () => {
  it('기록이 없으면 null이다', () => {
    expect(mk().best('neon-snake')).toBe(null);
  });

  it('첫 제출은 항상 신기록이다', () => {
    const r = mk();
    expect(r.submit('neon-snake', 10)).toEqual({ best: 10, isNew: true });
  });

  it('high 정렬은 큰 값만 갱신한다', () => {
    const r = mk();
    r.submit('neon-snake', 10);
    expect(r.submit('neon-snake', 5)).toEqual({ best: 10, isNew: false });
    expect(r.submit('neon-snake', 20)).toEqual({ best: 20, isNew: true });
    expect(r.best('neon-snake')).toBe(20);
  });

  it('low 정렬은 작은 값만 갱신한다', () => {
    const r = mk();
    r.submit('sliding-puzzle', 40, 'low');
    expect(r.submit('sliding-puzzle', 55, 'low')).toEqual({ best: 40, isNew: false });
    expect(r.submit('sliding-puzzle', 22, 'low')).toEqual({ best: 22, isNew: true });
  });

  it('플레이 횟수를 센다', () => {
    const r = mk();
    expect(r.plays('neon-snake')).toBe(0);
    r.submit('neon-snake', 1);
    r.submit('neon-snake', 2);
    expect(r.plays('neon-snake')).toBe(2);
  });

  it('게임끼리 기록이 섞이지 않는다', () => {
    const r = mk();
    r.submit('a', 10);
    r.submit('b', 99);
    expect(r.best('a')).toBe(10);
    expect(r.best('b')).toBe(99);
  });

  it('숫자가 아닌 점수는 무시한다', () => {
    const r = mk();
    expect(r.submit('a', NaN)).toEqual({ best: null, isNew: false });
    expect(r.best('a')).toBe(null);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/records.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/shell/records.js`:
```js
// 게임별 최고기록과 플레이 횟수.
export function createRecords(storage) {
  const bestKey = (id) => `best:${id}`;
  const playKey = (id) => `plays:${id}`;

  return {
    best(id) {
      const v = storage.get(bestKey(id), null);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },

    plays(id) {
      const v = storage.get(playKey(id), 0);
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    },

    submit(id, score, order = 'high') {
      const prev = this.best(id);
      if (!Number.isFinite(score)) return { best: prev, isNew: false };

      storage.set(playKey(id), this.plays(id) + 1);
      const isNew = prev === null || (order === 'low' ? score < prev : score > prev);
      if (isNew) storage.set(bestKey(id), score);
      return { best: isNew ? score : prev, isNew };
    },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/records.test.js`
Expected: `7 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/shell/records.js tests/shell/records.test.js
git commit -m "feat(arcade): shell/records — 최고기록·플레이 횟수

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: shell/session.js — 게임 마운트·일시정지·결과

**Files:**
- Create: `100game/src/shell/session.js`
- Test: `100game/tests/shell/session.test.js`

**Interfaces:**
- Consumes: `createRecords`(Task 11), 코어 일체(Task 3·5·6·7·8)
- Produces:
  - `sessionButtons(w, h)` → `{ pause: rect, resume: rect, restart: rect, menu: rect }` (rect = `{ x, y, w, h }`)
  - `hitRect(rect, x, y)` → bool
  - `createSession({ core, records, onExit })` → `{ start(game), update(dt), render(ctx), tap(x, y) → string|null, state() → 'idle'|'playing'|'paused'|'over', score() → number, result() → object|null, stop() }`
    - `core` = `{ input, draw, audio, juice, rng }`
    - `tap` 반환값: `'pause' | 'resume' | 'restart' | 'menu' | null`
    - `'over'` 상태에서는 게임 `update`를 멈춘다. juice는 계속 갱신한다.
    - `stop()`은 현재 게임 `dispose()` 후 `idle`로 돌아간다.

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/shell/session.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createSession, sessionButtons, hitRect } from '../../src/shell/session.js';
import { createRecords } from '../../src/shell/records.js';
import { createStorage } from '../../src/core/storage.js';
import { createDraw } from '../../src/core/draw.js';
import { createAudio } from '../../src/core/audio.js';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { emptyPad } from '../../src/core/input.js';
import { stubCtx } from '../helpers/stubCtx.js';

function mem() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

function makeCore(ctx) {
  const controlsSeen = [];
  return {
    controlsSeen,
    input: {
      p1: emptyPad(), p2: emptyPad(),
      pointer: { x: 0, y: 0, down: false, pressed: false, released: false },
      setControls: (m) => controlsSeen.push(m),
    },
    draw: createDraw(ctx),
    audio: createAudio(null),
    juice: createJuice(makeRng(1)),
    rng: makeRng(1),
  };
}

function fakeGame(over = {}) {
  const log = [];
  return {
    log,
    id: 'test-game', title: '테스트', tags: ['action'], players: 1,
    color: '#39f6ff', controls: 'dpad', scoreOrder: 'high', scoreLabel: '점수',
    icon() {},
    init(api) { log.push('init'); this.api = api; this.t = 0; },
    update(dt) { log.push('update'); this.t += dt; },
    render() { log.push('render'); },
    dispose() { log.push('dispose'); },
    ...over,
  };
}

function mkSession(ctx, onExit = () => {}) {
  const core = makeCore(ctx);
  const records = createRecords(createStorage('yj', mem()));
  return { session: createSession({ core, records, onExit }), core, records };
}

describe('sessionButtons / hitRect', () => {
  it('일시정지 버튼은 우상단에 있다', () => {
    const b = sessionButtons(960, 640);
    expect(b.pause.x).toBeGreaterThan(800);
    expect(b.pause.y).toBeLessThan(80);
  });

  it('hitRect가 안팎을 구분한다', () => {
    const r = { x: 10, y: 10, w: 100, h: 50 };
    expect(hitRect(r, 50, 30)).toBe(true);
    expect(hitRect(r, 5, 30)).toBe(false);
    expect(hitRect(r, 50, 100)).toBe(false);
  });
});

describe('createSession', () => {
  it('처음에는 idle이다', () => {
    const { session } = mkSession(stubCtx());
    expect(session.state()).toBe('idle');
  });

  it('start가 init을 부르고 playing으로 간다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    expect(g.log).toEqual(['init']);
    expect(session.state()).toBe('playing');
  });

  it('start가 게임의 controls를 입력에 알린다', () => {
    const ctx = stubCtx();
    const { session, core } = mkSession(ctx);
    session.start(fakeGame({ controls: 'versus' }));
    expect(core.controlsSeen).toEqual(['versus']);
  });

  it('새 게임을 시작하면 이전 게임을 dispose한다', () => {
    const { session } = mkSession(stubCtx());
    const a = fakeGame();
    const b = fakeGame();
    session.start(a);
    session.start(b);
    expect(a.log).toContain('dispose');
  });

  it('playing이면 update를 흘려보낸다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(1);
  });

  it('일시정지하면 게임 update가 멈춘다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    session.tap(sessionButtons(960, 640).pause.x + 5, sessionButtons(960, 640).pause.y + 5);
    expect(session.state()).toBe('paused');
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(0);
  });

  it('재개하면 다시 돈다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.tap(B.resume.x + 5, B.resume.y + 5)).toBe('resume');
    expect(session.state()).toBe('playing');
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(1);
  });

  it('onScore를 받아 점수를 들고 있는다', () => {
    const { session } = mkSession(stubCtx());
    session.start(fakeGame({ update() { this.api.onScore(42); } }));
    session.update(1 / 60);
    expect(session.score()).toBe(42);
  });

  it('onGameOver면 over로 가고 기록을 남기고 update를 멈춘다', () => {
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame({ update() { this.api.onGameOver({ score: 77 }); } });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(records.best('test-game')).toBe(77);
    expect(session.result().isNew).toBe(true);
    const before = g.log.filter((l) => l === 'update').length;
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(before);
  });

  it('over 화면에서 다시하기를 누르면 재시작한다', () => {
    const { session } = mkSession(stubCtx());
    let ended = false;
    const g = fakeGame({ update() { if (!ended) { ended = true; this.api.onGameOver({ score: 1 }); } } });
    session.start(g);
    session.update(1 / 60);
    const B = sessionButtons(960, 640);
    expect(session.tap(B.restart.x + 5, B.restart.y + 5)).toBe('restart');
    expect(session.state()).toBe('playing');
    expect(g.log.filter((l) => l === 'init').length).toBe(2);
  });

  it('메뉴로 나가면 dispose하고 onExit을 부른다', () => {
    let exited = false;
    const { session } = mkSession(stubCtx(), () => { exited = true; });
    const g = fakeGame();
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.tap(B.menu.x + 5, B.menu.y + 5)).toBe('menu');
    expect(g.log).toContain('dispose');
    expect(exited).toBe(true);
    expect(session.state()).toBe('idle');
  });

  it('빈 곳을 탭하면 null이다', () => {
    const { session } = mkSession(stubCtx());
    session.start(fakeGame());
    expect(session.tap(480, 320)).toBe(null);
  });

  it('idle에서 render해도 터지지 않는다', () => {
    const { session } = mkSession(stubCtx());
    expect(() => session.render(stubCtx())).not.toThrow();
  });

  it('render는 게임을 그리고 HUD를 얹는다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame();
    session.start(g);
    session.render(ctx);
    expect(g.log).toContain('render');
    expect(ctx.calls.map((c) => c[0])).toContain('fillText');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/session.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/shell/session.js`:
```js
import { PALETTE } from '../core/draw.js';

const W = 960;
const H = 640;

export function sessionButtons(w = W, h = H) {
  const bw = 200;
  const bh = 56;
  const cx = w / 2 - bw / 2;
  return {
    pause: { x: w - 68, y: 16, w: 52, h: 52 },
    resume: { x: cx, y: h / 2 - 20, w: bw, h: bh },
    restart: { x: cx, y: h / 2 + 52, w: bw, h: bh },
    menu: { x: cx, y: h / 2 + 124, w: bw, h: bh },
  };
}

export function hitRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 게임 하나의 수명을 관리한다. 셸에서 게임으로 들어가는 유일한 문.
export function createSession({ core, records, onExit }) {
  const B = sessionButtons(W, H);
  let game = null;
  let state = 'idle';
  let score = 0;
  let result = null;

  function makeApi() {
    return {
      w: W,
      h: H,
      input: core.input,
      draw: core.draw,
      audio: core.audio,
      juice: core.juice,
      rng: core.rng,
      onScore(n) { if (Number.isFinite(n)) score = n; },
      onGameOver(res = {}) {
        if (state === 'over') return;
        state = 'over';
        const finalScore = Number.isFinite(res.score) ? res.score : score;
        score = finalScore;
        const rec = records.submit(game.id, finalScore, game.scoreOrder);
        result = { ...res, score: finalScore, ...rec };
      },
    };
  }

  function launch(g) {
    game = g;
    score = 0;
    result = null;
    state = 'playing';
    core.juice.reset();
    core.input.setControls?.(g.controls ?? 'pointer');
    g.init(makeApi());
  }

  return {
    start(g) {
      if (game) game.dispose();
      launch(g);
    },

    stop() {
      if (game) game.dispose();
      game = null;
      state = 'idle';
      score = 0;
      result = null;
    },

    state: () => state,
    score: () => score,
    result: () => result,
    current: () => game,

    update(dt) {
      core.juice.update(dt);
      if (state !== 'playing') return;
      if (core.juice.frozen()) return;
      game.update(dt);
    },

    render(ctx) {
      const d = core.draw;
      if (!game) { d.clear(); return; }

      const off = core.juice.offset();
      ctx.save();
      ctx.translate(off.x, off.y);
      game.render(ctx);
      ctx.restore();
      core.juice.draw(ctx);

      // HUD
      d.text(`${game.scoreLabel} ${score}`, 20, 34, { size: 24, align: 'left', color: PALETTE.white, glow: 6 });
      d.roundRect(B.pause.x, B.pause.y, B.pause.w, B.pause.h, 12, PALETTE.dim, { alpha: 0.7 });
      d.rect(B.pause.x + 17, B.pause.y + 15, 6, 22, PALETTE.white);
      d.rect(B.pause.x + 29, B.pause.y + 15, 6, 22, PALETTE.white);

      if (state === 'paused' || state === 'over') {
        d.rect(0, 0, W, H, PALETTE.bg, { alpha: 0.78 });
        if (state === 'paused') {
          d.text('일시정지', W / 2, H / 2 - 110, { size: 44, bold: true, color: PALETTE.cyan, glow: 16 });
          button(d, B.resume, '계속하기', PALETTE.green);
        } else {
          d.text('게임 끝', W / 2, H / 2 - 150, { size: 44, bold: true, color: PALETTE.magenta, glow: 16 });
          d.text(`${game.scoreLabel} ${score}`, W / 2, H / 2 - 92, { size: 30, color: PALETTE.white });
          if (result?.isNew) {
            d.text('새 최고기록!', W / 2, H / 2 - 50, { size: 24, bold: true, color: PALETTE.yellow, glow: 12 });
          } else if (result?.best !== null && result?.best !== undefined) {
            d.text(`최고 ${result.best}`, W / 2, H / 2 - 50, { size: 22, color: PALETTE.dim });
          }
        }
        button(d, B.restart, '다시하기', PALETTE.cyan);
        button(d, B.menu, '메뉴로', PALETTE.orange);
      }
    },

    tap(x, y) {
      if (!game) return null;

      if (state === 'playing' && hitRect(B.pause, x, y)) {
        state = 'paused';
        return 'pause';
      }
      if (state === 'paused' && hitRect(B.resume, x, y)) {
        state = 'playing';
        return 'resume';
      }
      if ((state === 'paused' || state === 'over') && hitRect(B.restart, x, y)) {
        game.dispose();
        launch(game);
        return 'restart';
      }
      if ((state === 'paused' || state === 'over') && hitRect(B.menu, x, y)) {
        game.dispose();
        game = null;
        state = 'idle';
        onExit();
        return 'menu';
      }
      return null;
    },
  };
}

function button(d, r, label, color) {
  d.roundRect(r.x, r.y, r.w, r.h, 14, color, { alpha: 0.16 });
  d.roundRect(r.x, r.y, r.w, r.h, 14, color, { fill: false, width: 2, glow: 10 });
  d.text(label, r.x + r.w / 2, r.y + r.h / 2, { size: 24, bold: true, color });
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/session.test.js`
Expected: `16 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/shell/session.js tests/shell/session.test.js
git commit -m "feat(arcade): shell/session — 게임 마운트·일시정지·결과 화면

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: shell/menu.js — 그리드 메뉴

**Files:**
- Create: `100game/src/shell/menu.js`
- Test: `100game/tests/shell/menu.test.js`

**Interfaces:**
- Consumes: `visibleGames`/`TAGS`(Task 9), `createRecords`(Task 11), `createDraw`(Task 5)
- Produces:
  - `PER_PAGE = 8`
  - `tabsLayout()` → `[{ key, label, x, y, w, h }]` — key는 `'all'` + TAGS
  - `menuLayout(games, page)` → `{ tiles: [{ game, x, y, w, h }], pages, page }`
  - `createMenu({ games, records, draw })` → `{ setFilter(key), filter(), page(), layout(), render(ctx), tap(x, y) → { type: 'game', game } | { type: 'tab', key } | { type: 'page', page } | null }`

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/shell/menu.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { menuLayout, tabsLayout, createMenu, PER_PAGE } from '../../src/shell/menu.js';
import { createRecords } from '../../src/shell/records.js';
import { createStorage } from '../../src/core/storage.js';
import { createDraw } from '../../src/core/draw.js';
import { stubCtx } from '../helpers/stubCtx.js';

const g = (id, tags = ['action'], over = {}) => ({
  id, title: id, tags, players: 1, color: '#39f6ff', controls: 'dpad',
  scoreOrder: 'high', scoreLabel: '점수', archived: false,
  icon() {}, init() {}, update() {}, render() {}, dispose() {}, ...over,
});

function mem() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const mkRecords = () => createRecords(createStorage('yj', mem()));

describe('tabsLayout', () => {
  it('전체 탭이 맨 앞이다', () => {
    expect(tabsLayout()[0].key).toBe('all');
  });

  it('모든 탭이 화면 안에 있다', () => {
    for (const t of tabsLayout()) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(960);
    }
  });
});

describe('menuLayout', () => {
  it('한 페이지에 PER_PAGE개까지 놓는다', () => {
    const games = Array.from({ length: 20 }, (_, i) => g(`g${i}`));
    const L = menuLayout(games, 0);
    expect(L.tiles.length).toBe(PER_PAGE);
    expect(L.pages).toBe(Math.ceil(20 / PER_PAGE));
  });

  it('다음 페이지는 이어지는 게임을 놓는다', () => {
    const games = Array.from({ length: 20 }, (_, i) => g(`g${i}`));
    expect(menuLayout(games, 1).tiles[0].game.id).toBe(`g${PER_PAGE}`);
  });

  it('범위를 벗어난 페이지는 마지막 페이지로 접는다', () => {
    const games = Array.from({ length: 3 }, (_, i) => g(`g${i}`));
    expect(menuLayout(games, 9).page).toBe(0);
  });

  it('타일이 겹치지 않는다', () => {
    const games = Array.from({ length: PER_PAGE }, (_, i) => g(`g${i}`));
    const { tiles } = menuLayout(games, 0);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i], b = tiles[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('타일이 화면 안에 있다', () => {
    const games = Array.from({ length: PER_PAGE }, (_, i) => g(`g${i}`));
    for (const t of menuLayout(games, 0).tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(960);
      expect(t.y + t.h).toBeLessThanOrEqual(640);
    }
  });

  it('게임이 없으면 빈 레이아웃이다', () => {
    const L = menuLayout([], 0);
    expect(L.tiles).toEqual([]);
    expect(L.pages).toBe(1);
  });
});

describe('createMenu', () => {
  const games = [g('a', ['action']), g('b', ['puzzle']), g('c', ['action'], { archived: true })];
  const mk = (ctx) => createMenu({ games, records: mkRecords(), draw: createDraw(ctx) });

  it('기본 필터는 전체이고 archived를 뺀다', () => {
    const m = mk(stubCtx());
    expect(m.filter()).toBe('all');
    expect(m.layout().tiles.map((t) => t.game.id)).toEqual(['a', 'b']);
  });

  it('탭을 누르면 필터가 바뀐다', () => {
    const m = mk(stubCtx());
    const tab = tabsLayout().find((t) => t.key === 'puzzle');
    expect(m.tap(tab.x + 5, tab.y + 5)).toEqual({ type: 'tab', key: 'puzzle' });
    expect(m.layout().tiles.map((t) => t.game.id)).toEqual(['b']);
  });

  it('타일을 누르면 게임을 돌려준다', () => {
    const m = mk(stubCtx());
    const tile = m.layout().tiles[0];
    expect(m.tap(tile.x + 5, tile.y + 5)).toEqual({ type: 'game', game: tile.game });
  });

  it('빈 곳은 null이다', () => {
    expect(mk(stubCtx()).tap(5, 620)).toBe(null);
  });

  it('필터를 바꾸면 페이지가 0으로 돌아간다', () => {
    const many = Array.from({ length: 20 }, (_, i) => g(`g${i}`, i % 2 ? ['puzzle'] : ['action']));
    const m = createMenu({ games: many, records: mkRecords(), draw: createDraw(stubCtx()) });
    const next = m.layout();
    m.tap(next.next.x + 5, next.next.y + 5);
    expect(m.page()).toBe(1);
    m.setFilter('puzzle');
    expect(m.page()).toBe(0);
  });

  it('render가 타일과 제목을 그린다', () => {
    const ctx = stubCtx();
    mk(ctx).render(ctx);
    const names = ctx.calls.map((c) => c[0]);
    expect(names).toContain('fillText');
    expect(names.filter((n) => n === 'save').length)
      .toBe(names.filter((n) => n === 'restore').length);
  });

  it('최고기록이 있으면 타일에 표시한다', () => {
    const records = mkRecords();
    records.submit('a', 123);
    const ctx = stubCtx();
    createMenu({ games, records, draw: createDraw(ctx) }).render(ctx);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => String(c[1]));
    expect(texts.some((t) => t.includes('123'))).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/menu.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/shell/menu.js`:
```js
import { PALETTE } from '../core/draw.js';
import { TAGS, visibleGames } from './registry.js';
import { hitRect } from './session.js';

const W = 960;
const H = 640;
export const PER_PAGE = 8;

const COLS = 4;
const TILE_W = 210;
const TILE_H = 200;
const GAP = 24;
const GRID_TOP = 100;
const GRID_LEFT = (W - (COLS * TILE_W + (COLS - 1) * GAP)) / 2;

const TAB_LABEL = {
  all: '전체', action: '액션', puzzle: '퍼즐', defense: '디펜스',
  sports: '스포츠', quiz: '퀴즈', versus: '대전',
};

export function tabsLayout() {
  const keys = ['all', ...TAGS];
  const w = 110;
  const gap = 8;
  const total = keys.length * w + (keys.length - 1) * gap;
  const left = (W - total) / 2;
  return keys.map((key, i) => ({
    key, label: TAB_LABEL[key], x: left + i * (w + gap), y: 20, w, h: 44,
  }));
}

export function menuLayout(games, page = 0) {
  const pages = Math.max(1, Math.ceil(games.length / PER_PAGE));
  const p = page >= 0 && page < pages ? page : 0;
  const slice = games.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);

  const tiles = slice.map((game, i) => ({
    game,
    x: GRID_LEFT + (i % COLS) * (TILE_W + GAP),
    y: GRID_TOP + Math.floor(i / COLS) * (TILE_H + GAP),
    w: TILE_W,
    h: TILE_H,
  }));

  return {
    tiles,
    pages,
    page: p,
    prev: { x: GRID_LEFT, y: 566, w: 90, h: 48 },
    next: { x: GRID_LEFT + COLS * TILE_W + (COLS - 1) * GAP - 90, y: 566, w: 90, h: 48 },
  };
}

export function createMenu({ games, records, draw }) {
  let filter = 'all';
  let page = 0;
  const tabs = tabsLayout();

  const shown = () => visibleGames(games, filter);
  const layout = () => menuLayout(shown(), page);

  return {
    filter: () => filter,
    page: () => page,
    layout,

    setFilter(key) {
      filter = key;
      page = 0;
    },

    tap(x, y) {
      for (const t of tabs) {
        if (hitRect(t, x, y)) {
          this.setFilter(t.key);
          return { type: 'tab', key: t.key };
        }
      }
      const L = layout();
      for (const tile of L.tiles) {
        if (hitRect(tile, x, y)) return { type: 'game', game: tile.game };
      }
      if (L.pages > 1 && hitRect(L.next, x, y)) {
        page = (page + 1) % L.pages;
        return { type: 'page', page };
      }
      if (L.pages > 1 && hitRect(L.prev, x, y)) {
        page = (page - 1 + L.pages) % L.pages;
        return { type: 'page', page };
      }
      return null;
    },

    render(ctx) {
      const d = draw;
      d.clear();
      d.text('YJ 아케이드', 24, 42, { size: 26, bold: true, align: 'left', color: PALETTE.cyan, glow: 12 });

      for (const t of tabs) {
        const on = t.key === filter;
        d.roundRect(t.x, t.y, t.w, t.h, 12, on ? PALETTE.cyan : PALETTE.panel, { alpha: on ? 0.22 : 1 });
        d.roundRect(t.x, t.y, t.w, t.h, 12, on ? PALETTE.cyan : PALETTE.dim, { fill: false, width: 2, glow: on ? 10 : 0 });
        d.text(t.label, t.x + t.w / 2, t.y + t.h / 2, { size: 19, bold: on, color: on ? PALETTE.cyan : PALETTE.white });
      }

      const L = layout();
      if (L.tiles.length === 0) {
        d.text('이 칸에는 아직 게임이 없어요', W / 2, H / 2, { size: 24, color: PALETTE.dim });
        return;
      }

      for (const tile of L.tiles) {
        const { game } = tile;
        d.roundRect(tile.x, tile.y, tile.w, tile.h, 18, PALETTE.panel);
        d.roundRect(tile.x, tile.y, tile.w, tile.h, 18, game.color, { fill: false, width: 2, glow: 12 });

        // 게임이 자기 아이콘을 그린다. 좌표계를 타일 안으로 옮겨준다.
        const iconSize = 96;
        ctx.save();
        ctx.translate(tile.x + tile.w / 2 - iconSize / 2, tile.y + 26);
        game.icon(ctx, iconSize);
        ctx.restore();

        d.text(game.title, tile.x + tile.w / 2, tile.y + 152, { size: 20, bold: true, color: PALETTE.white });

        const best = records.best(game.id);
        d.text(
          best === null ? '기록 없음' : `최고 ${best}`,
          tile.x + tile.w / 2, tile.y + 178,
          { size: 16, color: best === null ? PALETTE.dim : PALETTE.yellow },
        );

        if (game.players === 2) {
          d.text('2인', tile.x + tile.w - 30, tile.y + 20, { size: 15, bold: true, color: PALETTE.magenta });
        }
      }

      if (L.pages > 1) {
        for (const [rect, label] of [[L.prev, '◀'], [L.next, '▶']]) {
          d.roundRect(rect.x, rect.y, rect.w, rect.h, 12, PALETTE.panel);
          d.roundRect(rect.x, rect.y, rect.w, rect.h, 12, PALETTE.dim, { fill: false, width: 2 });
          d.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2, { size: 22, color: PALETTE.white });
        }
        d.text(`${L.page + 1} / ${L.pages}`, W / 2, 590, { size: 18, color: PALETTE.dim });
      }
    },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/menu.test.js`
Expected: `15 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/shell/menu.js tests/shell/menu.test.js
git commit -m "feat(arcade): shell/menu — 탭·페이지가 있는 그리드 메뉴

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: main.js — 결선과 캔버스 스케일링

**Files:**
- Create: `100game/src/shell/viewport.js`
- Modify: `100game/src/main.js` (Task 1의 자리표시 코드를 전부 대체)
- Test: `100game/tests/shell/viewport.test.js`

**Interfaces:**
- Consumes: 전 태스크
- Produces:
  - `LOGICAL_W = 960`, `LOGICAL_H = 640`
  - `computeFit(cssW, cssH, dpr)` → `{ backingW, backingH, scale, offsetX, offsetY }` — 논리 화면을 물리 캔버스 가운데에 레터박스로 맞춘다
  - `toLogicalFactory(fit)` → `(px, py) => { x, y }` — 캔버스 기준 물리 픽셀을 논리 좌표로

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/shell/viewport.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeFit, toLogicalFactory, LOGICAL_W, LOGICAL_H } from '../../src/shell/viewport.js';

describe('computeFit', () => {
  it('논리 해상도는 960x640이다', () => {
    expect([LOGICAL_W, LOGICAL_H]).toEqual([960, 640]);
  });

  it('정확히 맞는 크기는 배율 1, 여백 0이다', () => {
    const f = computeFit(960, 640, 1);
    expect(f.scale).toBe(1);
    expect(f.offsetX).toBe(0);
    expect(f.offsetY).toBe(0);
  });

  it('가로가 남으면 좌우에 여백을 준다', () => {
    const f = computeFit(1920, 640, 1);
    expect(f.scale).toBe(1);
    expect(f.offsetX).toBe(480);
    expect(f.offsetY).toBe(0);
  });

  it('세로가 남으면 위아래에 여백을 준다', () => {
    const f = computeFit(960, 1280, 1);
    expect(f.scale).toBe(1);
    expect(f.offsetY).toBe(320);
  });

  it('작은 화면은 축소한다', () => {
    expect(computeFit(480, 320, 1).scale).toBe(0.5);
  });

  it('devicePixelRatio를 백킹 크기에 반영한다', () => {
    const f = computeFit(960, 640, 2);
    expect(f.backingW).toBe(1920);
    expect(f.backingH).toBe(1280);
    expect(f.scale).toBe(2);
  });
});

describe('toLogicalFactory', () => {
  it('여백 없는 화면은 그대로 매핑한다', () => {
    const to = toLogicalFactory(computeFit(960, 640, 1));
    expect(to(0, 0)).toEqual({ x: 0, y: 0 });
    expect(to(960, 640)).toEqual({ x: 960, y: 640 });
  });

  it('여백과 배율을 되돌린다', () => {
    const fit = computeFit(1920, 640, 1); // offsetX 480, scale 1
    const to = toLogicalFactory(fit);
    expect(to(480, 0)).toEqual({ x: 0, y: 0 });
    expect(to(1440, 640)).toEqual({ x: 960, y: 640 });
  });

  it('축소된 화면도 되돌린다', () => {
    const to = toLogicalFactory(computeFit(480, 320, 1)); // scale 0.5
    expect(to(240, 160)).toEqual({ x: 480, y: 320 });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/viewport.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: viewport 구현**

`100game/src/shell/viewport.js`:
```js
// 논리 해상도 고정 + 레터박스. 게임은 언제나 960x640에 그린다.
export const LOGICAL_W = 960;
export const LOGICAL_H = 640;

export function computeFit(cssW, cssH, dpr = 1) {
  const backingW = Math.round(cssW * dpr);
  const backingH = Math.round(cssH * dpr);
  const scale = Math.min(backingW / LOGICAL_W, backingH / LOGICAL_H);
  return {
    backingW,
    backingH,
    scale,
    offsetX: (backingW - LOGICAL_W * scale) / 2,
    offsetY: (backingH - LOGICAL_H * scale) / 2,
  };
}

// 캔버스 좌상단 기준 물리 픽셀 → 논리 좌표
export function toLogicalFactory(fit) {
  return (px, py) => ({
    x: (px - fit.offsetX) / fit.scale,
    y: (py - fit.offsetY) / fit.scale,
  });
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/shell/viewport.test.js`
Expected: `9 passed`

- [ ] **Step 5: main.js 결선 (Task 1의 내용을 전부 대체)**

`100game/src/main.js`:
```js
import { createLoop } from './core/loop.js';
import { createDraw } from './core/draw.js';
import { createAudio } from './core/audio.js';
import { createJuice } from './core/juice.js';
import { makeRng } from './core/rng.js';
import { createInput } from './core/input.js';
import { createStorage } from './core/storage.js';
import { collectGames } from './shell/registry.js';
import { createRecords } from './shell/records.js';
import { createSession } from './shell/session.js';
import { createMenu } from './shell/menu.js';
import { computeFit, toLogicalFactory, LOGICAL_W, LOGICAL_H } from './shell/viewport.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

let fit = computeFit(innerWidth, innerHeight, devicePixelRatio || 1);
let toLogical = toLogicalFactory(fit);

function resize() {
  fit = computeFit(innerWidth, innerHeight, devicePixelRatio || 1);
  toLogical = toLogicalFactory(fit);
  canvas.width = fit.backingW;
  canvas.height = fit.backingH;
}
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
resize();

// 게임 자동 수집. 파일 하나 추가 = 게임 하나 추가.
const { games, errors } = collectGames(import.meta.glob('./games/*.js', { eager: true }));
if (errors.length) console.warn('[YJ 아케이드] 계약 위반 게임:', errors);

const seed = (Date.now() ^ 0x5f3759df) >>> 0;
const core = {
  draw: createDraw(ctx),
  audio: createAudio(),
  juice: createJuice(makeRng(seed)),
  rng: makeRng(seed),
  input: createInput({
    canvas,
    // pointer 이벤트는 CSS 픽셀 → 캔버스 물리 픽셀 → 논리 좌표 순으로 변환한다.
    toLogical: (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;
      return toLogical((clientX - r.left) * dpr, (clientY - r.top) * dpr);
    },
  }),
};

const records = createRecords(createRecordsStorage());
function createRecordsStorage() {
  return createStorage('yj-arcade');
}

let mode = 'menu';
const session = createSession({ core, records, onExit: () => { mode = 'menu'; } });
const menu = createMenu({ games, records, draw: core.draw });

// 탭 처리: 포인터가 눌린 프레임에만 반응한다.
function handleTap() {
  const p = core.input.pointer;
  if (!p.pressed) return;
  if (mode === 'menu') {
    const hit = menu.tap(p.x, p.y);
    if (hit?.type === 'game') {
      mode = 'game';
      session.start(hit.game);
      core.audio.beep(660, 60);
    }
  } else {
    session.tap(p.x, p.y);
  }
}

const loop = createLoop({
  dt: 1 / 60,
  update: (dt) => {
    core.input.update();
    handleTap();
    if (mode === 'game') session.update(dt);
    else core.juice.update(dt);
  },
  render: () => {
    // 물리 캔버스를 지우고 논리 좌표계로 들어간다.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.offsetX, fit.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.clip();

    if (mode === 'game') session.render(ctx);
    else menu.render(ctx);
  },
});

// 탭 전환 시 자동 일시정지 — 아이패드에서 앱을 나갔다 오면 시간이 튀는 걸 막는다.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

loop.start();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 캐시는 있으면 좋고 없어도 동작 */ });
  });
}
```

- [ ] **Step 6: 실제로 뜨는지 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm run build`
Expected: `dist/` 생성, 오류 없음. 번들에 외부 의존성이 없어야 한다.

Run: `cd /Users/junghakjun/ai_work/game/100game && npm run dev`
브라우저에서 `http://localhost:5173` 확인:
- 검은 배경에 "YJ 아케이드" 제목과 탭이 보인다
- 게임이 아직 없으므로 "이 칸에는 아직 게임이 없어요"가 보인다
- 콘솔에 오류가 없다

확인 후 dev 서버를 끈다.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/main.js src/shell/viewport.js tests/shell/viewport.test.js
git commit -m "feat(arcade): main 결선 + 레터박스 뷰포트 — 메뉴가 실제로 뜬다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: PWA — 홈화면 설치 + 오프라인

**Files:**
- Create: `100game/manifest.webmanifest`, `100game/sw.js`, `100game/icon.svg`, `100game/scripts/make-icon.mjs`, `100game/icon-180.png`, `100game/icon-512.png`
- Test: `100game/tests/pwa.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: 빌드 산출물이 서비스워커로 프리캐시되어 비행기모드에서 실행된다. 아이콘 PNG는 의존성 없이 `node:zlib`로 직접 생성한다(이미지 파일 0개 원칙의 유일한 예외 — 앱 아이콘은 PWA 필수).

- [ ] **Step 1: 아이콘 생성 스크립트 작성**

`100game/scripts/make-icon.mjs`:
```js
// 의존성 없이 PNG를 직접 쓴다. 앱 아이콘은 PWA에 필수라 코드로 만든다.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [5, 6, 13];
const CYAN = [57, 246, 255];
const MAGENTA = [255, 46, 136];

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = size * 0.14;
  const ringOuter = size - pad;
  const thick = size * 0.075;
  const c = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 라운드 사각 링(시안) + 가운데 다이아몬드(마젠타)
      const inRect = x >= pad && x <= ringOuter && y >= pad && y <= ringOuter;
      const inInner = x >= pad + thick && x <= ringOuter - thick && y >= pad + thick && y <= ringOuter - thick;
      const diamond = Math.abs(x - c) + Math.abs(y - c) < size * 0.17;

      let col = BG;
      if (inRect && !inInner) col = CYAN;
      if (diamond) col = MAGENTA;

      const i = (y * size + x) * 4;
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

writeFileSync(new URL('../icon-180.png', import.meta.url), render(180));
writeFileSync(new URL('../icon-512.png', import.meta.url), render(512));
console.log('icon-180.png, icon-512.png 생성 완료');
```

- [ ] **Step 2: 아이콘 생성**

Run: `cd /Users/junghakjun/ai_work/game/100game && node scripts/make-icon.mjs`
Expected: `icon-180.png, icon-512.png 생성 완료`

Run: `cd /Users/junghakjun/ai_work/game/100game && file icon-180.png icon-512.png`
Expected: `PNG image data, 180 x 180` / `PNG image data, 512 x 512`

- [ ] **Step 3: manifest·SVG 아이콘·서비스워커 작성**

`100game/manifest.webmanifest`:
```json
{
  "name": "YJ 아케이드",
  "short_name": "YJ아케이드",
  "description": "유준이의 오프라인 게임 모음집",
  "start_url": "./index.html",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#05060d",
  "theme_color": "#05060d",
  "icons": [
    { "src": "./icon-180.png", "sizes": "180x180", "type": "image/png" },
    { "src": "./icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

`100game/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#05060d"/>
  <rect x="72" y="72" width="368" height="368" rx="64" fill="none" stroke="#39f6ff" stroke-width="38"/>
  <path d="M256 168 L344 256 L256 344 L168 256 Z" fill="#ff2e88"/>
</svg>
```

`100game/sw.js`:
```js
// 오프라인 캐시. 첫 방문 때 받은 자산을 캐시에 넣고, 이후에는 캐시 우선으로 낸다.
const CACHE = 'yj-arcade-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('오프라인'))));
    }),
  );
});
```

- [ ] **Step 4: 실패하는 테스트 작성**

`100game/tests/pwa.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));

describe('PWA', () => {
  it('manifest가 올바른 JSON이고 필수 필드를 갖는다', () => {
    const m = JSON.parse(read('manifest.webmanifest').toString());
    expect(m.name).toBe('YJ 아케이드');
    expect(m.start_url).toBe('./index.html');
    expect(m.display).toBe('fullscreen');
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('아이콘 PNG가 실제 PNG다', () => {
    for (const [file, size] of [['icon-180.png', 180], ['icon-512.png', 512]]) {
      expect(existsSync(new URL(file, root))).toBe(true);
      const buf = read(file);
      expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG 시그니처
      expect(buf.readUInt32BE(16)).toBe(size); // IHDR width
      expect(buf.readUInt32BE(20)).toBe(size); // IHDR height
    }
  });

  it('index.html이 manifest와 apple-touch-icon을 연결한다', () => {
    const html = read('index.html').toString();
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('apple-touch-icon');
  });

  it('서비스워커가 핵심 자산을 프리캐시한다', () => {
    const sw = read('sw.js').toString();
    expect(sw).toContain('./index.html');
    expect(sw).toContain('addAll');
    expect(sw).toContain('skipWaiting');
  });

  it('main.js가 서비스워커를 등록한다', () => {
    expect(read('src/main.js').toString()).toContain("register('./sw.js')");
  });
});
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/pwa.test.js`
Expected: `5 passed`

- [ ] **Step 6: 빌드 산출물에 PWA 파일이 들어가는지 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm run build && ls dist`
Expected: `dist/`에 `index.html`, `assets/`, `manifest.webmanifest`, `sw.js`, `icon-180.png`, `icon-512.png`, `icon.svg`가 모두 있다.

만약 `sw.js`·`manifest.webmanifest`·아이콘이 `dist/`에 없으면, 이 파일들을 `100game/public/`으로 옮기고(`index.html`의 경로는 그대로 `./`) 다시 빌드해 확인한다. Vite는 `public/`의 내용을 그대로 복사한다. 옮겼다면 `tests/pwa.test.js`의 경로도 `public/`으로 함께 고친다.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add manifest.webmanifest sw.js icon.svg icon-180.png icon-512.png scripts/make-icon.mjs tests/pwa.test.js
git commit -m "feat(arcade): PWA — 홈화면 설치와 오프라인 캐시

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: games/neon-snake.js — 금형 검증 1

여기서부터 단계 B다. **이 파일은 앞으로 양산 에이전트가 보는 모범 예시가 된다.** 순수 로직을 named export로 빼고, 계약 객체는 그 로직을 얇게 감싸기만 한다.

**Files:**
- Create: `100game/src/games/neon-snake.js`
- Test: `100game/tests/games/neon-snake.test.js`

**Interfaces:**
- Consumes: `api` (계약), `PALETTE`(Task 5)
- Produces (named export, 테스트용):
  - `createSnakeState({ cols = 24, rows = 16 })` → `{ cols, rows, snake: {x,y}[], dir, next, food, score, dead }`
  - `turn(state, dx, dy)` → state (반대 방향은 무시)
  - `stepSnake(state, spawnFood)` → state. `spawnFood(state)` → `{x,y}`
  - default export: 계약 객체 (id `neon-snake`, tags `['action']`, controls `'dpad'`)

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/games/neon-snake.test.js`:
```js
import { describe, it, expect } from 'vitest';
import game, { createSnakeState, turn, stepSnake } from '../../src/games/neon-snake.js';

const fixedFood = (x, y) => () => ({ x, y });

describe('스네이크 규칙', () => {
  it('초기 상태는 살아 있고 점수가 0이다', () => {
    const s = createSnakeState({});
    expect(s.dead).toBe(false);
    expect(s.score).toBe(0);
    expect(s.snake.length).toBeGreaterThanOrEqual(3);
  });

  it('한 칸 전진한다', () => {
    const s = createSnakeState({});
    const headBefore = { ...s.snake[0] };
    stepSnake(s, fixedFood(-9, -9));
    expect(s.snake[0].x).toBe(headBefore.x + 1);
    expect(s.snake[0].y).toBe(headBefore.y);
  });

  it('길이는 먹기 전까지 유지된다', () => {
    const s = createSnakeState({});
    const len = s.snake.length;
    stepSnake(s, fixedFood(-9, -9));
    stepSnake(s, fixedFood(-9, -9));
    expect(s.snake.length).toBe(len);
  });

  it('먹으면 점수가 오르고 길어진다', () => {
    const s = createSnakeState({});
    const len = s.snake.length;
    s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
    stepSnake(s, fixedFood(0, 0));
    expect(s.score).toBe(1);
    expect(s.snake.length).toBe(len + 1);
  });

  it('반대 방향으로는 못 돈다', () => {
    const s = createSnakeState({});   // 오른쪽으로 진행 중
    turn(s, -1, 0);
    expect(s.next).toEqual({ x: 1, y: 0 });
  });

  it('직각으로는 돈다', () => {
    const s = createSnakeState({});
    turn(s, 0, 1);
    stepSnake(s, fixedFood(-9, -9));
    expect(s.dir).toEqual({ x: 0, y: 1 });
  });

  it('벽을 지나면 반대편으로 나온다', () => {
    const s = createSnakeState({ cols: 5, rows: 5 });
    s.snake = [{ x: 4, y: 2 }, { x: 3, y: 2 }];
    s.dir = { x: 1, y: 0 };
    s.next = { x: 1, y: 0 };
    stepSnake(s, fixedFood(-9, -9));
    expect(s.snake[0]).toEqual({ x: 0, y: 2 });
  });

  it('자기 몸을 물면 죽는다', () => {
    const s = createSnakeState({ cols: 10, rows: 10 });
    s.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }];
    s.dir = { x: 0, y: -1 };
    s.next = { x: 0, y: -1 };
    stepSnake(s, fixedFood(-9, -9));
    expect(s.dead).toBe(true);
  });

  it('죽은 뒤에는 움직이지 않는다', () => {
    const s = createSnakeState({});
    s.dead = true;
    const before = JSON.stringify(s.snake);
    stepSnake(s, fixedFood(-9, -9));
    expect(JSON.stringify(s.snake)).toBe(before);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('neon-snake');
    expect(game.players).toBe(1);
    expect(game.tags).toContain('action');
    expect(game.controls).toBe('dpad');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/games/neon-snake.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/games/neon-snake.js`:
```js
import { PALETTE } from '../core/draw.js';

// ── 순수 규칙 (테스트 대상) ───────────────────────────────────────────────────
export function createSnakeState({ cols = 24, rows = 16 } = {}) {
  const cy = Math.floor(rows / 2);
  const cx = Math.floor(cols / 2);
  return {
    cols, rows,
    snake: [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: Math.min(cols - 1, cx + 4), y: cy },
    score: 0,
    dead: false,
  };
}

export function turn(s, dx, dy) {
  if (dx === -s.dir.x && dy === -s.dir.y) return s;  // 즉사 방지: 180도 금지
  if (dx === 0 && dy === 0) return s;
  s.next = { x: dx, y: dy };
  return s;
}

export function stepSnake(s, spawnFood) {
  if (s.dead) return s;
  s.dir = s.next;

  const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
  head.x = (head.x + s.cols) % s.cols;   // 벽 통과
  head.y = (head.y + s.rows) % s.rows;

  // 꼬리 끝은 이번 스텝에 비워지므로 충돌에서 제외한다.
  const bodyEnd = s.snake.length - 1;
  for (let i = 0; i < bodyEnd; i++) {
    if (s.snake[i].x === head.x && s.snake[i].y === head.y) {
      s.dead = true;
      return s;
    }
  }

  s.snake.unshift(head);
  if (head.x === s.food.x && head.y === s.food.y) {
    s.score += 1;
    s.food = spawnFood(s);
  } else {
    s.snake.pop();
  }
  return s;
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
const COLS = 24;
const ROWS = 16;
const CELL = 36;                       // 24*36 = 864, 16*36 = 576
const OX = (960 - COLS * CELL) / 2;
const OY = (640 - ROWS * CELL) / 2 + 14;
const START_STEP = 0.16;               // 초당 약 6칸
const MIN_STEP = 0.07;

export default {
  id: 'neon-snake',
  title: '네온 스네이크',
  tags: ['action'],
  players: 1,
  color: '#39ff88',
  controls: 'dpad',
  scoreOrder: 'high',
  scoreLabel: '점수',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.green;
    for (const [x, y] of [[1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2]]) {
      ctx.fillRect(x * u, y * u, u - 2, u - 2);
    }
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillRect(6 * u, 2 * u, u - 2, u - 2);
  },

  init(api) {
    this.api = api;
    this.s = createSnakeState({ cols: COLS, rows: ROWS });
    this.acc = 0;
    this.over = false;
    this.spawn = (s) => {
      // 뱀이 없는 칸에서 고른다. 꽉 차면 머리 위치를 그대로 반환(사실상 승리 상태).
      for (let tries = 0; tries < 200; tries++) {
        const p = { x: api.rng.int(s.cols), y: api.rng.int(s.rows) };
        if (!s.snake.some((q) => q.x === p.x && q.y === p.y)) return p;
      }
      return { ...s.snake[0] };
    };
  },

  update(dt) {
    if (this.over) return;
    const p = this.api.input.p1;
    if (Math.abs(p.x) > Math.abs(p.y)) {
      if (p.x > 0.4) turn(this.s, 1, 0);
      else if (p.x < -0.4) turn(this.s, -1, 0);
    } else {
      if (p.y > 0.4) turn(this.s, 0, 1);
      else if (p.y < -0.4) turn(this.s, 0, -1);
    }

    const step = Math.max(MIN_STEP, START_STEP - this.s.score * 0.004);
    this.acc += dt;
    if (this.acc < step) return;
    this.acc -= step;

    const before = this.s.score;
    stepSnake(this.s, this.spawn);

    if (this.s.score > before) {
      this.api.audio.beep(880, 60);
      const f = this.s.food;
      this.api.juice.burst(OX + f.x * CELL + CELL / 2, OY + f.y * CELL + CELL / 2,
        { color: PALETTE.magenta, count: 10, speed: 140 });
      this.api.onScore(this.s.score);
    }

    if (this.s.dead) {
      this.over = true;
      this.api.audio.sweep(400, 80, 260);
      this.api.juice.shake(10, 0.3);
      const h = this.s.snake[0];
      this.api.juice.burst(OX + h.x * CELL + CELL / 2, OY + h.y * CELL + CELL / 2,
        { color: PALETTE.green, count: 22, speed: 220 });
      this.api.onGameOver({ score: this.s.score });
    }
  },

  render(ctx) {
    const d = this.api.draw;
    d.clear();
    d.rect(OX - 4, OY - 4, COLS * CELL + 8, ROWS * CELL + 8, PALETTE.dim, { fill: false, width: 2 });

    const f = this.s.food;
    d.circle(OX + f.x * CELL + CELL / 2, OY + f.y * CELL + CELL / 2, CELL * 0.3,
      PALETTE.magenta, { glow: 14 });

    this.s.snake.forEach((p, i) => {
      const head = i === 0;
      d.roundRect(OX + p.x * CELL + 3, OY + p.y * CELL + 3, CELL - 6, CELL - 6, 7,
        head ? PALETTE.white : PALETTE.green, { glow: head ? 16 : 6 });
    });
  },

  dispose() {
    this.s = null;
    this.api = null;
  },
};
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/games/neon-snake.test.js`
Expected: `10 passed`

- [ ] **Step 5: 계약 테스트가 이 게임을 자동으로 검사하는지 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/contract.test.js`
Expected: `게임 계약 — neon-snake` 블록의 6개 테스트가 모두 통과

- [ ] **Step 6: 실제로 플레이해보고 커밋**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm run dev` → 메뉴에 "네온 스네이크" 타일이 뜨고, 눌러서 키보드 WASD로 조종되는지 확인한다. 먹으면 점수가 오르고, 죽으면 결과 화면이 뜬다.

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/games/neon-snake.js tests/games/neon-snake.test.js
git commit -m "feat(arcade): 네온 스네이크 — 첫 게임, 계약 금형 검증

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 17: games/crossy-robot.js — 금형 검증 2

스네이크는 격자·턴제였다. 이번엔 **연속 시간·이동체 충돌** 계열을 만들어 계약이 다른 장르에서도 통하는지 본다.

**Files:**
- Create: `100game/src/games/crossy-robot.js`
- Test: `100game/tests/games/crossy-robot.test.js`

**Interfaces:**
- Consumes: `api`(계약), `PALETTE`(Task 5)
- Produces (named export):
  - `makeLane(index, rng)` → `{ type: 'safe'|'road', dir, speed, cars: {x,w}[] }`
  - `createCrossyState({ cols, lanes, rng })` → `{ cols, lanes: Lane[], player: {col, lane}, crossed, dead }`
  - `advanceCars(state, dt)` → state (차는 화면 밖으로 나가면 반대편에서 다시 들어온다)
  - `laneHit(lane, col)` → bool
  - `movePlayer(state, dcol, dlane, rng)` → `{ moved, scored }` (위로 갈 때만 점수)
  - default export: 계약 객체 (id `crossy-robot`, tags `['action']`, controls `'dpad'`)

- [ ] **Step 1: 실패하는 테스트 작성**

`100game/tests/games/crossy-robot.test.js`:
```js
import { describe, it, expect } from 'vitest';
import game, { makeLane, createCrossyState, advanceCars, laneHit, movePlayer } from '../../src/games/crossy-robot.js';
import { makeRng } from '../../src/core/rng.js';

const rng = () => makeRng(99);

describe('레인 생성', () => {
  it('4번째마다 안전지대다', () => {
    expect(makeLane(0, rng()).type).toBe('safe');
    expect(makeLane(4, rng()).type).toBe('safe');
    expect(makeLane(1, rng()).type).toBe('road');
  });

  it('도로에는 차와 방향과 속도가 있다', () => {
    const l = makeLane(1, rng());
    expect(l.cars.length).toBeGreaterThan(0);
    expect(Math.abs(l.dir)).toBe(1);
    expect(l.speed).toBeGreaterThan(0);
  });

  it('안전지대에는 차가 없다', () => {
    expect(makeLane(0, rng()).cars).toEqual([]);
  });
});

describe('초기 상태', () => {
  it('플레이어는 맨 아래 안전지대 가운데에 선다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    expect(s.player.lane).toBe(0);
    expect(s.player.col).toBe(7);
    expect(s.lanes[0].type).toBe('safe');
    expect(s.crossed).toBe(0);
    expect(s.dead).toBe(false);
  });
});

describe('차 이동', () => {
  it('방향대로 움직인다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const road = s.lanes.find((l) => l.type === 'road');
    road.dir = 1;
    road.speed = 2;
    road.cars = [{ x: 3, w: 2 }];
    advanceCars(s, 0.5);
    expect(road.cars[0].x).toBeCloseTo(4);
  });

  it('오른쪽으로 나가면 왼쪽에서 다시 들어온다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const road = s.lanes.find((l) => l.type === 'road');
    road.dir = 1;
    road.speed = 1;
    road.cars = [{ x: 15.5, w: 2 }];
    advanceCars(s, 0.1);
    expect(road.cars[0].x).toBeLessThan(0);
  });

  it('왼쪽으로 나가면 오른쪽에서 다시 들어온다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const road = s.lanes.find((l) => l.type === 'road');
    road.dir = -1;
    road.speed = 1;
    road.cars = [{ x: -2.5, w: 2 }];
    advanceCars(s, 0.1);
    expect(road.cars[0].x).toBeGreaterThan(14);
  });
});

describe('충돌 판정', () => {
  it('차 위에 있으면 맞는다', () => {
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 3)).toBe(true);
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 4)).toBe(true);
  });

  it('차 밖이면 안 맞는다', () => {
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 6)).toBe(false);
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 1)).toBe(false);
  });

  it('안전지대에서는 절대 안 맞는다', () => {
    expect(laneHit({ type: 'safe', cars: [] }, 5)).toBe(false);
  });
});

describe('플레이어 이동', () => {
  it('좌우로 움직인다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    movePlayer(s, 1, 0, rng());
    expect(s.player.col).toBe(8);
  });

  it('화면 밖으로는 못 나간다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    s.player.col = 0;
    expect(movePlayer(s, -1, 0, rng()).moved).toBe(false);
    expect(s.player.col).toBe(0);
  });

  it('위로 가면 점수가 오른다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const r = movePlayer(s, 0, 1, rng());
    expect(r.scored).toBe(true);
    expect(s.crossed).toBe(1);
  });

  it('되돌아 내려와도 점수는 안 깎인다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    movePlayer(s, 0, 1, rng());
    movePlayer(s, 0, -1, rng());
    expect(s.crossed).toBe(1);
  });

  it('맨 아래에서 더 내려가지 못한다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    expect(movePlayer(s, 0, -1, rng()).moved).toBe(false);
  });

  it('위쪽에 다다르면 판이 스크롤되고 새 레인이 생긴다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const r = rng();
    for (let i = 0; i < 9; i++) movePlayer(s, 0, 1, r);
    expect(s.lanes.length).toBe(11);          // 길이는 유지
    expect(s.player.lane).toBeLessThan(11);   // 화면 안에 남는다
    expect(s.crossed).toBe(9);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('crossy-robot');
    expect(game.players).toBe(1);
    expect(game.controls).toBe('dpad');
    expect(game.scoreOrder).toBe('high');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/games/crossy-robot.test.js`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`100game/src/games/crossy-robot.js`:
```js
import { PALETTE } from '../core/draw.js';

const SCROLL_AT = 6;   // 이 레인 위로 올라가면 판을 한 칸 내린다

// ── 순수 규칙 ────────────────────────────────────────────────────────────────
export function makeLane(index, rng) {
  if (index % 4 === 0) return { type: 'safe', dir: 1, speed: 0, cars: [] };

  const dir = rng.next() < 0.5 ? -1 : 1;
  const speed = 1.4 + rng.next() * 2.6;         // 초당 칸 수
  const count = 2 + rng.int(2);
  const cars = [];
  for (let i = 0; i < count; i++) {
    cars.push({ x: i * (15 / count) + rng.next() * 2, w: 2 + rng.int(2) });
  }
  return { type: 'road', dir, speed, cars };
}

export function createCrossyState({ cols = 15, lanes = 11, rng }) {
  const list = [];
  for (let i = 0; i < lanes; i++) list.push(makeLane(i, rng));
  list[0] = { type: 'safe', dir: 1, speed: 0, cars: [] };
  return {
    cols,
    lanes: list,
    nextIndex: lanes,
    player: { col: Math.floor(cols / 2), lane: 0 },
    crossed: 0,
    dead: false,
  };
}

export function advanceCars(state, dt) {
  for (const lane of state.lanes) {
    if (lane.type !== 'road') continue;
    for (const car of lane.cars) {
      car.x += lane.dir * lane.speed * dt;
      if (car.x > state.cols) car.x = -car.w;
      if (car.x + car.w < 0) car.x = state.cols;
    }
  }
  return state;
}

export function laneHit(lane, col) {
  if (lane.type !== 'road') return false;
  const p = col + 0.5;
  return lane.cars.some((c) => p >= c.x && p <= c.x + c.w);
}

export function movePlayer(state, dcol, dlane, rng) {
  if (state.dead) return { moved: false, scored: false };

  const col = state.player.col + dcol;
  const lane = state.player.lane + dlane;
  if (col < 0 || col >= state.cols) return { moved: false, scored: false };
  if (lane < 0) return { moved: false, scored: false };

  state.player.col = col;
  state.player.lane = lane;

  let scored = false;
  if (dlane > 0) {
    state.crossed += 1;
    scored = true;
  }

  // 위쪽에 다다르면 판을 한 칸 내리고 새 레인을 위에 붙인다.
  while (state.player.lane > SCROLL_AT) {
    state.lanes.shift();
    state.lanes.push(makeLane(state.nextIndex++, rng));
    state.player.lane -= 1;
  }

  return { moved: true, scored };
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
const COLS = 15;
const LANES = 11;
const CELL = 56;                          // 15*56 = 840
const OX = (960 - COLS * CELL) / 2;
const LANE_H = 52;
const BOTTOM = 640 - 24;
const MOVE_COOLDOWN = 0.13;

export default {
  id: 'crossy-robot',
  title: '길 건너기 로봇',
  tags: ['action'],
  players: 1,
  color: '#ffd23f',
  controls: 'dpad',
  scoreOrder: 'high',
  scoreLabel: '거리',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillRect(0, 2 * u, size, u * 1.6);
    ctx.fillRect(0, 5 * u, size, u * 1.6);
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(3.2 * u, 3.1 * u, 1.6 * u, 1.6 * u);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(0.6 * u, 5.2 * u, 2.4 * u, 1.2 * u);
  },

  init(api) {
    this.api = api;
    this.s = createCrossyState({ cols: COLS, lanes: LANES, rng: api.rng });
    this.cool = 0;
    this.over = false;
  },

  update(dt) {
    if (this.over) return;
    const s = this.s;
    advanceCars(s, dt);

    this.cool = Math.max(0, this.cool - dt);
    const p = this.api.input.p1;
    if (this.cool === 0) {
      let dc = 0;
      let dl = 0;
      if (p.y < -0.4) dl = 1;
      else if (p.y > 0.4) dl = -1;
      else if (p.x > 0.4) dc = 1;
      else if (p.x < -0.4) dc = -1;

      if (dc !== 0 || dl !== 0) {
        const r = movePlayer(s, dc, dl, this.api.rng);
        if (r.moved) {
          this.cool = MOVE_COOLDOWN;
          this.api.audio.beep(dl > 0 ? 620 : 420, 40);
          if (r.scored) this.api.onScore(s.crossed);
        }
      }
    }

    if (laneHit(s.lanes[s.player.lane], s.player.col)) {
      s.dead = true;
      this.over = true;
      const x = OX + s.player.col * CELL + CELL / 2;
      const y = BOTTOM - s.player.lane * LANE_H;
      this.api.juice.shake(14, 0.35);
      this.api.juice.burst(x, y, { color: PALETTE.yellow, count: 26, speed: 260 });
      this.api.audio.noise(220);
      this.api.onGameOver({ score: s.crossed });
    }
  },

  render(ctx) {
    const d = this.api.draw;
    const s = this.s;
    d.clear();

    for (let i = 0; i < s.lanes.length; i++) {
      const lane = s.lanes[i];
      const y = BOTTOM - i * LANE_H;
      d.rect(OX, y - LANE_H + 6, COLS * CELL, LANE_H - 8,
        lane.type === 'safe' ? PALETTE.panel : '#0a0f1e');

      if (lane.type === 'road') {
        for (const car of lane.cars) {
          d.roundRect(OX + car.x * CELL, y - LANE_H + 12, car.w * CELL - 8, LANE_H - 20, 8,
            lane.dir > 0 ? PALETTE.magenta : PALETTE.orange, { glow: 8 });
        }
      }
    }

    const px = OX + s.player.col * CELL + CELL / 2;
    const py = BOTTOM - s.player.lane * LANE_H - LANE_H / 2 + 3;
    d.roundRect(px - 17, py - 17, 34, 34, 8, PALETTE.cyan, { glow: 16 });
    d.rect(px - 8, py - 6, 5, 5, PALETTE.bg);
    d.rect(px + 3, py - 6, 5, 5, PALETTE.bg);
  },

  dispose() {
    this.s = null;
    this.api = null;
  },
};
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/games/crossy-robot.test.js`
Expected: `17 passed`

- [ ] **Step 5: 계약 테스트 + 전체 테스트**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm test`
Expected: 전부 통과. 계약 테스트에 `neon-snake`, `crossy-robot` 두 블록이 보인다.

- [ ] **Step 6: 플레이 확인 후 커밋**

`npm run dev`로 메뉴에서 두 게임이 모두 뜨고 조종되는지 확인한다.

```bash
cd /Users/junghakjun/ai_work/game/100game
git add src/games/crossy-robot.js tests/games/crossy-robot.test.js
git commit -m "feat(arcade): 길 건너기 로봇 — 연속시간 장르로 계약 재검증

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 18: forge/ — 양산 에이전트용 계약서와 큐

단계 C에서 서브에이전트에게 **그대로 던져줄** 문서다. 여기까지 만들어야 단계 A·B가 "공장 가동 준비 완료"가 된다.

**Files:**
- Create: `100game/forge/contract.md`, `100game/forge/catalog.json`
- Test: `100game/tests/forge.test.js`

**Interfaces:**
- Consumes: `TAGS`, `CONTROLS`, `SCORE_ORDERS` (Task 9)
- Produces: `forge/catalog.json` = `{ queue: [{ id, title, tags, players, controls, scoreOrder, scoreLabel, rules: string[], win: string, difficulty: string }] }`

- [ ] **Step 1: 계약서 작성**

`100game/forge/contract.md`:
```markdown
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

- `tags`: action | puzzle | defense | sports | quiz | versus 중 하나 이상
- `players`: 1 또는 2. **2면 tags에 versus를 반드시 포함**
- `controls`: pointer | dpad | dpad+a | versus — 셸이 이걸 보고 터치 오버레이를 그린다
- `scoreOrder`: high(클수록 좋음) | low(작을수록 좋음)

## api

```js
api.w, api.h                 // 960, 640
api.input.p1 / p2            // { x, y, a, aHeld, b, bHeld } — x/y는 -1..1, y는 아래가 +
api.input.pointer            // { x, y, down, pressed, released } — 논리 좌표
api.draw                     // clear, rect, roundRect, circle, line, text
api.audio                    // beep(freq, ms, type), sweep(from, to, ms), noise(ms)
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

규칙 단위 테스트를 `tests/games/<id>.test.js`에 함께 작성한다. 최소 5개 — 초기 상태, 정상 진행, 점수 획득, 패배 조건, 경계값.

## 재미 기준 (이걸 못 넘기면 반려)

- 한 판이 30초~3분 안에 끝난다
- 시작 5초 안에 뭘 해야 하는지 조작만으로 알 수 있다 (설명 화면 금지)
- 점수가 오를 때와 죽을 때 소리·파티클·흔들림이 반드시 있다
- 진행할수록 빨라지거나 조밀해진다 (고정 난이도 금지)
```

- [ ] **Step 2: 양산 큐 작성 (첫 6개만 채운다)**

`100game/forge/catalog.json`:
```json
{
  "queue": [
    {
      "id": "sudoku",
      "title": "스도쿠",
      "tags": ["puzzle"],
      "players": 1,
      "controls": "pointer",
      "scoreOrder": "low",
      "scoreLabel": "시간",
      "rules": [
        "4x4 / 6x6 / 9x9 중 하나를 고르고 빈 칸을 채운다",
        "같은 줄·칸·박스에 같은 숫자가 오면 빨갛게 표시한다",
        "힌트 버튼을 3번까지 써서 한 칸을 채울 수 있다"
      ],
      "win": "모든 칸을 규칙에 맞게 채우면 승리. 점수는 걸린 시간(초)",
      "difficulty": "난이도 선택으로 조절. 9x9는 빈 칸 40개"
    },
    {
      "id": "number-baseball",
      "title": "숫자 야구",
      "tags": ["puzzle"],
      "players": 1,
      "controls": "pointer",
      "scoreOrder": "low",
      "scoreLabel": "시도",
      "rules": [
        "서로 다른 3자리 숫자를 맞힌다",
        "자리와 숫자가 맞으면 스트라이크, 숫자만 맞으면 볼",
        "숫자 패드로 입력하고 지난 시도를 목록으로 보여준다"
      ],
      "win": "3스트라이크면 승리. 점수는 시도 횟수. 10번 넘기면 패배",
      "difficulty": "3자리 고정"
    },
    {
      "id": "baseball-battle",
      "title": "야구 배틀왕",
      "tags": ["sports", "versus"],
      "players": 2,
      "controls": "versus",
      "scoreOrder": "high",
      "scoreLabel": "점수",
      "rules": [
        "투수는 구종(직구·커브·체인지업)과 코스를 고르고 던진다",
        "타자는 공이 존에 들어오는 타이밍에 A로 스윙한다",
        "3이닝 공수교대. 1인 플레이면 상대는 AI"
      ],
      "win": "3이닝 후 점수가 높은 쪽 승리. onGameOver에 winner를 넣는다",
      "difficulty": "이닝이 갈수록 구속이 빨라진다"
    },
    {
      "id": "asteroid-dodge",
      "title": "소행성 회피",
      "tags": ["action"],
      "players": 1,
      "controls": "dpad",
      "scoreOrder": "high",
      "scoreLabel": "시간",
      "rules": [
        "아래쪽 우주선을 좌우로 움직인다",
        "위에서 소행성이 떨어진다. 맞으면 끝",
        "가끔 실드 아이템이 떨어져 1회 방어한다"
      ],
      "win": "생존 시간(초)이 점수",
      "difficulty": "20초마다 낙하 속도와 밀도가 오른다"
    },
    {
      "id": "brick-breaker",
      "title": "벽돌깨기",
      "tags": ["defense"],
      "players": 1,
      "controls": "pointer",
      "scoreOrder": "high",
      "scoreLabel": "점수",
      "rules": [
        "포인터를 끌어 패들을 움직인다",
        "공을 튕겨 위쪽 벽돌을 부순다",
        "단단한 벽돌은 두 번 맞아야 깨진다"
      ],
      "win": "벽돌을 다 깨면 다음 판. 공을 3번 놓치면 끝",
      "difficulty": "판이 오를수록 공이 빨라지고 벽돌 줄이 늘어난다"
    },
    {
      "id": "tank-duel",
      "title": "탱크 대전",
      "tags": ["versus"],
      "players": 2,
      "controls": "versus",
      "scoreOrder": "high",
      "scoreLabel": "승수",
      "rules": [
        "좌우 끝에 탱크가 하나씩. 가운데에 지형이 있다",
        "위아래로 포각을 조절하고 A를 길게 눌러 파워를 모아 쏜다",
        "포탄은 중력을 받아 포물선을 그린다"
      ],
      "win": "먼저 3번 맞히면 승리. onGameOver에 winner를 넣는다",
      "difficulty": "매 라운드 지형이 바뀐다"
    }
  ]
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`100game/tests/forge.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TAGS, CONTROLS, SCORE_ORDERS } from '../src/shell/registry.js';

const catalog = JSON.parse(readFileSync(new URL('../forge/catalog.json', import.meta.url)).toString());
const contract = readFileSync(new URL('../forge/contract.md', import.meta.url)).toString();

describe('forge/catalog.json', () => {
  it('큐가 비어 있지 않다', () => {
    expect(catalog.queue.length).toBeGreaterThan(0);
  });

  it('모든 항목이 계약과 맞는 메타를 갖는다', () => {
    for (const e of catalog.queue) {
      expect(e.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(typeof e.title).toBe('string');
      expect(e.tags.every((t) => TAGS.includes(t))).toBe(true);
      expect([1, 2]).toContain(e.players);
      expect(CONTROLS).toContain(e.controls);
      expect(SCORE_ORDERS).toContain(e.scoreOrder);
      expect(e.rules.length).toBeGreaterThanOrEqual(3);
      expect(e.win.length).toBeGreaterThan(0);
      expect(e.difficulty.length).toBeGreaterThan(0);
    }
  });

  it('2인 게임은 versus 태그를 갖는다', () => {
    for (const e of catalog.queue) {
      if (e.players === 2) expect(e.tags).toContain('versus');
    }
  });

  it('id가 중복되지 않는다', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('스펙이 요청한 스도쿠와 야구 배틀왕이 큐에 있다', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(ids).toContain('sudoku');
    expect(ids).toContain('baseball-battle');
  });
});

describe('forge/contract.md', () => {
  it('모범 예시 두 개를 가리킨다', () => {
    expect(contract).toContain('src/games/neon-snake.js');
    expect(contract).toContain('src/games/crossy-robot.js');
  });

  it('계약 테스트 실행 명령을 알려준다', () => {
    expect(contract).toContain('tests/contract.test.js');
  });

  it('Math.random 금지를 명시한다', () => {
    expect(contract).toContain('Math.random');
  });
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npx vitest run tests/forge.test.js`
Expected: `8 passed`

- [ ] **Step 5: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add forge/contract.md forge/catalog.json tests/forge.test.js
git commit -m "docs(arcade): 양산 에이전트용 계약서와 게임 큐

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 19: 최종 검증 + 아이패드 실기기 QA

**Files:**
- Modify: `100game/README.md` (신규 생성)
- 검증만: 전체 테스트, 빌드, 실기기

**Interfaces:**
- Consumes: 전부
- Produces: 단계 A·B 완료 상태. 단계 C(양산) 착수 가능.

- [ ] **Step 1: 전체 테스트**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm test`
Expected: 모든 스위트 통과. 실패가 하나라도 있으면 여기서 멈추고 고친다.

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `cd /Users/junghakjun/ai_work/game/100game && npm run build && du -sh dist && ls dist`
Expected: 빌드 성공. `dist/`에 index.html, assets, sw.js, manifest, 아이콘이 모두 있다. 전체 크기가 200KB 미만이어야 한다(이미지 없는 순수 코드이므로).

- [ ] **Step 3: README 작성**

`100game/README.md`:
```markdown
# YJ 아케이드

유준이를 위한 오프라인 캐주얼 게임 모음집. 바닐라 JS + Canvas 2D, 런타임 의존성 0개.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm test         # 전체 테스트
npm run build    # dist/ 정적 빌드
```

## 게임 추가하기

`src/games/<id>.js` 파일 하나를 만들면 메뉴에 자동으로 뜬다. 등록 코드를 고칠 필요가 없다.
계약은 [forge/contract.md](forge/contract.md)에, 만들 게임 목록은 [forge/catalog.json](forge/catalog.json)에 있다.

새 게임은 다음 두 가지를 통과해야 한다.

```bash
npx vitest run tests/contract.test.js       # 전 게임 공통 계약
npx vitest run tests/games/<id>.test.js     # 게임별 규칙
```

## 구조

- `src/core/` — 루프, 입력, 그리기, 소리, 손맛, 난수, 저장
- `src/shell/` — 메뉴, 세션, 기록, 게임 수집, 뷰포트
- `src/games/` — 게임 (파일 1개 = 게임 1개)
- `forge/` — 양산 파이프라인 문서

설계 문서: `../docs/superpowers/specs/2026-07-27-yj-arcade-design.md`
```

- [ ] **Step 4: 아이패드 실기기 QA (사람이 해야 하는 부분)**

`npm run dev`로 띄운 뒤(`server.host: true`라 같은 와이파이의 아이패드에서 `http://<맥 IP>:5173`으로 접속 가능), 아이패드 사파리에서 확인한다.

- [ ] 세로·가로 모두에서 화면이 잘리지 않고 레터박스로 들어간다
- [ ] 메뉴 타일 탭이 정확히 눌린다 (손가락 크기 대비 타일이 충분히 큼)
- [ ] 게임 안에서 좌하단 가상 D패드가 뜨고 방향이 먹는다
- [ ] 일시정지 → 계속하기 → 다시하기 → 메뉴로가 모두 동작한다
- [ ] 60fps로 느껴진다 (뚝뚝 끊기지 않는다)
- [ ] 공유 → 홈 화면에 추가 → 아이콘이 제대로 보인다
- [ ] 홈 화면 아이콘으로 실행 → 주소창 없는 전체화면으로 뜬다
- [ ] **비행기모드에서 홈 화면 아이콘으로 실행 → 정상 동작한다** (오프라인 검증의 핵심)
- [ ] 최고기록이 앱을 껐다 켜도 남아 있다

문제가 있으면 그 항목을 고친 뒤 다시 확인한다.

- [ ] **Step 5: 유준이 플레이 테스트**

두 게임을 유준이에게 보여주고 관찰한다. 기록할 것:
- 설명 없이 조작을 알아냈는가
- 각 게임을 몇 판 연속으로 했는가
- "이거 재밌다" / "심심해" 중 어느 쪽인가
- 더 하고 싶다고 한 게임은 무엇인가

이 결과가 단계 C에서 어떤 장르를 먼저 양산할지 정한다.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junghakjun/ai_work/game/100game
git add README.md
git commit -m "docs(arcade): README — 실행법과 게임 추가 방법

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 완료 기준

이 플랜이 끝나면 다음이 모두 참이어야 한다.

1. `npm test`가 전부 통과한다 (코어 7개 모듈 + 셸 5개 모듈 + 계약 테스트 + 게임 2개)
2. `npm run build`가 200KB 미만의 무의존성 정적 산출물을 만든다
3. 아이패드 홈 화면 아이콘으로 실행해 **비행기모드에서** 두 게임이 동작한다
4. `src/games/`에 파일 하나를 더 넣으면 메뉴에 자동으로 뜬다
5. `forge/contract.md`만 주면 서브에이전트가 새 게임을 만들 수 있다

여기까지가 **단계 A·B**다. 이후 단계 C(양산 22개)는 `forge/catalog.json`의 큐를 채우고 게임당 서브에이전트 1명을 붙이는 별도 사이클로 진행한다.
