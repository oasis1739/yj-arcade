// 고정 타임스텝 루프. 프로젝트 YJ 네온 테스트 챔버에서 이식.
export function createLoop({ update, render, dt }) {
  const stepMs = dt * 1000;
  let acc = 0;
  let running = false;
  let rafId = 0;
  let last = 0;

  function tick(frameMs) {
    acc += frameMs;
    let count = 0;
    // 긴 정지(탭 전환 등) 후 죽음의 나선을 막는다.
    if (acc > stepMs * 5) acc = stepMs * 5;
    // -1e-9: 누산기가 부동소수 반올림으로 stepMs 바로 아래에 걸리는 경우 방어.
    while (acc >= stepMs - 1e-9) {
      update(dt);
      acc -= stepMs;
      count++;
    }
    render(acc / stepMs);
    return count;
  }

  function frame(now) {
    if (!running) return;
    tick(now - last);
    last = now;
    rafId = requestAnimationFrame(frame);
  }

  return {
    tick,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
