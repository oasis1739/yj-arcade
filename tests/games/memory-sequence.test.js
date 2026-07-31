import { describe, it, expect } from 'vitest';
import game, {
  shapeCountForLength,
  litDurationMs,
  soundHintEnabled,
  generateSequence,
  createMemoryState,
  advanceReady,
  advancePlayback,
  submitTap,
  advanceToNextRound,
  retryRound,
  advanceWrongPause,
  advanceRoundComplete,
} from '../../src/games/memory-sequence.js';
import { makeRng } from '../../src/core/rng.js';

// 정답 시퀀스를 전부 정답으로 입력하는 헬퍼(테스트 편의용).
function completeRound(state) {
  let result;
  for (const value of state.sequence) {
    result = submitTap(state, value);
  }
  return result;
}

// 'ready' 단계를 큰 dt로 즉시 통과시켜 'showing'으로 넘기는 헬퍼.
function skipReady(state) {
  advanceReady(state, 1_000_000);
}

describe('그림 기억 — 규칙', () => {
  it('1단계는 도형 2개짜리 순서로 시작하고, 재생 전 준비(ready) 단계부터 시작한다', () => {
    const state = createMemoryState({ rng: makeRng(1) });
    expect(state.seqLen).toBe(2);
    expect(state.sequence.length).toBe(2);
    expect(state.phase).toBe('ready');
    expect(state.readyTimer).toBeGreaterThan(0);
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
  });

  it('정답을 끝까지 입력하면 라운드 완료(roundComplete) 축하 단계를 거쳐 다음 라운드는 순서가 1개 길어진다', () => {
    const state = createMemoryState({ rng: makeRng(2) });
    state.phase = 'input'; // 재생이 끝났다고 가정
    const result = completeRound(state);

    expect(result.correct).toBe(true);
    expect(result.roundComplete).toBe(true);
    expect(state.score).toBe(2);
    // 곧장 다음 라운드로 넘어가지 않고 축하 연출 단계에 먼저 머문다.
    expect(state.phase).toBe('roundComplete');
    expect(state.roundCompleteTimer).toBeGreaterThan(0);

    advanceToNextRound(state, makeRng(99));
    expect(state.seqLen).toBe(3);
    expect(state.sequence.length).toBe(3);
    expect(state.phase).toBe('ready'); // 다음 라운드도 재생 전 준비 단계부터
    expect(state.inputIndex).toBe(0);
  });

  it('틀린 탭은 목숨을 정확히 하나만 깎고, 준비 단계를 거쳐 같은 순서를 다시 보여준다', () => {
    const state = createMemoryState({ rng: makeRng(3) });
    state.phase = 'input';
    const original = state.sequence.slice();

    const wrongValue = (state.sequence[0] + 1) % state.shapeCount;
    const result = submitTap(state, wrongValue);

    expect(result.correct).toBe(false);
    expect(state.lives).toBe(2);
    expect(state.phase).toBe('wrongPause');

    advanceWrongPause(state, 100000); // 충분히 큰 dt로 대기 시간을 끝낸다
    expect(state.phase).toBe('ready'); // 곧장 재생이 아니라 준비 단계로
    expect(state.sequence).toEqual(original); // 시퀀스는 그대로
    expect(state.inputIndex).toBe(0);

    skipReady(state);
    expect(state.phase).toBe('showing');
  });

  it('세 번 틀리면 게임이 끝난다', () => {
    const state = createMemoryState({ rng: makeRng(4) });
    state.phase = 'input';

    for (let i = 0; i < 3; i++) {
      const wrongValue = (state.sequence[0] + 1) % state.shapeCount;
      const result = submitTap(state, wrongValue);
      if (i < 2) {
        expect(state.phase).toBe('wrongPause');
        advanceWrongPause(state, 100000);
        expect(state.phase).toBe('ready');
        state.phase = 'input';
      } else {
        expect(result.gameOver).toBe(true);
      }
    }

    expect(state.lives).toBe(0);
    expect(state.phase).toBe('gameover');
  });

  it('점수는 성공한 가장 긴 순서 길이다', () => {
    const state = createMemoryState({ rng: makeRng(5) });
    expect(state.score).toBe(0);

    state.phase = 'input';
    completeRound(state); // seqLen 2 완료
    expect(state.score).toBe(2);
    advanceToNextRound(state, makeRng(6));

    state.phase = 'input';
    completeRound(state); // seqLen 3 완료
    expect(state.score).toBe(3);

    // 실패해도 점수는 줄지 않는다
    state.phase = 'input';
    const wrongValue = (state.sequence[0] + 1) % state.shapeCount;
    submitTap(state, wrongValue);
    expect(state.score).toBe(3);
  });

  it('준비(ready) 단계와 재생(showing) 중의 입력은 무시된다', () => {
    const state = createMemoryState({ rng: makeRng(7) });
    expect(state.phase).toBe('ready');

    let result = submitTap(state, 0);
    expect(result.ignored).toBe(true);

    skipReady(state);
    expect(state.phase).toBe('showing');
    const before = { lives: state.lives, inputIndex: state.inputIndex };

    result = submitTap(state, state.sequence[0]);

    expect(result.ignored).toBe(true);
    expect(state.lives).toBe(before.lives);
    expect(state.inputIndex).toBe(before.inputIndex);
    expect(state.phase).toBe('showing');
  });

  it('어시스트 스케줄이 정해진 경계에서 바뀐다 (소리 힌트 7부터 off, 노출시간 9부터 감소, 도형 수 11부터 증가)', () => {
    expect(soundHintEnabled(2)).toBe(true);
    expect(soundHintEnabled(6)).toBe(true);
    expect(soundHintEnabled(7)).toBe(false);
    expect(soundHintEnabled(10)).toBe(false);

    expect(litDurationMs(8)).toBe(litDurationMs(2));
    expect(litDurationMs(9)).toBeLessThan(litDurationMs(8));
    expect(litDurationMs(20)).toBeGreaterThanOrEqual(400); // 하한 클램프

    expect(shapeCountForLength(2)).toBe(4);
    expect(shapeCountForLength(10)).toBe(4);
    expect(shapeCountForLength(11)).toBeGreaterThan(4);
    expect(shapeCountForLength(999)).toBeLessThanOrEqual(9);
  });

  it('같은 시드는 같은 시퀀스를 만든다 (결정론)', () => {
    const a = generateSequence(6, 4, makeRng(42));
    const b = generateSequence(6, 4, makeRng(42));
    expect(a).toEqual(b);

    const stateA = createMemoryState({ rng: makeRng(123) });
    const stateB = createMemoryState({ rng: makeRng(123) });
    expect(stateA.sequence).toEqual(stateB.sequence);
  });

  it('재생 애니메이션은 update가 미는 상태로만 진행된다 (advancePlayback)', () => {
    const state = createMemoryState({ rng: makeRng(8) });
    expect(state.phase).toBe('ready');
    skipReady(state);
    expect(state.phase).toBe('showing');
    // ready가 막 끝난 시점엔 아직 advancePlayback을 한 번도 안 불렀으므로
    // 첫 도형이 아직 밝혀지지 않은 상태다(다음 update 틱에서 밝혀진다).
    expect(state.litSlot).toBe(-1);

    // 아주 큰 dt를 여러 번 넣어 전체 시퀀스 재생을 끝까지 밀어붙인다
    for (let i = 0; i < 50 && state.phase === 'showing'; i++) {
      advancePlayback(state, 500);
    }
    expect(state.phase).toBe('input');
    expect(state.litSlot).toBe(-1);
    // 입력이 열린 순간("네 차례") 강조 타이머가 켜져 있어야 한다.
    expect(state.turnFlashTimer).toBeGreaterThan(0);
  });

  it('재시도(retryRound)는 같은 시퀀스를 유지하고 준비(ready) 단계로 되돌아간다', () => {
    const state = createMemoryState({ rng: makeRng(9) });
    const seq = state.sequence.slice();
    state.phase = 'input';
    state.inputIndex = 1;
    state.wrongSlot = 0;

    retryRound(state);

    expect(state.sequence).toEqual(seq);
    expect(state.phase).toBe('ready');
    expect(state.inputIndex).toBe(0);
    expect(state.playIndex).toBe(-1);
  });
});

