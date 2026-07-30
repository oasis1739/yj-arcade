import { describe, it, expect } from 'vitest';
import game, {
  createBaseballState, pickPitch, flightDuration, hitWindow, classifySwing, runsFor,
  startPitch, advanceFlight, swingAt, resolvePitchOutcome, endHalfInning, decideWinner,
  isAiSide, INNINGS, OUTS_PER_HALF, MAX_PITCHES_PER_HALF, PITCH_TYPES, COURSES,
} from '../../src/games/baseball-battle.js';
import { createFakeApi } from '../helpers/fakeApi.js';
import { stubCtx } from '../helpers/stubCtx.js';
import { makeRng } from '../../src/core/rng.js';

describe('초기 상태', () => {
  it('1P가 먼저 던지고 2P가 먼저 친다, 0:0, 1이닝', () => {
    const s = createBaseballState();
    expect(s.inning).toBe(1);
    expect(s.half).toBe('top');
    expect(s.pitcher).toBe(1);
    expect(s.batter).toBe(2);
    expect(s.outs).toBe(0);
    expect(s.score).toEqual({ 1: 0, 2: 0 });
    expect(s.phase).toBe('pitchSelect');
    expect(s.over).toBe(false);
    expect(s.winner).toBe(null);
  });
});

describe('투수 조준 (구종·코스 선택)', () => {
  it('스틱을 중립에 두면 미들 코스 커브를 던진다', () => {
    expect(pickPitch(0, 0)).toEqual({ type: 'curve', course: 'middle' });
  });

  it('위+왼쪽은 직구·인사이드, 아래+오른쪽은 체인지업·아웃사이드다', () => {
    expect(pickPitch(-1, -1)).toEqual({ type: 'fastball', course: 'inside' });
    expect(pickPitch(1, 1)).toEqual({ type: 'changeup', course: 'outside' });
  });

  it('가능한 조합은 항상 정해진 구종·코스 목록 안에 있다', () => {
    for (const x of [-1, -0.5, 0, 0.5, 1]) {
      for (const y of [-1, -0.5, 0, 0.5, 1]) {
        const p = pickPitch(x, y);
        expect(PITCH_TYPES).toContain(p.type);
        expect(COURSES).toContain(p.course);
      }
    }
  });
});

describe('공 던지기 (startPitch)', () => {
  it('phase를 inFlight로 바꾸고 구종·코스에 맞는 비행시간·타이밍존을 계산한다', () => {
    const s = createBaseballState();
    startPitch(s, { type: 'fastball', course: 'middle' });
    expect(s.phase).toBe('inFlight');
    expect(s.pitch.type).toBe('fastball');
    expect(s.pitch.course).toBe('middle');
    expect(s.pitch.duration).toBe(flightDuration('fastball', s.inning));
    expect(s.pitch.window).toBe(hitWindow('fastball', 'middle'));
    expect(s.pitch.elapsed).toBe(0);
  });
});

describe('난이도 램프 — 이닝이 갈수록 공이 빨라진다', () => {
  it('같은 구종이라도 늦은 이닝일수록 비행시간이 짧다(=더 빠르다)', () => {
    expect(flightDuration('fastball', 1)).toBeGreaterThan(flightDuration('fastball', 3));
    expect(flightDuration('changeup', 1)).toBeGreaterThan(flightDuration('changeup', 5));
  });

  it('아무리 이닝이 늘어도 하한선 밑으로는 안 빨라진다(사람이 칠 수 있어야 한다)', () => {
    const far = flightDuration('fastball', 50);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeCloseTo(flightDuration('fastball', 30), 5);
  });
});

describe('코스 난이도 — 구석 코스일수록 타이밍존이 좁다', () => {
  it('인사이드·아웃사이드는 미들보다 좁은 존을 가진다', () => {
    const mid = hitWindow('curve', 'middle');
    const inside = hitWindow('curve', 'inside');
    const outside = hitWindow('curve', 'outside');
    expect(inside).toBeLessThan(mid);
    expect(outside).toBeLessThan(mid);
  });
});

