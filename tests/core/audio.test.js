import { describe, it, expect } from 'vitest';
import { createAudio } from '../../src/core/audio.js';

function fakeAudioCtx() {
  const created = { oscillators: [], gains: [], buffers: 0 };
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; Ctx.instances++; }
    createOscillator() {
      const o = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, start() { o.started = true; }, stop() { o.stopped = true; },
      };
      created.oscillators.push(o);
      return o;
    }
    createGain() {
      const g = { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
      created.gains.push(g);
      return g;
    }
    createBuffer(ch, len, rate) { created.buffers++; return { getChannelData: () => new Float32Array(len), length: len, sampleRate: rate }; }
    createBufferSource() { const s = { buffer: null, connect() {}, start() { s.started = true; }, stop() {} }; created.oscillators.push(s); return s; }
    resume() { this.state = 'running'; }
  }
  Ctx.instances = 0;
  return { Ctx, created };
}

describe('createAudio', () => {
  it('소리를 내기 전에는 AudioContext를 만들지 않는다', () => {
    const { Ctx } = fakeAudioCtx();
    createAudio(Ctx);
    expect(Ctx.instances).toBe(0);
  });

  it('첫 beep에서 AudioContext를 한 번만 만든다', () => {
    const { Ctx } = fakeAudioCtx();
    const a = createAudio(Ctx);
    a.beep(440, 50);
    a.beep(660, 50);
    expect(Ctx.instances).toBe(1);
  });

  it('beep은 오실레이터를 만들어 시작·정지한다', () => {
    const { Ctx, created } = fakeAudioCtx();
    createAudio(Ctx).beep(880, 60, 'square');
    const o = created.oscillators[0];
    expect(o.started).toBe(true);
    expect(o.stopped).toBe(true);
    expect(o.type).toBe('square');
    expect(o.frequency.value).toBe(880);
  });

  it('음소거면 소리를 만들지 않는다', () => {
    const { Ctx, created } = fakeAudioCtx();
    const a = createAudio(Ctx);
    a.setMuted(true);
    a.beep(440, 50);
    a.sweep(200, 800, 100);
    a.noise(80);
    expect(created.oscillators.length).toBe(0);
    expect(a.isMuted()).toBe(true);
  });

  it('sweep과 noise도 소스를 만든다', () => {
    const { Ctx, created } = fakeAudioCtx();
    const a = createAudio(Ctx);
    a.sweep(200, 800, 120);
    a.noise(80);
    expect(created.oscillators.length).toBe(2);
    expect(created.buffers).toBe(1);
  });

  it('AudioContext가 없는 환경에서도 던지지 않는다', () => {
    const a = createAudio(null);
    expect(() => { a.beep(); a.sweep(100, 200, 50); a.noise(); }).not.toThrow();
  });
});
