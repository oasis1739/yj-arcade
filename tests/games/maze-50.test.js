import { describe, it, expect } from 'vitest';
import game, {
  stageConfig,
  generateMaze,
  floodFill,
  isMazeSolvable,
  placeKeysAndDoors,
  createPatrols,
  createStage,
  canPass,
  tryMove,
  isCellVisible,
  isStageSolvable,
  updatePatrols,
  patrolsTouchingPlayer,
  tickTimer,
  resetStageAttempt,
  loadProgress,
  saveProgress,
} from '../../src/games/maze-50.js';
import { makeRng } from '../../src/core/rng.js';
import { stubCtx } from '../helpers/stubCtx.js';
import { createFakeApi } from '../helpers/fakeApi.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    get(k, fallback) { return k in data ? data[k] : fallback; },
    set(k, v) { data[k] = v; },
    data,
  };
}

// 최소 형태의 stageData를 손으로 만든다 — 절차 생성에 기대지 않고 이동/문/
// 열쇠/순찰 규칙만 정확히 겨냥해서 테스트한다.
function emptyWalls() {
  return { N: true, S: true, E: true, W: true };
}

function buildCorridor({ withDoor = false } = {}) {
  // 가로 1x3 복도: (0,0)-(0,1)-(0,2), 시작 (0,0) 출구 (0,2).
  const w = 3;
  const h = 1;
  const walls = [[emptyWalls(), emptyWalls(), emptyWalls()]];
  walls[0][0].E = false; walls[0][1].W = false;
  walls[0][1].E = false; walls[0][2].W = false;

  const maze = { w, h, walls };
  const start = { r: 0, c: 0 };
  const exit = { r: 0, c: 2 };
  const doors = [];
  const doorMap = new Map();
  if (withDoor) {
    const door = { id: 0, r: 0, c: 1, nr: 0, nc: 2, keyId: 0, open: false };
    doors.push(door);
    doorMap.set('0,1|0,2', door);
  }
  return {
    stage: 1,
    cfg: { mazeW: w, mazeH: h, keysCount: withDoor ? 1 : 0, fog: false, fogRadius: null, patrolCount: 0, patrolInterval: null, timeLimit: null },
    maze, start, exit,
    keys: [],
    doors, doorMap,
    patrols: [],
    player: { r: 0, c: 0 },
    timeLeft: null,
    cleared: false,
  };
}

describe('미로 생성', () => {
  it('생성된 미로는 항상 시작에서 출구까지 갈 수 있다 (flood fill로 확인)', () => {
    for (const stage of [1, 10, 25, 40, 50]) {
      const s = createStage(stage);
      expect(isMazeSolvable(s.maze, s.start, s.exit)).toBe(true);
      expect(isStageSolvable(s)).toBe(true);
    }
  });

  it('같은 단계 번호는 항상 같은 미로를 만든다 (시드 = 단계 번호)', () => {
    const a = createStage(23);
    const b = createStage(23);
    expect(a.maze).toEqual(b.maze);
    expect(a.keys).toEqual(b.keys);
    expect(a.doors).toEqual(b.doors);
    expect(a.patrols.map((p) => p.route)).toEqual(b.patrols.map((p) => p.route));
  });

  it('무작위 DFS로 만든 미로는 모든 칸이 하나로 연결된 스패닝 트리다', () => {
    const rng = makeRng(555);
    const maze = generateMaze(7, 6, rng);
    const reached = floodFill(maze, { r: 0, c: 0 });
    expect(reached.size).toBe(7 * 6);
  });
});

describe('이동과 벽', () => {
  it('벽이 있으면 실제로 이동을 막는다', () => {
    const s = buildCorridor();
    s.maze.walls[0][0].E = true; // 억지로 벽을 세운다
    const r = tryMove(s, 0, 1);
    expect(r.moved).toBe(false);
    expect(r.blocked).toBe(true);
    expect(s.player).toEqual({ r: 0, c: 0 });
  });

  it('벽이 없으면 인접 칸으로 이동한다', () => {
    const s = buildCorridor();
    const r = tryMove(s, 0, 1);
    expect(r.moved).toBe(true);
    expect(s.player).toEqual({ r: 0, c: 1 });
  });

  it('화면(미로) 밖으로는 못 나간다', () => {
    const s = buildCorridor();
    const r = tryMove(s, -1, 0);
    expect(r.moved).toBe(false);
    expect(s.player).toEqual({ r: 0, c: 0 });
  });
});

