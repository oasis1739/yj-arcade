// 게임별 최고기록과 플레이 횟수.
export function createRecords(storage) {
  const bestKey = (id) => `best:${id}`;
  const playKey = (id) => `plays:${id}`;

  return {
    best(id) {
      const v = storage.get(bestKey(id), null);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },

    plays(id) {
      const v = storage.get(playKey(id), 0);
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    },

    submit(id, score, order = 'high') {
      const prev = this.best(id);
      if (!Number.isFinite(score)) return { best: prev, isNew: false };

      storage.set(playKey(id), this.plays(id) + 1);
      const isNew = prev === null || (order === 'low' ? score < prev : score > prev);
      if (isNew) storage.set(bestKey(id), score);
      return { best: isNew ? score : prev, isNew };
    },
  };
}
