import { describe, it, expect } from 'vitest';
import game, {
  shapeCountForLength,
  litDurationMs,
  soundHintEnabled,
  generateSequence,
  createMemoryState,
  advancePlayback,
  submitTap,
  advanceToNextRound,
  retryRound,
  advanceWrongPause,
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

describe('그림 기억 — 규칙', () => {
  it('1단계는 도형 2개짜리 순서로 시작한다', () => {
    const state = createMemoryState({ rng: makeRng(1) });
    expect(state.seqLen).toBe(2);
    expect(state.sequence.length).toBe(2);
    expect(state.phase).toBe('showing');
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
  });

  it('정답을 끝까지 입력하면 라운드가 완료되고, 다음 라운드는 순서가 1개 길어진다', () => {
    const state = createMemoryState({ rng: makeRng(2) });
    state.phase = 'input'; // 재생이 끝났다고 가정
    const result = completeRound(state);

    expect(result.correct).toBe(true);
    expect(result.roundComplete).toBe(true);
    expect(state.score).toBe(2);

    advanceToNextRound(state, makeRng(99));
    expect(state.seqLen).toBe(3);
    expect(state.sequence.length).toBe(3);
    expect(state.phase).toBe('showing');
    expect(state.inputIndex).toBe(0);
  });

  it('틀린 탭은 목숨을 정확히 하나만 깎고 같은 순서를 다시 보여준다', () => {
    const state = createMemoryState({ rng: makeRng(3) });
    state.phase = 'input';
    const original = state.sequence.slice();

    const wrongValue = (state.sequence[0] + 1) % state.shapeCount;
    const result = submitTap(state, wrongValue);

    expect(result.correct).toBe(false);
    expect(state.lives).toBe(2);
    expect(state.phase).toBe('wrongPause');

    advanceWrongPause(state, 100000); // 충분히 큰 dt로 대기 시간을 끝낸다
    expect(state.phase).toBe('showing');
    expect(state.sequence).toEqual(original); // 시퀀스는 그대로
    expect(state.inputIndex).toBe(0);
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
        expect(state.phase).toBe('showing');
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

  it('재생(showing) 중의 입력은 무시된다', () => {
    const state = createMemoryState({ rng: makeRng(7) });
    expect(state.phase).toBe('showing');
    const before = { lives: state.lives, inputIndex: state.inputIndex };

    const result = submitTap(state, state.sequence[0]);

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
    expect(state.litSlot).toBe(state.sequence[0]);
    expect(state.phase).toBe('showing');

    // 아주 큰 dt를 여러 번 넣어 전체 시퀀스 재생을 끝까지 밀어붙인다
    for (let i = 0; i < 50 && state.phase === 'showing'; i++) {
      advancePlayback(state, 500);
    }
    expect(state.phase).toBe('input');
    expect(state.litSlot).toBe(-1);
  });

  it('재시도(retryRound)는 같은 시퀀스를 유지하고 재생 상태를 초기화한다', () => {
    const state = createMemoryState({ rng: makeRng(9) });
    const seq = state.sequence.slice();
    state.phase = 'input';
    state.inputIndex = 1;
    state.wrongSlot = 0;

    retryRound(state);

    expect(state.sequence).toEqual(seq);
    expect(state.phase).toBe('showing');
    expect(state.inputIndex).toBe(0);
    expect(state.playIndex).toBe(0);
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