describe('출구', () => {
  it('출구 칸에 닿으면 그 단계가 클리어된다', () => {
    const s = buildCorridor();
    tryMove(s, 0, 1);
    const r = tryMove(s, 0, 1);
    expect(r.exited).toBe(true);
    expect(s.cleared).toBe(true);
  });

  it('클리어된 뒤에는 더 이동할 수 없다', () => {
    const s = buildCorridor();
    tryMove(s, 0, 1);
    tryMove(s, 0, 1);
    const r = tryMove(s, 0, -1);
    expect(r.moved).toBe(false);
  });
});

describe('열쇠/문 규칙', () => {
  it('문은 대응하는 열쇠를 먹기 전까지 막는다', () => {
    const s = buildCorridor({ withDoor: true });
    const r = tryMove(s, 0, 1); // (0,0)->(0,1), 문 아직 안 열림
    expect(r.moved).toBe(true);
    const blocked = tryMove(s, 0, 1); // (0,1)->(0,2) 문에 막힘
    expect(blocked.moved).toBe(false);
    expect(blocked.blocked).toBe(true);
  });

  it('열쇠를 먹으면 문이 열려서 지나갈 수 있다', () => {
    const s = buildCorridor({ withDoor: true });
    s.keys.push({ id: 0, r: 0, c: 1, collected: false });
    const r1 = tryMove(s, 0, 1); // (0,0)->(0,1): 열쇠 칸, 자동 습득
    expect(r1.collectedKey).toBe(0);
    expect(s.doors[0].open).toBe(true);
    const r2 = tryMove(s, 0, 1); // (0,1)->(0,2): 이제 문이 열려 있다
    expect(r2.moved).toBe(true);
    expect(r2.exited).toBe(true);
  });

  it('절차 생성된 열쇠/문 단계도 항상 순서대로 풀 수 있다', () => {
    // band 2(11~20)는 열쇠/문이 등장하는 구간이다.
    for (const stage of [11, 15, 20, 41, 45, 50]) {
      const s = createStage(stage);
      if (s.cfg.keysCount > 0) {
        expect(s.doors.length).toBeGreaterThan(0);
        expect(s.keys.length).toBe(s.doors.length);
      }
      expect(isStageSolvable(s)).toBe(true);
    }
  });
});

describe('안개(시야 제한)', () => {
  it('반경 안의 칸은 보이고 밖의 칸은 안 보인다', () => {
    expect(isCellVisible(5, 5, 2, 5, 5)).toBe(true);
    expect(isCellVisible(5, 5, 2, 6, 6)).toBe(true);
    expect(isCellVisible(5, 5, 2, 9, 9)).toBe(false);
  });

  it('fogRadius가 없으면(null) 전부 보인다', () => {
    expect(isCellVisible(0, 0, null, 40, 40)).toBe(true);
  });
});

describe('순찰 로봇', () => {
  it('플레이어와 같은 칸에 있으면 접촉으로 판정된다', () => {
    const s = buildCorridor();
    s.patrols = [{ id: 0, route: [{ r: 0, c: 0 }, { r: 0, c: 1 }], index: 0, dir: 1, timer: 0, initIndex: 0, initDir: 1 }];
    expect(patrolsTouchingPlayer(s)).toBe(true);
  });

  it('접촉하면 그 단계가 처음부터 다시 시작된다 (위치·열쇠·문·순찰 초기화)', () => {
    const s = buildCorridor({ withDoor: true });
    s.keys.push({ id: 0, r: 0, c: 1, collected: false });
    s.patrols = [{ id: 0, route: [{ r: 0, c: 2 }, { r: 0, c: 1 }], index: 1, dir: -1, timer: 0.4, initIndex: 0, initDir: 1 }];
    tryMove(s, 0, 1); // 열쇠 습득, 문 열림, 플레이어 (0,1)
    expect(patrolsTouchingPlayer(s)).toBe(true); // 순찰이 지금 (0,1)에 있다

    resetStageAttempt(s);
    expect(s.player).toEqual({ r: 0, c: 0 });
    expect(s.keys[0].collected).toBe(false);
    expect(s.doors[0].open).toBe(false);
    expect(s.patrols[0].index).toBe(0);
    expect(s.patrols[0].dir).toBe(1);
    expect(s.cleared).toBe(false);
  });

  it('순찰은 경로 끝에서 방향을 바꿔 왕복한다', () => {
    const s = buildCorridor();
    s.cfg = { ...s.cfg, patrolCount: 1, patrolInterval: 0.1 };
    s.patrols = [{ id: 0, route: [{ r: 0, c: 0 }, { r: 0, c: 1 }], index: 0, dir: 1, timer: 0, initIndex: 0, initDir: 1 }];
    updatePatrols(s, 0.1); // 0 -> 1 (경로의 끝에 도달)
    expect(s.patrols[0].index).toBe(1);
    expect(s.patrols[0].dir).toBe(1);
    updatePatrols(s, 0.1); // 더 못 가니 방향만 바꾼다
    expect(s.patrols[0].index).toBe(1);
    expect(s.patrols[0].dir).toBe(-1);
    updatePatrols(s, 0.1); // 1 -> 0
    expect(s.patrols[0].index).toBe(0);
    expect(s.patrols[0].dir).toBe(-1);
  });

  it('절차 생성된 순찰 경로는 항상 2칸 이상이고, 인접한 칸끼리만 이어진다', () => {
    for (const stage of [31, 35, 40, 45, 50]) {
      const s = createStage(stage);
      expect(s.patrols.length).toBe(s.cfg.patrolCount);
      for (const p of s.patrols) {
        expect(p.route.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < p.route.length; i++) {
          const a = p.route[i - 1];
          const b = p.route[i];
          const manhattan = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
          expect(manhattan).toBe(1); // 대각선/순간이동 없이 한 칸씩만 잇는다
        }
      }
    }
  });
});

