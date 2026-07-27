// 논리 해상도. 셸의 뷰포트(960x640)와 같은 값이지만 core는 shell을 몰라야
// 하므로(계층 방향) shell/viewport.js를 import하지 않고 여기서 다시 정의한다.
const LOGICAL_W = 960;
const LOGICAL_H = 640;

// 네온 팔레트와 그리기 헬퍼. 게임은 색을 직접 하드코딩하지 않고 PALETTE만 쓴다.
export const PALETTE = {
  bg: '#05060d',
  panel: '#0d1226',
  dim: '#3a4460',
  cyan: '#39f6ff',
  magenta: '#ff2e88',
  yellow: '#ffd23f',
  green: '#39ff88',
  orange: '#ff8a3b',
  white: '#eaffff',
  red: '#ff4d5e',
};

export function createDraw(ctx) {
  function begin(color, { glow = 0, alpha = 1, width = 2 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = glow;
    ctx.shadowColor = glow ? color : 'transparent';
  }

  return {
    clear(color = PALETTE.bg) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      // ctx.canvas.width/height는 물리(백킹) 픽셀이지만, 이 함수는 이미 논리
      // 좌표계 변환이 걸린 뒤 불린다(main.js가 setTransform으로 스케일/오프셋을
      // 적용한 상태). 물리 크기로 채우면 고DPR 아이패드에서 실제 필요한 면적의
      // 몇 배를 매 프레임 다시 칠하게 된다 — 지금까지는 960x640 클립으로
      // 가려졌을 뿐 낭비였다.
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    },

    rect(x, y, w, h, color, opts = {}) {
      begin(color, opts);
      if (opts.fill === false) ctx.strokeRect(x, y, w, h);
      else ctx.fillRect(x, y, w, h);
      ctx.restore();
    },

    roundRect(x, y, w, h, r, color, opts = {}) {
      begin(color, opts);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (opts.fill === false) ctx.stroke();
      else ctx.fill();
      ctx.restore();
    },

    circle(cx, cy, r, color, opts = {}) {
      begin(color, opts);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (opts.fill === false) ctx.stroke();
      else ctx.fill();
      ctx.restore();
    },

    line(x1, y1, x2, y2, color, opts = {}) {
      begin(color, opts);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    },

    text(str, x, y, opts = {}) {
      const { size = 20, color = PALETTE.white, align = 'center',
              baseline = 'middle', bold = false } = opts;
      begin(color, opts);
      ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      ctx.fillText(String(str), x, y);
      ctx.restore();
    },
  };
}
