import { describe, it, expect } from 'vitest';
import game, {
  TURRET_TYPES, LANE_UNITS,
  waveEnemyPlan, createDefenseState, startNextWave, tickSpawning, advanceEnemies,
  canAfford, placeDefender, updateDefenders, checkWaveComplete, checkGameOver,
  pickCellAt, pickCardAt,
} from '../../src/games/farm-defense.js';
import { makeRng } from '../../src/core/rng.js';

const rng = () => makeRng(11);

describe('초기 상태', () => {
  it('골드·체력·웨이브·점수가 정해진 값으로 시작한다', () => {
    const s = createDefenseState({ rng: rng() });
    expect(s.gold).toBe(100);
    expect(s.health).toBe(10);
    expect(s.wave).toBe(0);
    expect(s.score).toBe(0);
    expect(s.dead).toBe(false);
    expect(s.enemies).toEqual([]);
  });

  it('레인마다 칸이 전부 비어있다', () => {
    const s = createDefenseState({ rng: rng() });
    expect(s.defenders.length).toBe(3);
    for (const lane of s.defenders) {
      expect(lane.length).toBe(6);
      expect(lane.every((cell) => cell === null)).toBe(true);
    }
  });
});

describe('웨이브 스폰과 전진', () => {
  it('startNextWave는 웨이브 번호를 올리고 스폰 큐를 채운다', () => {
    const s = createDefenseState({ rng: rng() });
    startNextWave(s, rng());
    expect(s.wave).toBe(1);
    expect(s.spawnQueue.length).toBe(waveEnemyPlan(1).count);
    expect(s.waveActive).toBe(true);
  });

  it('tickSpawning은 시간이 지나면 큐에서 필드로 적을 하나씩 옮긴다', () => {
    const s = createDefenseState({ rng: rng() });
    startNextWave(s, rng());
    const before = s.spawnQueue.length;
    tickSpawning(s, 0); // 타이머 0에서 시작하므로 즉시 하나 스폰
    expect(s.enemies.length).toBe(1);
    expect(s.spawnQueue.length).toBe(before - 1);
    expect(s.enemies[0].pos).toBe(LANE_UNITS);
  });

  it('advanceEnemies는 속도*dt만큼 농장 쪽으로 전진시킨다', () => {
    const s = createDefenseState({ rng: rng() });
    s.enemies.push({ lane: 0, pos: 50, speed: 10, hp: 5, maxHp: 5, armor: 0, goldReward: 5, alive: true });
    advanceEnemies(s, 1);
    expect(s.enemies[0].pos).toBe(40);
  });

  it('농장(pos 0)에 도달하면 체력이 줄고 필드에서 사라진다', () => {
    const s = createDefenseState({ rng: rng() });
    s.enemies.push({ lane: 1, pos: 2, speed: 10, hp: 5, maxHp: 5, armor: 0, goldReward: 5, alive: true });
    const reached = advanceEnemies(s, 1); // pos: 2 - 10 = -8 <= 0
    expect(reached).toBe(1);
    expect(s.health).toBe(9);
    expect(s.enemies.length).toBe(0);
  });
});

describe('포탑 배치와 골드', () => {
  it('충분한 골드가 있으면 배치되고 골드가 깎인다', () => {
    const s = createDefenseState({ rng: rng() });
    const res = placeDefender(s, 0, 0, 'scarecrow');
    expect(res.placed).toBe(true);
    expect(s.gold).toBe(100 - TURRET_TYPES.scarecrow.cost);
    expect(s.defenders[0][0]).toMatchObject({ type: 'scarecrow' });
  });

  it('골드가 모자라면 배치가 거절되고 골드는 그대로다', () => {
    const s = createDefenseState({ rng: rng(), startGold: 5 });
    expect(canAfford(s, 'potato')).toBe(false);
    const res = placeDefender(s, 0, 0, 'potato');
    expect(res.placed).toBe(false);
    expect(res.reason).toBe('gold');
    expect(s.gold).toBe(5);
    expect(s.defenders[0][0]).toBe(null);
  });

  it('이미 포탑이 있는 칸에는 다시 놓을 수 없다', () => {
    const s = createDefenseState({ rng: rng() });
    placeDefender(s, 0, 0, 'scarecrow');
    const res = placeDefender(s, 0, 0, 'water');
    expect(res.placed).toBe(false);
    expect(res.reason).toBe('occupied');
    expect(s.defenders[0][0].type).toBe('scarecrow'); // 원래 포탑 그대로
  });

  it('화면 밖 칸/레인 지정은 거절된다', () => {
    const s = createDefenseState({ rng: rng() });
    expect(placeDefender(s, -1, 0, 'scarecrow').placed).toBe(false);
    expect(placeDefender(s, 0, 99, 'scarecrow').placed).toBe(false);
  });
});

