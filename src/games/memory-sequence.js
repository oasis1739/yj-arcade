import { PALETTE } from '../core/draw.js';

// ── 순수 규칙 (테스트 대상) ───────────────────────────────────────────────────
//
// 게임 흐름: 매 라운드 길이 L(순서 길이)의 시퀀스를 도형이 하나씩 빛나며
// 재생한다('showing') → 다 보여주면 입력을 받는다('input') → 끝까지 맞히면
// 축하 연출('roundComplete') 후 다음 라운드(L+1)로, 틀리면 목숨을 하나 잃고
// 같은 시퀀스를 다시 보여준다('wrongPause' → 재생 전 대기 'ready' → 'showing').
// 목숨 3개를 다 잃으면 'gameover'.
//
// 8세 플레이어가 실제로 플레이해보니 "언제 시작하는지, 맞았는지 틀렸는지"를
// 전혀 못 알아챘다(글을 몰라서가 아니라 화면이 상태를 안 알려줘서). 그래서
// 매 라운드의 재생 시작 앞에는 반드시 'ready'(정지 신호) 단계가 들어가고,
// 입력이 열리는 순간('input' 진입), 정답/오답 탭, 목숨이 깎이는 순간, 라운드
// 완료 순간이 전부 색·모양·소리·흔들림으로 즉시, 텍스트 없이도 구별되게
// 만들었다. 이 상태들은 전부 update(dt)가 미는 타이머로만 진행되고 render는
// 그 상태를 읽기만 한다(시계를 직접 읽지 않는다).
//
// 난이도는 오직 L(순서 길이)에 의해서만 결정된다(순수 함수 shapeCountForLength/
// litDurationMs/soundHintEnabled) — 8세 플레이어가 1단계(L=2)에서 반드시
// 성공하도록 시작은 아주 쉽고, L이 오를 때마다 조금씩만 조여든다. 이 난이도
// 곡선은 이번 수정에서 건드리지 않는다 — 문제는 피드백 부재였지 난이도가
// 아니었다.

const GAP_MS = 220;          // 도형이 꺼져 있는 구간(다음 빛 전 여백)
const WRONG_PAUSE_MS = 650;  // 오답 후 다시 보여주기 전 대기 시간
const READY_MS = 700;        // 'ready' 단계: 재생 시작 전 "이제 볼 차례" 정지 신호 길이
const TURN_FLASH_MS = 550;   // 'input' 진입 직후 "이제 네 차례" 강조 애니메이션 길이
const CORRECT_FLASH_MS = 240; // 정답 탭 직후 해당 도형 강조 길이
const LIFE_LOST_MS = 550;    // 오답으로 목숨이 빠질 때 그 하트 강조 길이
const ROUND_COMPLETE_MS = 950; // 라운드 완료 축하 연출 길이(다음 라운드 시작 전)

// 소리 힌트: 2~6개 구간까지는 색+소리를 함께 준다. 7부터는 색만.
export function soundHintEnabled(len) {
  return len <= 6;
}

// 노출 시간: 9부터 줄어든다. 400ms 밑으로는 8세 반응속도로도 못 따라가므로 클램프.
export function litDurationMs(len) {
  if (len < 9) return 900;
  return Math.max(400, 900 - (len - 8) * 60);
}

// 도형 개수: 11부터 화면의 도형 자체를 늘린다(최대 9개, 규칙 문서의 "4~9개").
export function shapeCountForLength(len) {
  if (len < 11) return 4;
  return Math.min(9, 4 + Math.floor((len - 11) / 3) + 1);
}

// 길이 len짜리 시퀀스를 [0, shapeCount) 범위에서 뽑는다. 사이먼류 기억 게임은
// 연속 반복도 정상적인 패턴이라 중복을 막지 않는다.
export function generateSequence(len, shapeCount, rng) {
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(rng.int(shapeCount));
  return seq;
}

