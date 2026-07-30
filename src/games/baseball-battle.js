import { PALETTE } from '../core/draw.js';

// ── 순수 규칙 ────────────────────────────────────────────────────────────────
// 야구 배틀왕: 투수는 스틱(dpad)으로 구종·코스를 조준해 A로 던진다.
// 타자는 공이 날아오는 동안 정확한 타이밍에 A를 눌러 스윙한다.
// 3이닝(공수 각 3아웃) 동안 더 많이 득점한 쪽이 승리. 동점이면 연장.

export const INNINGS = 3;
export const EXTRA_INNINGS_CAP = 2;   // 연장 최대 2이닝 — 그래도 동점이면 강제 타이브레이크
export const OUTS_PER_HALF = 3;
export const MAX_PITCHES_PER_HALF = 6; // 안타가 계속 나와도 이 투구수를 넘기면 half를 강제 종료(진행 보장)
export const RESULT_PAUSE = 0.3;       // 결과 배너를 보여주는 시간(초)

export const PITCH_TYPES = ['fastball', 'curve', 'changeup'];
export const COURSES = ['inside', 'middle', 'outside'];

const BASE_FLIGHT = { fastball: 0.56, curve: 0.7, changeup: 0.86 };
const RAMP_PER_INNING = 0.09;   // 이닝마다 이만큼씩 비행시간이 줄어든다(=빨라진다)
const MIN_FLIGHT = 0.32;        // 사람이 반응 가능한 하한선

const HIT_WINDOW_BASE = 0.11;
const COURSE_FACTOR = { inside: 0.75, middle: 1, outside: 0.75 };
const TYPE_FACTOR = { fastball: 0.8, curve: 0.9, changeup: 1.15 };

const RUNS_FOR = { homerun: 4, triple: 3, double: 2, single: 1, out: 0 };

export function createBaseballState() {
  return {
    inning: 1,
    half: 'top',           // 'top' → 1P가 던지고 2P가 친다 / 'bottom' → 반대
    pitcher: 1,
    batter: 2,
    outs: 0,
    pitchCount: 0,
    score: { 1: 0, 2: 0 },
    hits: { 1: 0, 2: 0 },
    phase: 'pitchSelect',  // 'pitchSelect' | 'inFlight' | 'result'
    pitch: null,
    lastResult: null,
    resultTimer: 0,
    over: false,
    winner: null,
  };
}

// 투수가 스틱을 기울인 방향으로 구종·코스를 동시에 조준한다.
// x축(좌우) = 코스, y축(상하) = 구종. 중립(0,0)은 커브·미들.
export function pickPitch(x, y) {
  const col = x < -0.3 ? 0 : x > 0.3 ? 2 : 1;
  const row = y < -0.3 ? 0 : y > 0.3 ? 2 : 1;
  return { type: PITCH_TYPES[row], course: COURSES[col] };
}

// 이닝이 갈수록 같은 구종이라도 더 빨리(짧게) 날아온다. 하한선 밑으로는 안 내려간다.
export function flightDuration(type, inning) {
  const n = Math.max(1, inning);
  const base = BASE_FLIGHT[type] ?? BASE_FLIGHT.fastball;
  return Math.max(MIN_FLIGHT, base * (1 - RAMP_PER_INNING * (n - 1)));
}

// 구석 코스일수록, 그리고 변화가 큰 구종일수록 정확히 맞춰야 하는 타이밍존이 좁다.
export function hitWindow(type, course) {
  const cf = COURSE_FACTOR[course] ?? 1;
  const tf = TYPE_FACTOR[type] ?? 1;
  return HIT_WINDOW_BASE * cf * tf;
}

// diff: 실제 스윙 시각 - 공이 존을 지나는 시각(초). 0에 가까울수록 좋다.
export function classifySwing(diff, window) {
  const a = Math.abs(diff);
  if (a > window) return 'out';
  if (a <= window * 0.2) return 'homerun';
  if (a <= window * 0.5) return 'triple';
  if (a <= window * 0.8) return 'double';
  return 'single';
}

export function runsFor(outcome) {
  return RUNS_FOR[outcome] ?? 0;
}

export function startPitch(state, selection) {
  const type = selection.type;
  const course = selection.course;
  state.pitch = {
    type,
    course,
    duration: flightDuration(type, state.inning),
    window: hitWindow(type, course),
    elapsed: 0,
  };
  state.phase = 'inFlight';
  state.pitchCount += 1;
  return state;
}

