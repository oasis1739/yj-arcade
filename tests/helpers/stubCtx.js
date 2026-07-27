// 모든 Canvas 2D 메서드를 삼키고 호출을 기록하는 가짜 컨텍스트.
// 계약 테스트와 draw 테스트가 공유한다.
const METHODS = [
  'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo',
  'rect', 'roundRect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fill',
  'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
  'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
  'drawImage', 'setLineDash', 'putImageData',
];

export function stubCtx(width = 960, height = 640) {
  const calls = [];
  const ctx = {
    calls,
    canvas: { width, height },
    measureText: (s) => ({ width: String(s).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  for (const m of METHODS) {
    ctx[m] = (...args) => { calls.push([m, ...args]); };
  }
  return ctx;
}

export function callNames(ctx) {
  return ctx.calls.map((c) => c[0]);
}
