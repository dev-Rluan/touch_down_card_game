/**
 * 방 단위 비동기 작업 직렬화 (in-process mutex)
 *
 * 방 상태는 Redis에서 읽고 → 수정하고 → 다시 쓰는 구조라서
 * 같은 방에 대한 요청(카드 내기, 벨, 준비, 퇴장 등)이 동시에 들어오면
 * 나중에 저장한 쪽이 앞선 변경을 덮어쓰는 lost update가 발생한다.
 * 같은 roomId에 대한 작업을 순서대로 실행해 이를 방지한다.
 *
 * 주의: 단일 Node 프로세스 기준이다. 여러 인스턴스로 확장할 경우
 * Redis 기반 분산 락으로 교체해야 한다.
 */

const queues = new Map(); // roomId -> 마지막 작업의 Promise

/**
 * roomId에 대해 fn을 직렬로 실행한다.
 * @template T
 * @param {string} roomId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function withRoomLock(roomId, fn) {
  if (!roomId) return fn();

  const prev = queues.get(roomId) || Promise.resolve();
  const run = prev.then(fn, fn);
  // 대기열 꼬리는 실패하더라도 다음 작업을 막지 않도록 에러를 삼킨다.
  const tail = run.catch(() => {});
  queues.set(roomId, tail);
  tail.then(() => {
    if (queues.get(roomId) === tail) queues.delete(roomId);
  });
  return run;
}

module.exports = { withRoomLock };
