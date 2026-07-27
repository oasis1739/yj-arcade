import { describe, it, expect, vi, afterEach } from 'vitest';
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
    // 게임이 한 페이지뿐이면 "마지막 페이지"와 "0번째 페이지"가 같은 값이라
    // 이 경우만으로는 실제로 마지막 페이지로 접히는지 구별할 수 없다.
    const games = Array.from({ length: 3 }, (_, i) => g(`g${i}`));
    expect(menuLayout(games, 9).page).toBe(0);

    // 페이지가 여러 개일 때 범위를 벗어나면 진짜 마지막 페이지(마지막 유효 인덱스)로
    // 접혀야 한다 — 0번째로 리셋되는 것과는 다른 동작이다.
    const many = Array.from({ length: 20 }, (_, i) => g(`g${i}`));
    const L = menuLayout(many, 99);
    expect(L.pages).toBe(3);
    expect(L.page).toBe(L.pages - 1);
    expect(L.tiles[0].game.id).toBe(`g${2 * PER_PAGE}`);
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

  describe('망가진 게임 아이콘으로부터 메뉴를 보호한다', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('한 게임의 icon()이 던져도 나머지 타일은 그대로 그려진다', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const broken = g('broken', ['action'], { icon() { throw new Error('boom'); } });
      const list = [broken, g('ok1', ['action']), g('ok2', ['action'])];
      const ctx = stubCtx();

      expect(() => {
        createMenu({ games: list, records: mkRecords(), draw: createDraw(ctx) }).render(ctx);
      }).not.toThrow();

      const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
      expect(texts).toContain('ok1');
      expect(texts).toContain('ok2');
      expect(console.error).toHaveBeenCalled();

      const names = ctx.calls.map((c) => c[0]);
      expect(names.filter((n) => n === 'save').length)
        .toBe(names.filter((n) => n === 'restore').length);
    });
  });
});
