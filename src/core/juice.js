import { PALETTE } from './draw.js';

// 손맛 담당: 화면 흔들림, 파티클, 히트스톱. 전부 스크린 스페이스(카메라 없음).
export function createJuice(rng) {
  const parts = [];
  let shakeMag = 0;
  let shakeLeft = 0;
  let shakeDur = 0;
  let freeze = 0;
  let ox = 0;
  let oy = 0;

  return {
    shake(mag = 8, dur = 0.25) {
      shakeMag = Math.max(shakeMag, mag);
      shakeLeft = Math.max(shakeLeft, dur);
      shakeDur = Math.max(shakeDur, dur);
    },

    hitstop(sec = 0.06) {
      freeze = Math.max(freeze, sec);
    },

    frozen() {
      return freeze > 0;
    },

    burst(x, y, opts = {}) {
      const {
        color = PALETTE.white, count = 10, speed = 160, life = 0.45,
        size = 3, gravity = 320, angle = null, spread = Math.PI * 2,
      } = opts;
      for (let i = 0; i < count; i++) {
        const a = angle === null
          ? rng.next() * Math.PI * 2
          : angle + (rng.next() - 0.5) * spread;
        const s = speed * (0.4 + rng.next() * 0.6);
        parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life, maxLife: life, color, size, gravity,
        });
      }
    },

    update(dt) {
      if (freeze > 0) freeze = Math.max(0, freeze - dt);

      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const falloff = shakeDur > 0 ? shakeLeft / shakeDur : 0;
        const m = shakeMag * falloff;
        // 0이 나와 "안 흔들림"으로 보이지 않도록 최소 크기를 준다.
        const jitter = () => (rng.next() < 0.5 ? -1 : 1) * (0.35 + rng.next() * 0.65) * m;
        ox = jitter();
        oy = jitter();
        if (shakeLeft === 0) { ox = 0; oy = 0; shakeMag = 0; shakeDur = 0; }
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
    },

    draw(ctx) {
      if (parts.length === 0) return;
      ctx.save();
      for (const p of parts) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const s = p.size * (0.5 + a * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    },

    offset() {
      return { x: ox, y: oy };
    },

    count() {
      return parts.length;
    },

    reset() {
      parts.length = 0;
      shakeMag = 0; shakeLeft = 0; shakeDur = 0; freeze = 0; ox = 0; oy = 0;
    },
  };
}