describe('포탑의 자동 공격과 처치', () => {
  it('사거리 안의 가장 가까운 적을 쏘고 데미지를 준다', () => {
    const s = createDefenseState({ rng: rng() });
    placeDefender(s, 0, 0, 'potato'); // cellPosition(0) = 12, range 20
    s.enemies.push({ lane: 0, pos: 15, speed: 1, hp: 30, maxHp: 30, armor: 0, goldReward: 5, alive: true });
    const events = updateDefenders(s, 1 / 60);
    expect(events.some((e) => e.kind === 'shot')).toBe(true);
    expect(s.enemies[0].hp).toBeLessThan(30);
  });

  it('데미지가 충분하면 적을 처치하고 골드·킬 수가 오른다', () => {
    const s = createDefenseState({ rng: rng() });
    placeDefender(s, 0, 0, 'potato');
    const goldAfterPlace = s.gold;
    s.enemies.push({ lane: 0, pos: 12, speed: 1, hp: 3, maxHp: 3, armor: 0, goldReward: 7, alive: true });
    const events = updateDefenders(s, 1 / 60);
    expect(events.some((e) => e.kind === 'kill')).toBe(true);
    expect(s.kills).toBe(1);
    expect(s.gold).toBe(goldAfterPlace + 7);
    expect(s.enemies.length).toBe(0);
  });

  it('사거리 밖이나 다른 레인의 적은 공격하지 않는다', () => {
    const s = createDefenseState({ rng: rng() });
    placeDefender(s, 0, 0, 'scarecrow'); // range 15
    s.enemies.push({ lane: 0, pos: 90, speed: 1, hp: 5, maxHp: 5, armor: 0, goldReward: 5, alive: true }); // 사거리 밖
    s.enemies.push({ lane: 1, pos: 12, speed: 1, hp: 5, maxHp: 5, armor: 0, goldReward: 5, alive: true }); // 다른 레인
    updateDefenders(s, 1 / 60);
    expect(s.enemies[0].hp).toBe(5);
    expect(s.enemies[1].hp).toBe(5);
  });

  it('방어구가 있으면 데미지가 줄지만 최소 1은 들어간다', () => {
    const s = createDefenseState({ rng: rng() });
    placeDefender(s, 0, 0, 'scarecrow'); // damage 2
    s.enemies.push({ lane: 0, pos: 12, speed: 1, hp: 20, maxHp: 20, armor: 3, goldReward: 5, alive: true });
    updateDefenders(s, 1 / 60);
    expect(s.enemies[0].hp).toBe(19); // 2 - 3 → 최소 1
  });
});

describe('패배 조건', () => {
  it('체력이 0이 되면 게임 오버로 판정한다', () => {
    const s = createDefenseState({ rng: rng(), startHealth: 1 });
    s.enemies.push({ lane: 0, pos: 1, speed: 5, hp: 5, maxHp: 5, armor: 0, goldReward: 5, alive: true });
    advanceEnemies(s, 1);
    expect(s.health).toBe(0);
    expect(checkGameOver(s)).toBe(true);
    expect(s.dead).toBe(true);
  });

  it('체력이 남아있으면 게임 오버가 아니다', () => {
    const s = createDefenseState({ rng: rng() });
    expect(checkGameOver(s)).toBe(false);
  });
});

describe('점수', () => {
  it('처치할 때마다 점수가 킬 수만큼 오른다', () => {
    const s = createDefenseState({ rng: rng() });
    placeDefender(s, 0, 0, 'potato');
    s.enemies.push({ lane: 0, pos: 12, speed: 1, hp: 1, maxHp: 1, armor: 0, goldReward: 5, alive: true });
    updateDefenders(s, 1 / 60);
    expect(s.score).toBe(1);
  });

  it('웨이브를 클리어하면 점수에 웨이브 수 × 10이 더해진다', () => {
    const s = createDefenseState({ rng: rng() });
    startNextWave(s, rng());
    s.spawnQueue = [];   // 스폰할 적 없음 → 즉시 클리어 조건
    s.enemies = [];
    const cleared = checkWaveComplete(s);
    expect(cleared).toBe(true);
    expect(s.wavesCleared).toBe(1);
    expect(s.score).toBe(10);
  });
});

describe('웨이브 난이도 램프', () => {
  it('웨이브가 오를수록 적 수·체력·속도가 늘어난다', () => {
    const early = waveEnemyPlan(1);
    const later = waveEnemyPlan(8);
    expect(later.count).toBeGreaterThan(early.count);
    expect(later.hp).toBeGreaterThan(early.hp);
    expect(later.speed).toBeGreaterThan(early.speed);
  });

  it('5웨이브마다 방어구 로봇이 섞여 나온다', () => {
    expect(waveEnemyPlan(5).armored).toBe(true);
    expect(waveEnemyPlan(10).armored).toBe(true);
    expect(waveEnemyPlan(3).armored).toBe(false);
    expect(waveEnemyPlan(7).armored).toBe(false);
  });
});

describe('탭 좌표 판정', () => {
  it('밭 칸 중심을 탭하면 해당 레인·칸을 돌려준다', () => {
    const hit = pickCellAt(120 + (12 / 100) * 780, 76 + 148 / 2);
    expect(hit).toEqual({ lane: 0, cell: 0 });
  });

  it('밭 밖을 탭하면 null이다', () => {
    expect(pickCellAt(10, 10)).toBe(null);
  });

  it('하단 카드 영역을 탭하면 해당 포탑 키를 돌려준다', () => {
    expect(pickCardAt(90, 560)).toBe('scarecrow');
    expect(pickCardAt(10, 10)).toBe(null);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('farm-defense');
    expect(game.players).toBe(1);
    expect(game.controls).toBe('pointer');
    expect(game.tags).toContain('defense');
  });
});
