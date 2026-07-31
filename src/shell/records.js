// 게임별 최고기록과 플레이 횟수.
export function createRecords(storage) {
  const bestKey = (id) => `best:${id}`;
  const playKey = (id) => `plays:${id}`;

  const records = {
    best(id) {
      const v = storage.get(bestKey(id), null);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },

    plays(id) {
      const v = storage.get(playKey(id), 0);
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    },

    _updateBest(id, score, order) {
      const prev = this.best(id);
      if (!Number.isFinite(score)) return { best: prev, isNew: false };
      const isNew = prev === null || (order === 'low' ? score < prev : score > prev);
      if (isNew) storage.set(bestKey(id), score);
      return { best: isNew ? score : prev, isNew };
    },

    // 게임이 onGameOver로 "이 판은 끝났다"고 선언했을 때만 부른다. 최고기록
    // 갱신과 플레이 횟수 증가를 함께 한다 — "한 판을 끝까지 했다"는 사실
    // 자체가 plays의 정의다.
    submit(id, score, order = 'high') {
      // 점수가 유효할 때만 "한 판 했다"로 센다 — 원래도 NaN/Infinity 제출은
      // plays를 늘리지 않았다(records.test.js에 그 계약이 이미 있다).
      if (Number.isFinite(score)) storage.set(playKey(id), this.plays(id) + 1);
      return this._updateBest(id, score, order);
    },

    // 판이 끝나지 않은 채(메뉴로 나가기 등) 셸이 진행 상황만 기록할 때 쓴다.
    // 최고기록은 갱신될 수 있지만 plays는 절대 늘리지 않는다 — 끝까지 하지
    // 않은 시도를 "한 판 했다"로 세면 안 되기 때문이다. 언제 부를지(끝난
    // 판인지 중간에 나간 판인지) 판단은 shell/session.js가 한다.
    recordProgress(id, score, order = 'high') {
      return this._updateBest(id, score, order);
    },
  };

  return records;
}