// 새 재생을 준비한다: 재생/입력 진행 상태를 초기화하고 'ready'(정지 신호)
// 단계로 들어간다. playStage를 'gap', playIndex를 -1로 "가짜로 막 끝난 gap"
// 상태로 프라이밍해두면, 'ready' 타이머가 끝나 phase가 'showing'으로 바뀐
// 다음 첫 advancePlayback() 호출이 기존 gap→lit 전이 경로를 그대로 타면서
// sequence[0]을 자연스럽게 밝히고 justLit도 정확히 한 번 선다(별도 특수
// 케이스 없이 재생 중 반복 도형과 완전히 같은 경로).
function prepareRound(state) {
  state.playIndex = -1;
  state.playStage = 'gap';
  state.playTimer = 0;
  state.litSlot = -1;
  state.justLit = false;
  state.inputIndex = 0;
  state.wrongSlot = -1;
  state.correctFlashSlot = -1;
  state.correctFlashTimer = 0;
  state.turnFlashTimer = 0;
  state.phase = 'ready';
  state.readyTimer = READY_MS;
}

export function createMemoryState({ rng }) {
  const seqLen = 2;
  const shapeCount = shapeCountForLength(seqLen);
  const sequence = generateSequence(seqLen, shapeCount, rng);
  const state = {
    seqLen,
    shapeCount,
    sequence,
    lives: 3,
    score: 0,
    lifeLostIndex: -1,
    lifeLostTimer: 0,
  };
  prepareRound(state);
  return state;
}

// 'ready'(정지 신호) 단계를 진행한다. 다 되면 phase만 'showing'으로 바꾼다 —
// 첫 도형은 prepareRound가 미리 깔아둔 gap 상태 덕에 다음 advancePlayback()
// 호출이 알아서 밝혀준다.
export function advanceReady(state, dtMs) {
  if (state.phase !== 'ready') return;
  state.readyTimer -= dtMs;
  if (state.readyTimer <= 0) {
    state.phase = 'showing';
  }
}

// 재생 애니메이션(어느 칸이 빛나는지, 얼마나 오래)은 오직 이 함수(그리고 이
// 함수를 부르는 update(dt))로만 진행된다 — render()는 절대 시계를 읽지 않고
// state.litSlot을 그릴 뿐이다.
export function advancePlayback(state, dtMs) {
  if (state.phase !== 'showing') return;
  state.justLit = false;
  state.playTimer -= dtMs;
  while (state.playTimer <= 0 && state.phase === 'showing') {
    if (state.playStage === 'lit') {
      state.playStage = 'gap';
      state.litSlot = -1;
      state.playTimer += GAP_MS;
    } else {
      state.playIndex += 1;
      if (state.playIndex >= state.sequence.length) {
        state.phase = 'input';
        state.litSlot = -1;
        state.playTimer = 0;
        // 재생 끝 → 입력 시작. 이 순간이 "네 차례"다. 잠깐(TURN_FLASH_MS)
        // 화면 전체에 확산 링/문구를 띄워 재생 단계와 확실히 다르게 보이게 한다.
        state.turnFlashTimer = TURN_FLASH_MS;
        break;
      }
      state.playStage = 'lit';
      state.litSlot = state.sequence[state.playIndex];
      state.playTimer += litDurationMs(state.seqLen);
      state.justLit = true;
    }
  }
}

// phase !== 'input'이면(재생 중이면) 탭을 완전히 무시한다.
export function submitTap(state, slotIndex) {
  if (state.phase !== 'input') return { ignored: true };

  const expected = state.sequence[state.inputIndex];
  if (slotIndex !== expected) {
    state.lives -= 1;
    state.wrongSlot = slotIndex;
    // 방금 빈 목숨 자리(0-index) — HUD가 "숫자만 바뀜"이 아니라 그 자리
    // 하나가 팍 꺼지는 걸 잠깐 강조해서 보여준다.
    state.lifeLostIndex = state.lives;
    state.lifeLostTimer = LIFE_LOST_MS;
    if (state.lives <= 0) {
      state.phase = 'gameover';
      return { ignored: false, correct: false, gameOver: true };
    }
    state.phase = 'wrongPause';
    state.wrongTimer = WRONG_PAUSE_MS;
    return { ignored: false, correct: false, gameOver: false };
  }

  state.correctFlashSlot = slotIndex;
  state.correctFlashTimer = CORRECT_FLASH_MS;
  state.inputIndex += 1;
  if (state.inputIndex >= state.sequence.length) {
    state.score = Math.max(state.score, state.seqLen);
    // 라운드 완료 — 곧바로 다음 라운드로 넘기지 않고 축하 연출 단계를 거친다.
    state.phase = 'roundComplete';
    state.roundCompleteTimer = ROUND_COMPLETE_MS;
    return { ignored: false, correct: true, roundComplete: true };
  }
  return { ignored: false, correct: true, roundComplete: false };
}

