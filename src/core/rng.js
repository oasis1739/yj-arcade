// mulberry32 — 짧고 빠르고 시드 가능. 리플레이·테스트 재현성을 위해 Math.random 대신 쓴다.
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9; // 시드 0이면 수열이 죽는다

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int: (n) => Math.floor(next() * n),
    range: (a, b) => a + next() * (b - a),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}