describe('제한 시간(41~50단계)', () => {
  it('시간이 다 되면 만료로 보고한다', () => {
    const s = buildCorridor();
    s.timeLeft = 0.05;
    const r = tickTimer(s, 0.1);
    expect(r.expired).toBe(true);
    expect(s.timeLeft).toBe(0);
  });

  it('클리어된 단계는 시간이 더 흘러도 만료 처리하지 않는다', () => {
    const s = buildCorridor();
    s.timeLeft = 0.05;
    s.cleared = true;
    const r = tickTimer(s, 1);
    expect(r.expired).toBe(false);
  });
});

describe('난이도 곡선', () => {
  it('미로 크기는 단계가 오를수록 줄어들지 않는다', () => {
    let prev = 0;
    for (let stage = 1; stage <= 50; stage++) {
      const cfg = stageConfig(stage);
      expect(cfg.mazeW).toBeGreaterThanOrEqual(prev);
      prev = cfg.mazeW;
    }
    expect(stageConfig(50).mazeW).toBeGreaterThan(stageConfig(1).mazeW);
  });

  it('각 구간은 정해진 규칙만 새로 켠다 (1~10 없음, 11~20 열쇠, 21~30 안개, 31~40 순찰)', () => {
    const b1 = stageConfig(5);
    expect(b1.keysCount).toBe(0);
    expect(b1.fog).toBe(false);
    expect(b1.patrolCount).toBe(0);

    const b2 = stageConfig(15);
    expect(b2.keysCount).toBeGreaterThan(0);
    expect(b2.fog).toBe(false);
    expect(b2.patrolCount).toBe(0);

    const b3 = stageConfig(25);
    expect(b3.keysCount).toBe(0);
    expect(b3.fog).toBe(true);
    expect(b3.patrolCount).toBe(0);

    const b4 = stageConfig(35);
    expect(b4.keysCount).toBe(0);
    expect(b4.fog).toBe(false);
    expect(b4.patrolCount).toBeGreaterThan(0);
  });

  it('41~50단계는 열쇠·안개·순찰·제한시간이 전부 켜진다', () => {
    const b5 = stageConfig(45);
    expect(b5.keysCount).toBeGreaterThan(0);
    expect(b5.fog).toBe(true);
    expect(b5.patrolCount).toBeGreaterThan(0);
    expect(b5.timeLimit).toBeGreaterThan(0);
  });
});

describe('진행 저장/불러오기', () => {
  it('저장된 값이 없으면 1단계부터 시작한다', () => {
    expect(loadProgress(fakeStorage())).toBe(1);
  });

  it('저장한 단계를 그대로 불러온다', () => {
    const storage = fakeStorage();
    saveProgress(storage, 12);
    expect(loadProgress(storage)).toBe(12);
  });

  it('범위를 벗어난 값은 1로 되돌린다', () => {
    expect(loadProgress(fakeStorage({ stage: 999 }))).toBe(1);
    expect(loadProgress(fakeStorage({ stage: 0 }))).toBe(1);
    expect(loadProgress(fakeStorage({ stage: 'x' }))).toBe(1);
  });

  it('저장 값은 1~50 범위로 잘린다', () => {
    const storage = fakeStorage();
    saveProgress(storage, 999);
    expect(storage.data.stage).toBe(50);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('maze-50');
    expect(game.players).toBe(1);
    expect(game.controls).toBe('dpad');
    expect(game.scoreOrder).toBe('high');
  });

  it('저장된 단계에서 이어서 시작하고, 그 단계 번호를 바로 점수로 보고한다', () => {
    const original = globalThis.localStorage;
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    };
    store['maze-50:stage'] = JSON.stringify(7);

    const ctx = stubCtx();
    const { api, events } = createFakeApi(ctx);
    game.init(api);
    expect(events.scores[0]).toBe(7);
    game.dispose();

    globalThis.localStorage = original;
  });
});
