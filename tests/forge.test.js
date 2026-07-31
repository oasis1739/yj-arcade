import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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

  it('이미 구현된 게임은 큐에 남아 있지 않다 (큐는 아직 안 만든 것만 담는다)', () => {
    const shipped = readdirSync(new URL('../src/games/', import.meta.url))
      .filter((f) => f.endsWith('.js'))
      .map((f) => f.replace(/\.js$/, ''));
    expect(shipped.length).toBeGreaterThan(0);
    const queued = catalog.queue.map((e) => e.id);
    const both = shipped.filter((id) => queued.includes(id));
    expect(both).toEqual([]);
  });

  it('유준이가 직접 요청한 그림퍼즐·미로찾기·그림기억·앵그리버드2인이 큐에 있다', () => {
    const ids = catalog.queue.map((e) => e.id);
    for (const id of ['picture-puzzle', 'maze-50', 'memory-sequence', 'fort-duel']) {
      expect(ids).toContain(id);
    }
  });

  it('출시 후 플레이테스트에서 반려된 농장 디펜스·야구 배틀왕은 큐에 없다 (구현은 archived:true로 남고, 큐는 새 작업만 담는다)', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(ids).not.toContain('farm-defense');
    expect(ids).not.toContain('baseball-battle');
  });

  it('오너가 드롭한 무한의 계단은 큐에 없다 (구현 없이 큐만 정리된 상태를 고정한다)', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(ids).not.toContain('infinite-stairs');
  });

  it('세 축(혼자/아빠랑/두뇌)이 큐에 골고루 있다', () => {
    const hasVersus = catalog.queue.some((e) => e.players === 2 && e.tags.includes('versus'));
    const hasPuzzle = catalog.queue.some((e) => e.tags.includes('puzzle'));
    const hasSoloAction = catalog.queue.some((e) => e.players === 1 && e.tags.includes('action'));
    expect(hasVersus).toBe(true);
    expect(hasPuzzle).toBe(true);
    expect(hasSoloAction).toBe(true);
  });
});

describe('forge/contract.md', () => {
  it('모범 예시 두 개를 가리킨다', () => {
    expect(contract).toContain('src/games/crossy-robot.js');
    expect(contract).toContain('src/games/sudoku.js');
  });

  it('계약 테스트 실행 명령을 알려준다', () => {
    expect(contract).toContain('tests/contract.test.js');
  });

  it('Math.random 금지를 명시한다', () => {
    expect(contract).toContain('Math.random');
  });
});

// 팔레트/Math.random/단일 파일 규칙은 지금까지 contract.md가 "말"만 하고
// 아무도 "검사"하지 않았다. 여기서부터는 src/games/*.js 소스를 직접 읽어
// 정적으로 강제한다. src/core/audio.js는 노이즈 버퍼에 Math.random()을
// 정당하게 쓰므로, 검사 범위를 src/games/에만 한정한다 — 레포 전체를
// grep하면 audio.js에서 오탐이 난다.
describe('src/games/*.js 정적 린트 (팔레트 · Math.random · import 제한)', () => {
  const gamesDir = new URL('../src/games/', import.meta.url);
  const files = readdirSync(gamesDir).filter((f) => f.endsWith('.js'));

  // 헥스 컬러 리터럴: 따옴표로 감싼 완전한 3/4/6/8자리 헥스값만 잡는다.
  // (주석 속 "#123" 같은 우연한 문자열까지 오탐하지 않도록 따옴표로 경계를 준다.)
  const HEX_COLOR = /(['"`])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\1/;
  const MATH_RANDOM = /Math\.random\s*\(/;
  const IMPORT_SPEC = /import\s+(?:[\s\S]*?\bfrom\s+)?['"]([^'"]+)['"]/g;
  const ALLOWED_IMPORT = /^\.\.\/core\/[\w.-]+\.js$/;

  it('게임 파일이 하나 이상 있다 (린트 대상이 비어 있지 않음을 확인)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe.each(files)('%s', (file) => {
    const src = readFileSync(new URL(file, gamesDir)).toString();

    it('헥스 색 리터럴 없이 PALETTE만 쓴다', () => {
      expect(src).not.toMatch(HEX_COLOR);
    });

    it('Math.random 대신 api.rng를 쓴다', () => {
      expect(src).not.toMatch(MATH_RANDOM);
    });

    it('../core/*.js 밖의 모듈은 import하지 않는다 (게임 하나 = 파일 하나)', () => {
      const specs = [...src.matchAll(IMPORT_SPEC)].map((m) => m[1]);
      for (const spec of specs) {
        expect(spec).toMatch(ALLOWED_IMPORT);
      }
    });
  });
});
