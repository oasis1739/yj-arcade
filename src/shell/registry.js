// 게임 모듈 수집과 계약 검증. 셸이 개별 게임을 모르게 하는 유일한 접점.
export const TAGS = ['action', 'puzzle', 'defense', 'sports', 'quiz', 'versus'];
export const CONTROLS = ['pointer', 'dpad', 'dpad+a', 'versus'];
export const SCORE_ORDERS = ['high', 'low'];
const REQUIRED_FUNCS = ['icon', 'init', 'update', 'render', 'dispose'];

export function baseName(path) {
  return path.split('/').pop().replace(/\.js$/, '');
}

export function validateGame(mod, path) {
  const errors = [];
  const g = mod?.default;
  const name = baseName(path);

  if (!g || typeof g !== 'object') {
    return [`${name}: default export가 없습니다`];
  }
  if (g.id !== name) errors.push(`${name}: id("${g.id}")가 파일명과 다릅니다`);
  if (typeof g.title !== 'string' || g.title.length === 0) errors.push(`${name}: title이 없습니다`);

  if (!Array.isArray(g.tags) || g.tags.length === 0) {
    errors.push(`${name}: tags가 비었습니다`);
  } else {
    const bad = g.tags.filter((t) => !TAGS.includes(t));
    if (bad.length) errors.push(`${name}: 모르는 tags ${bad.join(',')}`);
  }

  if (g.players !== 1 && g.players !== 2) errors.push(`${name}: players는 1 또는 2여야 합니다`);
  if (g.players === 2 && Array.isArray(g.tags) && !g.tags.includes('versus')) {
    errors.push(`${name}: players가 2면 tags에 versus가 있어야 합니다`);
  }
  if (typeof g.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(g.color)) {
    errors.push(`${name}: color는 #rrggbb 형식이어야 합니다`);
  }
  if (g.controls !== undefined && !CONTROLS.includes(g.controls)) {
    errors.push(`${name}: 모르는 controls "${g.controls}"`);
  }
  if (g.scoreOrder !== undefined && !SCORE_ORDERS.includes(g.scoreOrder)) {
    errors.push(`${name}: scoreOrder는 high 또는 low여야 합니다`);
  }
  for (const fn of REQUIRED_FUNCS) {
    if (typeof g[fn] !== 'function') errors.push(`${name}: ${fn}() 함수가 없습니다`);
  }
  return errors;
}

function withDefaults(g) {
  return {
    ...g,
    controls: g.controls ?? 'pointer',
    scoreOrder: g.scoreOrder ?? 'high',
    scoreLabel: g.scoreLabel ?? '점수',
    archived: g.archived ?? false,
  };
}

export function collectGames(modules) {
  const games = [];
  const errors = [];
  const paths = Object.keys(modules).sort();

  // id 중복은 파일명-불일치 등 다른 검증 오류와 무관하게 먼저 잡는다.
  const idToPaths = new Map();
  for (const path of paths) {
    const id = modules[path]?.default?.id;
    if (id === undefined) continue;
    if (!idToPaths.has(id)) idToPaths.set(id, []);
    idToPaths.get(id).push(path);
  }
  const duplicateIds = new Set();
  for (const [id, ps] of idToPaths) {
    if (ps.length > 1) {
      duplicateIds.add(id);
      errors.push(`${id}: id가 중복입니다 (${ps.join(', ')})`);
    }
  }

  for (const path of paths) {
    const errs = validateGame(modules[path], path);
    if (errs.length) { errors.push(...errs); continue; }
    const g = withDefaults(modules[path].default);
    if (duplicateIds.has(g.id)) continue;
    games.push(g);
  }

  games.sort((a, b) => {
    const ta = TAGS.indexOf(a.tags[0]);
    const tb = TAGS.indexOf(b.tags[0]);
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title, 'ko');
  });

  return { games, errors };
}

export function visibleGames(games, filter = 'all') {
  return games.filter((g) => !g.archived && (filter === 'all' || g.tags.includes(filter)));
}