describe('스윙 타이밍 판정 (classifySwing)', () => {
  const window = 0.1;

  it('정확한 타이밍(diff=0)은 안타 등급 중 최고(홈런)다', () => {
    expect(classifySwing(0, window)).toBe('homerun');
  });

  it('너무 일찍 휘두르면(존 밖) 아웃이다', () => {
    expect(classifySwing(-0.5, window)).toBe('out');
  });

  it('너무 늦게 휘두르면(존 밖) 아웃이다', () => {
    expect(classifySwing(0.5, window)).toBe('out');
  });

  it('존 안이지만 중심에서 멀수록 등급이 낮아진다', () => {
    const near = classifySwing(window * 0.3, window);
    const far = classifySwing(window * 0.95, window);
    const order = ['out', 'single', 'double', 'triple', 'homerun'];
    expect(order.indexOf(near)).toBeGreaterThan(order.indexOf(far));
  });
});

describe('점수/타점 (runsFor)', () => {
  it('아웃은 0점, 홈런이 가장 높다', () => {
    expect(runsFor('out')).toBe(0);
    expect(runsFor('homerun')).toBeGreaterThan(runsFor('triple'));
    expect(runsFor('triple')).toBeGreaterThan(runsFor('double'));
    expect(runsFor('double')).toBeGreaterThan(runsFor('single'));
    expect(runsFor('single')).toBeGreaterThan(0);
  });
});

describe('스윙 처리 (swingAt) — 안타 vs 미스', () => {
  it('타이밍에 맞춰 휘두르면 타자 점수가 오른다(안타)', () => {
    const s = createBaseballState();
    startPitch(s, { type: 'fastball', course: 'middle' });
    s.pitch.elapsed = s.pitch.duration; // 정확한 타이밍
    const r = swingAt(s);
    expect(r.runs).toBeGreaterThan(0);
    expect(s.score[2]).toBe(r.runs); // 이 시점 타자는 2P
    expect(s.outs).toBe(0);
  });

  it('완전히 빗나간 타이밍에 휘두르면 아웃이 하나 늘어난다', () => {
    const s = createBaseballState();
    startPitch(s, { type: 'fastball', course: 'middle' });
    s.pitch.elapsed = 0; // 너무 이르다
    const r = swingAt(s);
    expect(r.outcome).toBe('out');
    expect(s.outs).toBe(1);
    expect(s.score[2]).toBe(0);
  });
});

describe('안 휘두르고 타임아웃 — 스트라이크 (advanceFlight)', () => {
  it('비행시간을 넘기도록 휘두르지 않으면 자동으로 아웃 처리된다', () => {
    const s = createBaseballState();
    startPitch(s, { type: 'changeup', course: 'middle' });
    const dur = s.pitch.duration;
    const r = advanceFlight(s, dur + 1); // 큰 dt로 단번에 타임아웃 통과
    expect(r.timedOut).toBe(true);
    expect(s.outs).toBe(1);
    expect(s.phase).toBe('result');
  });

  it('아직 비행 중이면(타임아웃 전) 아무 일도 안 일어난다', () => {
    const s = createBaseballState();
    startPitch(s, { type: 'changeup', course: 'middle' });
    const r = advanceFlight(s, 0.01);
    expect(r.timedOut).toBe(false);
    expect(s.phase).toBe('inFlight');
    expect(s.outs).toBe(0);
  });
});

