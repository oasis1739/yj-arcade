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
  // 범위를 벗어난 페이지는 마지막 유효 페이지로 접는다 (음수는 첫 페이지로).
  const p = Math.min(Math.max(page, 0), pages - 1);
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
        // 게임 하나의 icon()이 죽어도(예: dispose된 게임의 필드를 읽는 버그)
        // 메뉴 전체가 못 그려지면 안 되니, 실패하면 자리표시 도형으로 대신한다.
        const iconSize = 96;
        ctx.save();
        ctx.translate(tile.x + tile.w / 2 - iconSize / 2, tile.y + 26);
        try {
          game.icon(ctx, iconSize);
        } catch (err) {
          console.error(`[YJ 아케이드] ${game.id ?? '?'} 아이콘이 깨졌어요:`, err);
          d.circle(iconSize / 2, iconSize / 2, iconSize / 3, PALETTE.dim);
          d.text('?', iconSize / 2, iconSize / 2, { size: 32, bold: true, color: PALETTE.white });
        }
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
