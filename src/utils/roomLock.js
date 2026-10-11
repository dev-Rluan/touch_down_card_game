// 방 단위 직렬화 락
// 방 상태는 Redis 에 JSON 통째로 저장하는 read-modify-write 구조라, 같은 방에 대한 요청이
// 동시에 처리되면 한쪽의 변경이 덮어써진다(lost update). 방 ID 별로 작업을 순서대로 실행해 막는다.
// 프로세스 내 락이므로 서버 인스턴스가 1개인 구성을 전제로 한다
// (Socket.IO Redis 어댑터가 없어 어차피 다중 인스턴스에서는 방 이벤트가 전달되지 않는다).
const tails = new Map(); // roomId -> 마지막 작업의 Promise

/**
 * @template T
 * @param {string} roomId
 * @param {() => Promise<T>} fn - 락을 잡은 상태에서 실행할 작업
 * @returns {Promise<T>}
 */
function withRoomLock(roomId, fn) {
  const key = String(roomId || '');
  const prev = tails.get(key) || Promise.resolve();
  // 앞선 작업이 실패해도 다음 작업은 실행되어야 한다
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.then(() => {
    // 뒤에 대기 중인 작업이 없으면 메모리 정리
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

module.exports = { withRoomLock, _pending: () => tails.size };
