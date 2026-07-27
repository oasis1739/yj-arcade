import { describe, it, expect } from 'vitest';
import { PALETTE, createDraw } from '../../src/core/draw.js';
import { stubCtx, callNames } from '../helpers/stubCtx.js';

describe('PALETTE', () => {
  it('필요한 색이 모두 hex로 정의돼 있다', () => {
    for (const k of ['bg', 'panel', 'dim', 'cyan', 'magenta', 'yellow', 'green', 'orange', 'white', 'red']) {
      expect(PALETTE[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('createDraw', () => {
  it('clear는 캔버스 전체를 배경색으로 채운다', () => {
    const ctx = stubCtx(960, 640);
    createDraw(ctx).clear();
    expect(ctx.calls).toContainEqual(['fillRect', 0, 0, 960, 640]);
    expect(ctx.fillStyle).toBe(PALETTE.bg);
  });

  it('rect는 채운다', () => {
    const ctx = stubCtx();
    createDraw(ctx).rect(10, 20, 30, 40, PALETTE.cyan);
    expect(ctx.calls).toContainEqual(['fillRect', 10, 20, 30, 40]);
  });

  it('fill:false면 외곽선만 그린다', () => {
    const ctx = stubCtx();
    createDraw(ctx).rect(10, 20, 30, 40, PALETTE.cyan, { fill: false });
    expect(ctx.calls).toContainEqual(['strokeRect', 10, 20, 30, 40]);
    expect(callNames(ctx)).not.toContain('fillRect');
  });

  it('circle은 호를 그린다', () => {
    const ctx = stubCtx();
    createDraw(ctx).circle(50, 60, 12, PALETTE.magenta);
    expect(ctx.calls).toContainEqual(['arc', 50, 60, 12, 0, Math.PI * 2]);
  });

  it('text는 문자열을 그리고 정렬을 세팅한다', () => {
    const ctx = stubCtx();
    createDraw(ctx).text('점수 12', 100, 50, { size: 24, align: 'left' });
    expect(ctx.calls).toContainEqual(['fillText', '점수 12', 100, 50]);
    expect(ctx.textAlign).toBe('left');
    expect(ctx.font).toContain('24px');
  });

  it('roundRect는 경로를 그린다', () => {
    const ctx = stubCtx();
    createDraw(ctx).roundRect(10, 20, 30, 40, 5, PALETTE.magenta);
    expect(ctx.calls).toContainEqual(['moveTo', 15, 20]);
    const arcToCalls = ctx.calls.filter((c) => c[0] === 'arcTo');
    expect(arcToCalls).toHaveLength(4);
    expect(callNames(ctx)).toContain('fill');
  });

  it('roundRect fill:false면 stroke를 호출한다', () => {
    const ctx = stubCtx();
    createDraw(ctx).roundRect(10, 20, 30, 40, 5, PALETTE.magenta, { fill: false });
    expect(callNames(ctx)).toContain('stroke');
    expect(callNames(ctx)).not.toContain('fill');
  });

  it('glow 옵션은 shadowBlur를 세우고 save/restore로 감싼다', () => {
    const ctx = stubCtx();
    createDraw(ctx).circle(10, 10, 5, PALETTE.cyan, { glow: 14 });
    const names = callNames(ctx);
    expect(names[0]).toBe('save');
    expect(names[names.length - 1]).toBe('restore');
    expect(ctx.shadowBlur).toBe(14);
    expect(ctx.shadowColor).toBe(PALETTE.cyan);
  });

  it('glow 옵션 없으면 shadowBlur는 0이고 shadowColor는 transparent다', () => {
    const ctx = stubCtx();
    createDraw(ctx).circle(10, 10, 5, PALETTE.cyan);
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.shadowColor).toBe('transparent');
  });

  it('모든 그리기는 상태를 save/restore로 복원한다', () => {
    const ctx = stubCtx();
    const d = createDraw(ctx);
    d.rect(0, 0, 1, 1, PALETTE.cyan);
    d.text('가', 0, 0);
    d.line(0, 0, 5, 5, PALETTE.green);
    const names = callNames(ctx);
    expect(names.filter((n) => n === 'save').length)
      .toBe(names.filter((n) => n === 'restore').length);
  });
});