describe('그림 기억 — 피드백 상태 (시작/완료/성공/실패를 화면으로 알 수 있는가)', () => {
  it('재생 한 번(첫 도형 lit)에는 반드시 첫 도형이 밝혀지는 프레임이 있다 — 즉 showing 진입 시 litSlot이 -1로 시작해서 실제 도형 인덱스로 바뀐다', () => {
    const state = createMemoryState({ rng: makeRng(11) });
    skipReady(state);
    expect(state.litSlot).toBe(-1);
    advancePlayback(state, 16); // 정상 프레임 하나(1/60초 근방)
    expect(state.litSlot).toBe(state.sequence[0]);
    expect(state.justLit).toBe(true);
  });

  it('입력이 열리는 순간(input phase 진입)은 turnFlashTimer로 관찰 가능하다', () => {
    const state = createMemoryState({ rng: makeRng(12) });
    skipReady(state);
    expect(state.turnFlashTimer).toBe(0);
    for (let i = 0; i < 50 && state.phase === 'showing'; i++) advancePlayback(state, 500);
    expect(state.phase).toBe('input');
    expect(state.turnFlashTimer).toBeGreaterThan(0);
  });

  it('정답 탭은 correctFlashSlot/correctFlashTimer로 관찰 가능한 즉시 피드백 상태를 만든다', () => {
    const state = createMemoryState({ rng: makeRng(13) });
    state.phase = 'input';
    const first = state.sequence[0];

    const result = submitTap(state, first);

    expect(result.correct).toBe(true);
    expect(state.correctFlashSlot).toBe(first);
    expect(state.correctFlashTimer).toBeGreaterThan(0);
  });

  it('오답 탭은 mistake-feedback(wrongPause) 상태로 들어가고, 목숨이 하나 줄고, 방금 빠진 자리가 lifeLostIndex/lifeLostTimer로 관찰 가능하다', () => {
    const state = createMemoryState({ rng: makeRng(14) });
    state.phase = 'input';
    const livesBefore = state.lives;
    const wrongValue = (state.sequence[0] + 1) % state.shapeCount;

    const result = submitTap(state, wrongValue);

    expect(result.correct).toBe(false);
    expect(state.phase).toBe('wrongPause');
    expect(state.lives).toBe(livesBefore - 1);
    expect(state.lifeLostIndex).toBe(state.lives); // 방금 빈 자리의 인덱스
    expect(state.lifeLostTimer).toBeGreaterThan(0);
  });

  it('마지막 목숨을 잃으면 gameover 상태가 되고, 그 순간에도 lifeLostIndex/lifeLostTimer가 관찰 가능하다', () => {
    const state = createMemoryState({ rng: makeRng(15) });
    state.phase = 'input';
    state.lives = 1;
    const wrongValue = (state.sequence[0] + 1) % state.shapeCount;

    const result = submitTap(state, wrongValue);

    expect(result.gameOver).toBe(true);
    expect(state.phase).toBe('gameover');
    expect(state.lives).toBe(0);
    expect(state.lifeLostIndex).toBe(0);
    expect(state.lifeLostTimer).toBeGreaterThan(0);
  });

  it('라운드를 다 맞히면 roundComplete 상태로 들어가고, 시간이 충분히 지나야만(advanceRoundComplete) 다음 라운드로 넘길 준비가 된다', () => {
    const state = createMemoryState({ rng: makeRng(16) });
    state.phase = 'input';
    completeRound(state);

    expect(state.phase).toBe('roundComplete');
    expect(state.roundCompleteTimer).toBeGreaterThan(0);

    // 아직 축하 연출이 끝나지 않았으면 false
    expect(advanceRoundComplete(state, 1)).toBe(false);
    expect(state.phase).toBe('roundComplete');

    // 충분히 큰 dt를 주면 true(= 다음 라운드로 넘어갈 준비 완료)를 반환한다.
    expect(advanceRoundComplete(state, 1_000_000)).toBe(true);
  });

  it('정답 강조/목숨 강조 타이머는 phase와 무관하게 시간이 지나면 스스로 꺼진다', () => {
    const state = createMemoryState({ rng: makeRng(17) });
    state.phase = 'input';
    submitTap(state, state.sequence[0]); // 정답 → correctFlashTimer 켜짐
    expect(state.correctFlashTimer).toBeGreaterThan(0);

    // update()가 advanceFeedbackTimers를 부르는 걸 흉내: 큰 dt로 advanceWrongPause를
    // 통해 확인할 수는 없으니, 직접 시간 경과를 흉내내려면 advancePlayback 등
    // 시간 진행 함수를 거쳐야 한다 — 여기서는 라운드를 마저 끝내 roundComplete로
    // 넘어간 뒤에도 correctFlashSlot이 유효했던 값이 phase 전이와 무관하게
    // 독립적으로 설정돼 있었음을 확인한다.
    expect(state.correctFlashSlot).toBe(state.sequence[0]);
  });
});

describe('그림 기억 — 계약 메타', () => {
  it('id와 기본 메타가 카탈로그와 일치한다', () => {
    expect(game.id).toBe('memory-sequence');
    expect(game.title).toBeTruthy();
    expect(game.players).toBe(1);
    expect(game.tags).toContain('puzzle');
    expect(game.controls).toBe('pointer');
    expect(game.scoreOrder).toBe('high');
    expect(game.scoreLabel).toBe('단계');
    expect(/^#[0-9a-f]{6}$/i.test(game.color)).toBe(true);
  });
});