// 성공 후 다음 라운드로: 순서가 1개 길어지고 새 시퀀스를 뽑는다(rng 소비).
// 곧장 재생을 시작하지 않고 'ready' 단계부터 다시 거친다(prepareRound).
export function advanceToNextRound(state, rng) {
  state.seqLen += 1;
  state.shapeCount = shapeCountForLength(state.seqLen);
  state.sequence = generateSequence(state.seqLen, state.shapeCount, rng);
  prepareRound(state);
}

// 오답 후 재시도: 같은 시퀀스를 유지한 채 재생/입력 진행 상태만 초기화하고
// 'ready' 단계로 되돌아간다.
export function retryRound(state) {
  prepareRound(state);
}

export function advanceWrongPause(state, dtMs) {
  if (state.phase !== 'wrongPause') return;
  state.wrongTimer -= dtMs;
  if (state.wrongTimer <= 0) retryRound(state);
}

// 라운드 완료 축하 연출 타이머만 진행한다. rng가 필요한 다음 라운드 준비는
// (advanceToNextRound) 호출부(default.update)가 이 함수가 true를 반환한
// 프레임에 직접 부른다 — 순수 규칙 함수는 rng 없이도 시간만으로 테스트할
// 수 있어야 하기 때문이다.
export function advanceRoundComplete(state, dtMs) {
  if (state.phase !== 'roundComplete') return false;
  state.roundCompleteTimer -= dtMs;
  return state.roundCompleteTimer <= 0;
}