// dt만큼 공을 진행시킨다. 비행시간을 그레이스(0.05s)만큼 넘기도록 안 휘두르면
// 콜드 스트라이크(자동 아웃)로 처리한다 — 타자가 아예 안 휘둘러도 게임이 멈추지 않는다.
export function advanceFlight(state, dt) {
  if (state.phase !== 'inFlight' || !state.pitch) return { timedOut: false };
  state.pitch.elapsed += dt;
  if (state.pitch.elapsed >= state.pitch.duration + 0.05) {
    const info = resolvePitchOutcome(state, 'out');
    return { timedOut: true, ...info };
  }
  return { timedOut: false };
}

// 지금 이 순간 스윙한다. 타이밍 diff를 계산해 결과를 확정한다.
export function swingAt(state) {
  if (state.phase !== 'inFlight' || !state.pitch) return null;
  const diff = state.pitch.elapsed - state.pitch.duration;
  const outcome = classifySwing(diff, state.pitch.window);
  return resolvePitchOutcome(state, outcome, diff);
}

export function resolvePitchOutcome(state, outcome, diff = null) {
  const runs = runsFor(outcome);
  const batter = state.batter;
  if (runs > 0) {
    state.score[batter] += runs;
    state.hits[batter] += 1;
  } else {
    state.outs += 1;
  }
  state.lastResult = { outcome, runs, batter, diff };
  state.pitch = null;
  state.phase = 'result';
  state.resultTimer = 0;

  let endedHalf = false;
  if (state.outs >= OUTS_PER_HALF || state.pitchCount >= MAX_PITCHES_PER_HALF) {
    endedHalf = true;
    endHalfInning(state);
  }
  return { outcome, runs, endedHalf, over: state.over };
}

export function endHalfInning(state) {
  state.outs = 0;
  state.pitchCount = 0;
  const prevPitcher = state.pitcher;
  state.pitcher = state.batter;
  state.batter = prevPitcher;

  if (state.half === 'top') {
    state.half = 'bottom';
  } else {
    state.half = 'top';
    state.inning += 1;
    if (state.inning > INNINGS) finalizeOrExtend(state);
  }
  return state;
}

function finalizeOrExtend(state) {
  const s1 = state.score[1];
  const s2 = state.score[2];
  if (s1 !== s2) {
    state.over = true;
    state.winner = s1 > s2 ? 1 : 2;
    return;
  }
  const extraPlayed = state.inning - INNINGS - 1; // 이미 완료한 연장 이닝 수
  if (extraPlayed >= EXTRA_INNINGS_CAP) {
    state.over = true;
    state.winner = decideWinner(s1, s2, state.hits[1], state.hits[2]);
  }
  // 아니면 그대로 진행(연장 이닝 계속) — half는 이미 'top'으로 돌아가 있다.
}