describe('이닝/공수교대 진행', () => {
  it('아웃 3개가 쌓이면 half가 끝나고 공수가 바뀐다', () => {
    const s = createBaseballState();
    for (let i = 0; i < OUTS_PER_HALF; i++) {
      startPitch(s, { type: 'fastball', course: 'middle' });
      s.pitch.elapsed = 0; // 항상 헛스윙
      swingAt(s);
    }
    expect(s.outs).toBe(0); // half가 끝나며 리셋
    expect(s.half).toBe('bottom');
    expect(s.pitcher).toBe(2);
    expect(s.batter).toBe(1);
  });

  it('공수교대를 명시적으로 호출해도 같은 결과를 만든다', () => {
    const s = createBaseballState();
    s.outs = OUTS_PER_HALF;
    endHalfInning(s);
    expect(s.half).toBe('bottom');
    expect(s.outs).toBe(0);
  });

  it('한 이닝의 top·bottom이 모두 끝나면 이닝이 하나 늘어난다', () => {
    const s = createBaseballState();
    s.outs = OUTS_PER_HALF;
    endHalfInning(s); // top 종료 → bottom
    expect(s.inning).toBe(1);
    s.outs = OUTS_PER_HALF;
    endHalfInning(s); // bottom 종료 → 다음 이닝
    expect(s.inning).toBe(2);
    expect(s.half).toBe('top');
  });

  it('한 half 안에서 안타가 계속 나와도 최대 투구수를 넘기면 강제로 half가 끝난다', () => {
    const s = createBaseballState();
    for (let i = 0; i < MAX_PITCHES_PER_HALF; i++) {
      startPitch(s, { type: 'fastball', course: 'middle' });
      s.pitch.elapsed = s.pitch.duration; // 항상 안타
      swingAt(s);
    }
    expect(s.half).toBe('bottom'); // 3아웃 없이도 half가 넘어갔다
  });
});

describe('승자 결정', () => {
  it('3이닝을 마치고 점수가 다르면 높은 쪽이 이긴다', () => {
    const s = createBaseballState();
    s.inning = INNINGS;
    s.half = 'bottom';
    s.score = { 1: 5, 2: 2 };
    s.outs = OUTS_PER_HALF;
    endHalfInning(s);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(1);
  });

  it('3이닝 후 동점이면 아직 안 끝나고 연장으로 이어진다', () => {
    const s = createBaseballState();
    s.inning = INNINGS;
    s.half = 'bottom';
    s.score = { 1: 3, 2: 3 };
    s.outs = OUTS_PER_HALF;
    endHalfInning(s);
    expect(s.over).toBe(false);
    expect(s.inning).toBe(INNINGS + 1);
    expect(s.half).toBe('top');
  });

  it('연장을 다 채우고도 동점이면 안타 수로 타이브레이크한다', () => {
    expect(decideWinner(3, 3, 5, 2)).toBe(1);
    expect(decideWinner(3, 3, 1, 4)).toBe(2);
  });

  it('안타 수까지 완전히 같으면 1P가 이긴 것으로 한다(문서화된 하우스 룰)', () => {
    expect(decideWinner(4, 4, 2, 2)).toBe(1);
  });

  it('점수가 다르면 안타 수와 무관하게 점수가 높은 쪽이 이긴다', () => {
    expect(decideWinner(5, 1, 0, 9)).toBe(1);
  });
});

describe('계약', () => {
  it('id·메타가 스펙과 맞는다 (2인 versus 스포츠)', () => {
    expect(game.id).toBe('baseball-battle');
    expect(game.players).toBe(2);
    expect(game.tags).toContain('versus');
    expect(game.tags).toContain('sports');
    expect(game.controls).toBe('versus');
    expect(game.scoreOrder).toBe('high');
  });
});

describe('isAiSide — api.solo만으로 AI 자리를 정한다', () => {
  it('solo가 true면 2P 자리만 AI다', () => {
    expect(isAiSide(true, 1)).toBe(false);
    expect(isAiSide(true, 2)).toBe(true);
  });

  it('solo가 false면 두 자리 다 사람이다(AI 없음)', () => {
    expect(isAiSide(false, 1)).toBe(false);
    expect(isAiSide(false, 2)).toBe(false);
  });
});