// 정답/오답과 무관하게 시간이 지나면 저절로 옅어지는 강조 타이머들
// (정답 도형 링, 방금 빠진 목숨 자리, "네 차례" 확산 링). 어느 phase에
// 있든 매 프레임 그냥 줄어들면 되므로 phase 분기 밖에서 항상 부른다.
function advanceFeedbackTimers(state, dtMs) {
  if (state.correctFlashTimer > 0) {
    state.correctFlashTimer = Math.max(0, state.correctFlashTimer - dtMs);
    if (state.correctFlashTimer === 0) state.correctFlashSlot = -1;
  }
  if (state.lifeLostTimer > 0) {
    state.lifeLostTimer = Math.max(0, state.lifeLostTimer - dtMs);
    if (state.lifeLostTimer === 0) state.lifeLostIndex = -1;
  }
  if (state.turnFlashTimer > 0) {
    state.turnFlashTimer = Math.max(0, state.turnFlashTimer - dtMs);
  }
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────

// 도형 9종(모양+색 조합). shapeCount만큼 앞에서부터 잘라 쓴다. 처음 4개
// (원/네모/세모/마름모)는 특히 서로 확실히 구별되도록 골랐다 — 1단계가
// 8세 플레이어에게 명확해야 하기 때문.
const SHAPE_DEFS = [
  { kind: 'circle', color: PALETTE.cyan },
  { kind: 'square', color: PALETTE.magenta },
  { kind: 'triangle', color: PALETTE.yellow },
  { kind: 'diamond', color: PALETTE.green },
  { kind: 'hex', color: PALETTE.orange },
  { kind: 'star', color: PALETTE.red },
  { kind: 'cross', color: PALETTE.white },
  { kind: 'triangleDown', color: PALETTE.cyan },
  { kind: 'ring', color: PALETTE.magenta },
];

// 도형 개수별 배치(전부 화면 예약 구역 밖: 점수 HUD/일시정지 버튼과 안 겹침).
const LAYOUTS = {
  4: [[310, 267], [650, 267], [310, 462], [650, 462]],
  5: [[253, 270], [480, 270], [707, 270], [310, 460], [650, 460]],
  6: [[253, 270], [480, 270], [707, 270], [253, 460], [480, 460], [707, 460]],
  7: [[253, 220], [480, 220], [707, 220], [253, 375], [480, 375], [707, 375], [480, 530]],
  8: [[253, 220], [480, 220], [707, 220], [253, 375], [480, 375], [707, 375], [310, 530], [650, 530]],
  9: [[253, 220], [480, 220], [707, 220], [253, 375], [480, 375], [707, 375], [253, 530], [480, 530], [707, 530]],
};

// 목숨 3개(HUD) x좌표. update()의 "목숨 잃은 자리 강조"와 render()의 실제
// 그리기가 같은 좌표를 써야 하므로 모듈 스코프로 뺐다.
const LIFE_XS = [430, 480, 530];
const LIFE_Y = 96;

// 재생 중이 아닐 때 화면 정중앙 쪽(어느 shapeCount 배치에서도 도형과 안
// 겹치는 자리)에 상태 연출(준비 링/네 차례 링/축하 링)을 띄우는 기준점.
const STAGE_CX = 480;
const STAGE_CY = 375;

function iconRadius(n) {
  return n <= 6 ? 58 : 48;
}

function slotCenter(state, i) {
  return LAYOUTS[state.shapeCount][i];
}

function hitTestSlot(state, x, y) {
  const layout = LAYOUTS[state.shapeCount];
  const r = iconRadius(state.shapeCount) + 22;
  for (let i = 0; i < state.shapeCount; i++) {
    const [cx, cy] = layout[i];
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return i;
  }
  return -1;
}

// 재생 중 빛나는 순서에 맞춰 나는 톤. 도(C5)부터 도(C6)까지 9음.
const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, 1174.66];

function polygonPoints(kind, cx, cy, r) {
  switch (kind) {
    case 'triangle':
      return [[cx, cy - r], [cx + r * 0.87, cy + r * 0.6], [cx - r * 0.87, cy + r * 0.6]];
    case 'triangleDown':
      return [[cx, cy + r], [cx + r * 0.87, cy - r * 0.6], [cx - r * 0.87, cy - r * 0.6]];
    case 'diamond':
      return [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
    case 'hex': {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return pts;
    }
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
      }
      return pts;
    }
    case 'cross': {
      const t = r * 0.38;
      return [
        [cx - t, cy - r], [cx + t, cy - r], [cx + t, cy - t],
        [cx + r, cy - t], [cx + r, cy + t], [cx + t, cy + t],
        [cx + t, cy + r], [cx - t, cy + r], [cx - t, cy + t],
        [cx - r, cy + t], [cx - r, cy - t], [cx - t, cy - t],
      ];
    }
    default:
      return null;
  }
}