// 점수 → 안타 수 → 그래도 같으면 1P(문서화된 하우스 룰). 항상 승자를 정한다.
export function decideWinner(score1, score2, hits1 = 0, hits2 = 0) {
  if (score1 !== score2) return score1 > score2 ? 1 : 2;
  if (hits1 !== hits2) return hits1 > hits2 ? 1 : 2;
  return 1;
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
const FIELD_X = 480;
const PITCHER_POS = { x: 220, y: 260 };
const BATTER_POS = { x: 740, y: 300 };
const ZONE = { x: 686, y: 236, w: 96, h: 96 }; // 3x3 코스·구종 그리드(타자 옆)
const GAUGE = { x: 280, y: 424, w: 400, h: 18 };

const PITCHER_TIMEOUT = 2.0;   // 사람이 너무 오래 고민하면 지금 조준으로라도 던진다
const AI_THINK_DELAY = 0.35;   // AI 투수의 "생각하는 시간"

const SIDE_COLOR = { 1: PALETTE.cyan, 2: PALETTE.magenta };
const TYPE_FREQ = { fastball: 520, curve: 400, changeup: 300 };
const OUTCOME_LABEL = {
  homerun: '홈런!', triple: '3루타!', double: '2루타!', single: '안타!', out: '아웃',
};

function otherSide(side) { return side === 1 ? 2 : 1; }

// 지금 이 자리(투수/타자 side)가 AI인지 — 오직 api.solo로만 정한다. 1P는
// 항상 로컬/사람이고, AI가 필요하면 항상 2P 자리다. "그동안 이 패드를
// 만졌는지" 같은 휴리스틱은 더 이상 쓰지 않는다 — 셸이 명시적으로 선언한
// 값이라 첫 프레임부터 옳다(계약서 "api.solo" 절 참고).
export function isAiSide(solo, side) {
  return solo === true && side === 2;
}

export default {
  id: 'baseball-battle',
  title: '야구 배틀왕',
  tags: ['sports', 'versus'],
  players: 2,
  color: PALETTE.orange,
  controls: 'versus',
  scoreOrder: 'high',
  scoreLabel: '점수',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = PALETTE.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4 * u, 4 * u, 2.6 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.orange;
    ctx.beginPath();
    ctx.moveTo(2.2 * u, 3.4 * u);
    ctx.quadraticCurveTo(4 * u, 4.4 * u, 5.8 * u, 3.4 * u);
    ctx.stroke();
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(5.6 * u, 5.4 * u, 1.6 * u, 0.5 * u);
  },

  init(api) {
    this.api = api;
    this.s = createBaseballState();
    this.pitcherWait = 0;
    this.aiThink = 0;
    this.aiSwingAt = null;
    this.reported = false;
  },

  update(dt) {
    if (this.reported) return;
    const s = this.s;
    const api = this.api;

    if (s.phase === 'pitchSelect') {
      this.pitcherWait += dt;
      const side = s.pitcher;
      const pad = side === 1 ? api.input.p1 : api.input.p2;
      const ai = isAiSide(api.solo, side);

      let selection = null;
      if (ai) {
        this.aiThink += dt;
        if (this.aiThink >= AI_THINK_DELAY) selection = this._aiPickPitch();
      } else if (pad.a) {
        selection = pickPitch(pad.x, pad.y);
      } else if (this.pitcherWait >= PITCHER_TIMEOUT) {
        selection = pickPitch(pad.x, pad.y);
      }

      if (selection) {
        startPitch(s, selection);
        this.pitcherWait = 0;
        this.aiThink = 0;
        this.aiSwingAt = null;
        api.audio.beep(TYPE_FREQ[selection.type], 55, 'triangle');
      }
      return;
    }

    if (s.phase === 'inFlight') {
      advanceFlight(s, dt);

      if (s.phase === 'inFlight') {
        const side = s.batter;
        const pad = side === 1 ? api.input.p1 : api.input.p2;
        const ai = isAiSide(api.solo, side);

        if (ai) {
          if (this.aiSwingAt === null) {
            const jitter = (api.rng.next() - 0.5) * s.pitch.window * 1.4;
            this.aiSwingAt = s.pitch.duration + jitter;
          }
          if (s.pitch && s.pitch.elapsed >= this.aiSwingAt) swingAt(s);
        } else if (pad.a) {
          swingAt(s);
        }
      }

      if (s.phase === 'result') this._applyResultEffects();
      return;
    }

    if (s.phase === 'result') {
      s.resultTimer += dt;
      if (s.over) {
        if (!this.reported) {
          this.reported = true;
          // score는 항상 1P의 점수만 보고한다(계약서 "onScore가 2인 게임에서
          // 뜻하는 것" 참고) — onScore로 마지막에 보낸 값과 일치시킨다.
          api.onGameOver({ score: s.score[1], winner: s.winner });
          api.juice.shake(20, 0.5);
          api.audio.sweep(320, 900, 420);
        }
        return;
      }
      if (s.resultTimer >= RESULT_PAUSE) {
        s.phase = 'pitchSelect';
        s.resultTimer = 0;
      }
    }
  },

  _aiPickPitch() {
    const type = this.api.rng.pick(PITCH_TYPES);
    const course = this.api.rng.pick(COURSES);
    return { type, course };
  },

  _applyResultEffects() {
    const api = this.api;
    const s = this.s;
    const r = s.lastResult;
    if (!r) return;
    if (r.runs > 0) {
      // 1P의 점수만 보고한다 — 합산은 "누가 잘했는지"를 지워버린다
      // (계약서 "onScore가 2인 게임에서 뜻하는 것" 참고).
      api.onScore(s.score[1]);
      if (r.outcome === 'homerun') {
        api.juice.shake(16, 0.4);
        api.juice.burst(BATTER_POS.x, BATTER_POS.y, { color: PALETTE.yellow, count: 30, speed: 300 });
        api.audio.sweep(500, 1200, 260);
      } else {
        api.juice.burst(BATTER_POS.x, BATTER_POS.y, { color: SIDE_COLOR[r.batter], count: 14, speed: 180 });
        api.audio.beep(760, 90, 'sawtooth');
      }
    } else {
      api.juice.shake(6, 0.15);
      api.audio.noise(120);
    }
  },

  render(ctx) {
    const d = this.api.draw;
    const s = this.s;
    d.clear();

    // 필드
    d.rect(0, 100, 960, 400, PALETTE.panel);
    d.circle(PITCHER_POS.x, PITCHER_POS.y, 30, PALETTE.dim, { alpha: 0.6 });
    d.rect(BATTER_POS.x - 26, BATTER_POS.y + 46, 52, 14, PALETTE.dim, { alpha: 0.6 });

    // 점수판
    d.text(`1P ${s.score[1]}  :  ${s.score[2]} 2P`, FIELD_X, 34, { size: 26, bold: true, color: PALETTE.white, glow: 6 });
    const half = s.half === 'top' ? '초' : '말';
    d.text(`${s.inning}이닝 ${half}`, FIELD_X, 64, { size: 18, color: PALETTE.dim });

    // 아웃 표시
    for (let i = 0; i < OUTS_PER_HALF; i++) {
      d.circle(560 + i * 20, 64, 6, i < s.outs ? PALETTE.red : PALETTE.dim, { alpha: i < s.outs ? 1 : 0.4 });
    }

    // 투수/타자
    d.circle(PITCHER_POS.x, PITCHER_POS.y, 20, SIDE_COLOR[s.pitcher], { glow: 10 });
    d.text(isAiSide(this.api.solo, s.pitcher) ? 'AI 투수' : `${s.pitcher}P 투수`, PITCHER_POS.x, PITCHER_POS.y - 34,
      { size: 15, color: SIDE_COLOR[s.pitcher] });

    d.circle(BATTER_POS.x, BATTER_POS.y, 20, SIDE_COLOR[s.batter], { glow: 10 });
    d.text(isAiSide(this.api.solo, s.batter) ? 'AI 타자' : `${s.batter}P 타자`, BATTER_POS.x, BATTER_POS.y - 34,
      { size: 15, color: SIDE_COLOR[s.batter] });

    // 조준 존(3x3): 코스(가로) x 구종(세로)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cw = ZONE.w / 3;
        const ch = ZONE.h / 3;
        const cx = ZONE.x + c * cw;
        const cy = ZONE.y + r * ch;
        let fill = PALETTE.dim;
        let alpha = 0.25;
        if (s.phase === 'inFlight' && s.pitch) {
          const rowIdx = PITCH_TYPES.indexOf(s.pitch.type);
          const colIdx = COURSES.indexOf(s.pitch.course);
          if (rowIdx === r && colIdx === c) { fill = PALETTE.yellow; alpha = 0.55; }
        }
        d.rect(cx + 2, cy + 2, cw - 4, ch - 4, fill, { alpha });
      }
    }
    d.rect(ZONE.x, ZONE.y, ZONE.w, ZONE.h, PALETTE.white, { fill: false, width: 2, alpha: 0.4 });

    // 공 + 타이밍 게이지
    if (s.phase === 'inFlight' && s.pitch) {
      const t = Math.min(1, s.pitch.elapsed / s.pitch.duration);
      const bx = PITCHER_POS.x + (BATTER_POS.x - PITCHER_POS.x) * t;
      const by = PITCHER_POS.y + (BATTER_POS.y - PITCHER_POS.y) * t;
      d.circle(bx, by, 8, PALETTE.white, { glow: 12 });

      d.rect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, PALETTE.dim, { alpha: 0.4 });
      const sweetW = (s.pitch.window / s.pitch.duration) * GAUGE.w;
      d.rect(GAUGE.x + GAUGE.w - sweetW, GAUGE.y, sweetW, GAUGE.h, PALETTE.yellow, { alpha: 0.5 });
      const markerX = GAUGE.x + Math.min(1, s.pitch.elapsed / s.pitch.duration) * GAUGE.w;
      d.rect(markerX - 3, GAUGE.y - 6, 6, GAUGE.h + 12, PALETTE.cyan, { glow: 10 });
    }

    // 결과 배너
    if (s.phase === 'result' && s.lastResult) {
      const r = s.lastResult;
      const color = r.outcome === 'homerun' ? PALETTE.yellow : r.outcome === 'out' ? PALETTE.red : PALETTE.green;
      d.text(OUTCOME_LABEL[r.outcome], FIELD_X, 340, { size: r.outcome === 'homerun' ? 46 : 32, bold: true, color, glow: 14 });
    }

    // 게임 종료 배너
    if (s.over) {
      d.rect(0, 0, 960, 640, PALETTE.bg, { alpha: 0.5 });
      d.text(`${s.winner}P 우승!`, FIELD_X, 200, { size: 40, bold: true, color: SIDE_COLOR[s.winner], glow: 18 });
    }
  },

  dispose() {
    this.s = null;
    this.api = null;
  },
};