describe('1인 플레이 (api.solo === true) — 2P를 건드리지 않아도 AI가 대신 진행한다', () => {
  it('2P 입력이 전혀 없어도 결국 onGameOver가 승자를 보고한다', () => {
    const { api, events } = createFakeApi(stubCtx(), { solo: true });
    const rng = makeRng(321);

    game.init(api);
    for (let f = 0; f < 3600; f++) {
      // 1P만 흔든다. 2P는 emptyPad 그대로 — 절대 건드리지 않는다.
      if (f % 7 === 0) { api.input.p1.x = rng.int(3) - 1; api.input.p1.y = rng.int(3) - 1; }
      api.input.p1.a = f % 11 === 0;
      api.input.p1.aHeld = f % 11 < 3;
      game.update(1 / 60);
      if (events.gameOvers.length > 0) break;
    }
    game.dispose();

    expect(events.gameOvers.length).toBeGreaterThan(0);
    expect([1, 2]).toContain(events.gameOvers[0].winner);
  });
});

describe('2인 플레이 (api.solo === false) — AI가 대신 스윙해주지 않는다', () => {
  it('2P가 타석에서 한 번도 A를 누르지 않으면 콜드 스트라이크(타임아웃)로만 아웃 처리된다(AI가 대신 맞춰주지 않는다)', () => {
    const { api } = createFakeApi(stubCtx(), { solo: false });
    game.init(api);
    // 1P가 곧바로 던지게 만든다.
    game.s.pitcher = 1;
    game.s.batter = 2;
    startPitch(game.s, { type: 'fastball', course: 'middle' });
    const duration = game.s.pitch.duration;
    // 2P(사람 취급)는 A를 전혀 누르지 않는다 — solo=false라 AI가 대신 휘두르면 안 된다.
    api.input.p2.a = false;
    api.input.p2.aHeld = false;

    let elapsed = 0;
    while (game.s.phase === 'inFlight' && elapsed < duration) {
      game.update(1 / 60);
      elapsed += 1 / 60;
    }
    // 비행시간 안에는 아직 안 끝나 있어야 한다(AI가 몰래 맞춰버리지 않았다는 뜻).
    expect(game.s.phase).toBe('inFlight');
    expect(game.s.score[2]).toBe(0);

    game.update(duration); // 그레이스(0.05s)를 넘기도록 충분히 진행
    expect(game.s.phase).toBe('result');
    expect(game.s.lastResult.outcome).toBe('out'); // 타임아웃 → 아웃. AI 안타가 아니다.
    game.dispose();
  });
});

describe('onScore/onGameOver — 2인 게임은 항상 1P의 점수만 보고한다', () => {
  it('swingAt으로 2P가 득점해도 update가 보고하는 점수는 1P 것이다(0에서 안 움직임)', () => {
    const { api, events } = createFakeApi(stubCtx(), { solo: false });
    game.init(api);
    game.s.pitcher = 1;
    game.s.batter = 2;
    startPitch(game.s, { type: 'fastball', course: 'middle' });
    game.s.pitch.elapsed = game.s.pitch.duration; // 정확한 타이밍 → 2P 홈런
    api.input.p2.a = true;
    game.update(1 / 60);

    expect(game.s.score[2]).toBeGreaterThan(0); // 2P는 실제로 득점했다
    expect(events.scores.length).toBeGreaterThan(0);
    expect(events.scores[events.scores.length - 1]).toBe(game.s.score[1]); // 보고된 값은 1P 것
    expect(events.scores[events.scores.length - 1]).toBe(0); // 1P는 아직 0점
    game.dispose();
  });

  it('게임이 끝나면 onGameOver의 score도 1P의 최종 점수와 같다', () => {
    const { api, events } = createFakeApi(stubCtx(), { solo: false });
    game.init(api);
    game.s.inning = INNINGS;
    game.s.half = 'bottom';
    game.s.outs = OUTS_PER_HALF;
    game.s.score = { 1: 5, 2: 2 };
    endHalfInning(game.s); // 3이닝 종료, 1P 승 (over=true)
    game.s.phase = 'result'; // update()는 result 단계에서만 over를 확인해 onGameOver를 쏜다
    game.update(1 / 60);
    game.dispose();

    expect(events.gameOvers.length).toBe(1);
    expect(events.gameOvers[0].winner).toBe(1);
    expect(events.gameOvers[0].score).toBe(5);
  });
});
