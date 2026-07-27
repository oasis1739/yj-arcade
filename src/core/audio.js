// WebAudio 합성 효과음. 오디오 파일 0개가 원칙이므로 전부 합성한다.
// iOS는 사용자 제스처 전에는 소리를 막으므로 AudioContext를 지연 생성한다.
export function createAudio(AudioCtor) {
  const Ctor = AudioCtor === undefined
    ? (globalThis.AudioContext || globalThis.webkitAudioContext || null)
    : AudioCtor;
  let ac = null;
  let muted = false;

  function ensure() {
    if (muted || !Ctor) return null;
    if (!ac) ac = new Ctor();
    if (ac.state === 'suspended') ac.resume?.();
    return ac;
  }

  function envelope(c, gain, ms) {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    g.connect(c.destination);
    return g;
  }

  return {
    beep(freq = 440, ms = 80, type = 'square') {
      const c = ensure();
      if (!c) return;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(envelope(c, 0.06, ms));
      o.start(c.currentTime);
      o.stop(c.currentTime + ms / 1000);
    },

    sweep(from = 200, to = 800, ms = 150, type = 'sawtooth') {
      const c = ensure();
      if (!c) return;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = from;
      o.frequency.setValueAtTime(from, c.currentTime);
      o.frequency.linearRampToValueAtTime(to, c.currentTime + ms / 1000);
      o.connect(envelope(c, 0.05, ms));
      o.start(c.currentTime);
      o.stop(c.currentTime + ms / 1000);
    },

    noise(ms = 120) {
      const c = ensure();
      if (!c) return;
      const rate = c.sampleRate || 44100;
      const len = Math.max(1, Math.floor((rate * ms) / 1000));
      const buf = c.createBuffer(1, len, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(envelope(c, 0.08, ms));
      src.start(c.currentTime);
    },

    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
  };
}