// 도형 하나를 그린다. api.draw는 원/네모만 지원하므로 다각형(세모/마름모/
// 육각형/별/십자)은 render(ctx)로 직접 받는 raw ctx에 경로를 그린다.
function drawShape(ctx, kind, cx, cy, r, color, opts = {}) {
  const { filled = true, glow = 0, alpha = 1, lineWidth = 4 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.shadowBlur = glow;
  ctx.shadowColor = glow ? color : 'transparent';

  if (kind === 'circle' || kind === 'ring') {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (kind === 'ring' || !filled) ctx.stroke(); else ctx.fill();
    ctx.restore();
    return;
  }
  if (kind === 'square') {
    if (filled) ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    else ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }

  const pts = polygonPoints(kind, cx, cy, r);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

// phase별 상시 테두리 색 — 텍스트를 안 읽어도 "지금 뭘 해야 하는지"가 화면
// 가장자리 색만으로 매 프레임 구별되게 한다(재생 중=청록, 내 차례=초록,
// 오답 대기=빨강, 라운드 완료=노랑, 준비=중립, 게임 종료=빨강+어두운 막).
const BORDER_BY_PHASE = {
  ready: PALETTE.dim,
  showing: PALETTE.cyan,
  input: PALETTE.green,
  wrongPause: PALETTE.red,
  roundComplete: PALETTE.yellow,
  gameover: PALETTE.red,
};

export default {
  id: 'memory-sequence',
  title: '그림 기억',
  tags: ['puzzle'],
  players: 1,
  color: PALETTE.magenta,
  controls: 'pointer',
  scoreOrder: 'high',
  scoreLabel: '단계',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(u, u, size - 2 * u, size - 2 * u);
    const spots = [
      { x: 2.6, y: 2.6, color: PALETTE.cyan, lit: false },
      { x: 5.4, y: 2.6, color: PALETTE.magenta, lit: true },
      { x: 2.6, y: 5.4, color: PALETTE.yellow, lit: false },
      { x: 5.4, y: 5.4, color: PALETTE.green, lit: false },
    ];
    for (const s of spots) {
      ctx.save();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.lit ? 1 : 0.45;
      if (s.lit) {
        ctx.shadowBlur = u * 1.4;
        ctx.shadowColor = s.color;
      }
      ctx.beginPath();
      ctx.arc(s.x * u, s.y * u, u * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  init(api) {
    this.api = api;
    this.state = createMemoryState({ rng: api.rng });
    this.lastReportedScore = 0;
    this.gameOverReported = false;
    // 게임이 켜지자마자 "이제 곧 보여줄게, 멈춰서 봐" 신호를 준다 — 첫
    // 라운드도 다른 라운드와 똑같이 'ready' 단계를 거친다(예외 없음).
    this.playReadyCue();
  },

  // 'ready' 단계 진입 시(게임 시작·오답 재시도·다음 라운드 준비) 공통으로 쓰는
  // "곧 재생 시작" 신호 — 재생 중 도형 톤·정답/오답 소리와 확실히 다른,
  // 낮고 차분한 사인파 톤 + 화면 중앙의 은은한 파티클.
  playReadyCue() {
    this.api.audio.beep(240, 170, 'sine');
    this.api.juice.burst(STAGE_CX, STAGE_CY, { color: PALETTE.dim, count: 6, speed: 40, life: 0.3 });
  },

  reportGameOverIfNeeded() {
    if (this.state.phase === 'gameover' && !this.gameOverReported) {
      this.gameOverReported = true;
      this.api.audio.sweep(500, 140, 480);
      this.api.audio.noise(240);
      this.api.juice.shake(10, 0.3);
      this.api.onGameOver({ score: this.state.score });
    }
  },

  update(dt) {
    const api = this.api;
    const s = this.state;
    const dtMs = dt * 1000;

    if (s.phase === 'gameover') {
      this.reportGameOverIfNeeded();
      return;
    }

    advanceFeedbackTimers(s, dtMs);

    if (s.phase === 'ready') {
      advanceReady(s, dtMs);
      return;
    }

    if (s.phase === 'showing') {
      advancePlayback(s, dtMs);
      if (s.justLit) {
        if (soundHintEnabled(s.seqLen)) api.audio.beep(NOTES[s.litSlot], 130);
        const [cx, cy] = slotCenter(s, s.litSlot);
        api.juice.burst(cx, cy, { color: SHAPE_DEFS[s.litSlot].color, count: 10, speed: 90 });
      }
      if (s.phase === 'input') {
        // 재생이 방금 끝나고 입력이 열렸다 — 재생 단계와 확실히 다른
        // 상승 스윕 + 화면 흔들림 + 확산 파티클로 "이제 네 차례"를 알린다.
        api.audio.sweep(420, 880, 150);
        api.juice.shake(3, 0.12);
        api.juice.burst(STAGE_CX, STAGE_CY, { color: PALETTE.white, count: 16, speed: 130 });
      }
      return;
    }

    if (s.phase === 'input') {
      const ptr = api.input.pointer;
      if (ptr.pressed) {
        const slot = hitTestSlot(s, ptr.x, ptr.y);
        if (slot !== -1) {
          const [cx, cy] = slotCenter(s, slot);
          const result = submitTap(s, slot);
          if (result.correct) {
            api.audio.beep(760, 70, 'sine');
            api.juice.burst(cx, cy, { color: PALETTE.white, count: 8, speed: 90 });
            if (result.roundComplete) {
              api.audio.sweep(500, 1050, 300);
              api.juice.shake(5, 0.18);
              api.juice.burst(STAGE_CX, STAGE_CY, { color: PALETTE.yellow, count: 26, speed: 170 });
              if (s.score !== this.lastReportedScore) {
                this.lastReportedScore = s.score;
                api.onScore(s.score);
              }
            }
          } else {
            // 오답: 도형 자체(버저 소리+빨강)뿐 아니라 목숨이 빠지는 자리도
            // 따로 강조한다 — "숫자만 줄어듦"이 아니라 그 하트가 팍 꺼지는
            // 걸 보여준다.
            api.audio.noise(160);
            api.audio.beep(140, 160, 'sawtooth');
            api.juice.shake(9, 0.22);
            api.juice.burst(cx, cy, { color: PALETTE.red, count: 14, speed: 140 });
            const lostX = LIFE_XS[s.lives] ?? LIFE_XS[LIFE_XS.length - 1];
            api.juice.burst(lostX, LIFE_Y, { color: PALETTE.red, count: 12, speed: 90 });
          }
        }
      }
      this.reportGameOverIfNeeded();
      return;
    }

    if (s.phase === 'wrongPause') {
      advanceWrongPause(s, dtMs);
      if (s.phase === 'ready') this.playReadyCue(); // 재시도 재생 직전 신호
      return;
    }

    if (s.phase === 'roundComplete') {
      const done = advanceRoundComplete(s, dtMs);
      if (done) {
        advanceToNextRound(s, api.rng);
        this.playReadyCue(); // 다음(더 긴) 라운드 재생 직전 신호
      }
      return;
    }
  },

  render(ctx) {
    const d = this.api.draw;
    const s = this.state;
    d.clear();

    // 상시 상태 테두리 — phase가 바뀌면 화면 가장자리 색이 즉시 바뀐다.
    // 'input' 진입 직후(turnFlashTimer)와 'wrongPause'/'roundComplete'는
    // 더 진하게 펄스해서 "지금 막 뭔가 바뀌었다"까지 같이 전달한다.
    const borderColor = BORDER_BY_PHASE[s.phase] || PALETTE.dim;
    let borderAlpha = 0.22;
    if (s.phase === 'input') borderAlpha = 0.32 + 0.45 * (s.turnFlashTimer / TURN_FLASH_MS);
    else if (s.phase === 'wrongPause') borderAlpha = 0.55;
    else if (s.phase === 'roundComplete') borderAlpha = 0.55;
    else if (s.phase === 'gameover') borderAlpha = 0.4;
    d.rect(4, 4, 952, 632, borderColor, { fill: false, width: 8, alpha: borderAlpha });

    // 목숨 3개 — 점수 HUD((0,8)~(280,56))와 일시정지 버튼((892,16)~(944,68))
    // 둘 다와 겹치지 않는 y=96 자리에 그린다. 방금 잃은 자리는 잠깐 더 큰
    // 빨간 링으로 팝 애니메이션을 준다.
    for (let i = 0; i < 3; i++) {
      const filled = i < s.lives;
      const isLost = i === s.lifeLostIndex && s.lifeLostTimer > 0;
      if (isLost) {
        const fade = s.lifeLostTimer / LIFE_LOST_MS;
        d.circle(LIFE_XS[i], LIFE_Y, 10 + (1 - fade) * 16, PALETTE.red, { fill: false, width: 3, alpha: fade });
      }
      d.circle(LIFE_XS[i], LIFE_Y, 10, filled ? PALETTE.red : PALETTE.dim, { fill: filled, width: 2 });
    }

    const layout = LAYOUTS[s.shapeCount];
    const r = iconRadius(s.shapeCount);
    const isReady = s.phase === 'ready';
    for (let i = 0; i < s.shapeCount; i++) {
      const [cx, cy] = layout[i];
      const def = SHAPE_DEFS[i];
      const isLit = s.litSlot === i;
      const isWrong = s.phase === 'wrongPause' && s.wrongSlot === i;
      const isCorrectFlash = s.correctFlashSlot === i && s.correctFlashTimer > 0;
      const color = isWrong ? PALETTE.red : (isCorrectFlash ? PALETTE.white : def.color);
      drawShape(ctx, def.kind, cx, cy, r, color, {
        filled: true,
        // 'ready' 단계엔 도형을 실루엣만 남겨("아직 시작 안 함, 곧 보여줄게")
        // 재생/입력 단계와 확실히 구별되게 한다.
        alpha: isReady ? 0.16 : (isLit || isWrong || isCorrectFlash ? 1 : 0.4),
        glow: isLit ? 26 : (isWrong ? 18 : (isCorrectFlash ? 22 : 0)),
        lineWidth: 5,
      });
      if (isCorrectFlash) {
        const grow = 1 - s.correctFlashTimer / CORRECT_FLASH_MS;
        drawShape(ctx, def.kind, cx, cy, r + 8 + grow * 14, PALETTE.green, {
          filled: false, alpha: 1 - grow, lineWidth: 4,
        });
      }
      if (s.phase === 'input') {
        drawShape(ctx, def.kind, cx, cy, r + 9, PALETTE.white, { filled: false, alpha: 0.5, lineWidth: 3 });
      }
    }

    // "곧 시작해, 멈춰서 봐" — 중앙에서 줄어드는 흰 원으로 카운트다운을 보여준다.
    if (isReady) {
      const progress = 1 - s.readyTimer / READY_MS; // 0→1
      const radius = Math.max(10, 130 - progress * 90);
      d.circle(STAGE_CX, STAGE_CY, radius, PALETTE.white, { fill: false, width: 6, alpha: 0.85 - progress * 0.5 });
      d.text('준비...', STAGE_CX, STAGE_CY, { size: 30, color: PALETTE.white, alpha: 0.9 });
    }

    // "네 차례!" — input 진입 직후 잠깐 확산하는 링 + 문구.
    if (s.phase === 'input' && s.turnFlashTimer > 0) {
      const grow = 1 - s.turnFlashTimer / TURN_FLASH_MS;
      d.circle(STAGE_CX, STAGE_CY, 60 + grow * 220, PALETTE.green, { fill: false, width: 5, alpha: 1 - grow });
      d.text('네 차례!', STAGE_CX, 168, { size: 34, color: PALETTE.green, bold: true, alpha: 1 - grow * 0.6 });
    }

    // 오답 — 도형/테두리/목숨 강조 외에 문구도 짧게 더한다(텍스트는 보조일 뿐).
    if (s.phase === 'wrongPause') {
      d.text('틀렸어요!', STAGE_CX, 168, { size: 34, color: PALETTE.red, bold: true });
    }

    // 라운드 완료 축하 — 확산하는 노란 링 + 문구.
    if (s.phase === 'roundComplete') {
      const grow = 1 - s.roundCompleteTimer / ROUND_COMPLETE_MS;
      d.circle(STAGE_CX, STAGE_CY, 40 + grow * 260, PALETTE.yellow, { fill: false, width: 6, alpha: 1 - grow });
      d.text('성공!', STAGE_CX, 168, { size: 40, color: PALETTE.yellow, bold: true });
    }

    if (s.phase === 'gameover') {
      d.rect(0, 70, 960, 640 - 70, PALETTE.bg, { alpha: 0.72 });
      d.text('게임 종료', 480, 300, { size: 44, color: PALETTE.red, bold: true });
      d.text(`최고 단계 ${s.score}`, 480, 350, { size: 26, color: PALETTE.white });
    }
  },

  dispose() {
    this.state = null;
    this.api = null;
  },
};
