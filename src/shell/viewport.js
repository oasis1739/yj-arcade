// 논리 해상도 고정 + 레터박스. 게임은 언제나 960x640에 그린다.
export const LOGICAL_W = 960;
export const LOGICAL_H = 640;

export function computeFit(cssW, cssH, dpr = 1) {
  const backingW = Math.round(cssW * dpr);
  const backingH = Math.round(cssH * dpr);
  const scale = Math.min(backingW / LOGICAL_W, backingH / LOGICAL_H);
  return {
    backingW,
    backingH,
    scale,
    offsetX: (backingW - LOGICAL_W * scale) / 2,
    offsetY: (backingH - LOGICAL_H * scale) / 2,
  };
}

// 캔버스 좌상단 기준 물리 픽셀 → 논리 좌표
export function toLogicalFactory(fit) {
  return (px, py) => ({
    x: (px - fit.offsetX) / fit.scale,
    y: (py - fit.offsetY) / fit.scale,
  });
}
