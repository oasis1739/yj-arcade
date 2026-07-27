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
    // tick()이 예기치 못하게 던지더라도(게임/셸의 방어망을 뚫고 올라온 예외)
    // 다음 프레임은 반드시 다시 예약한다 — 안 그러면 rAF 체인이 끊기고
    // running은 true로 남아 loop.start()가 조용히 무시돼, 새로고침 전까지
    // 화면이 완전히 멈춘다.
    try {
      tick(now - last);
    } finally {
      last = now;
      if (running) rafId = requestAnimationFrame(frame);
    }
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
