// 벨 누른 순서 — 서버에 도착한 순서대로 기록해 방 전체에 보여준다.
//
// 첫 번째 누름부터 ROUND_WINDOW_MS 안에 들어온 누름을 한 "라운드"로 묶는다.
// 도착 시각(at)은 소켓 이벤트를 받은 직후(Redis 조회 등 await 전)에 잰 값이라
// 네트워크를 지나 서버에 먼저 닿은 사람이 앞 순서가 된다.
// 프로세스 메모리에 두므로 서버 인스턴스 1개 구성을 전제로 한다 (roomLock 과 같음).
const ROUND_WINDOW_MS = 1500;
const STALE_MS = 60 * 1000;

const rounds = new Map(); // roomId -> { id, firstAt, presses: [{ playerId, name, at }] }
let roundSeq = 0;

function sweep(now) {
  for (const [roomId, r] of rounds) {
    if (now - r.firstAt > STALE_MS) rounds.delete(roomId);
  }
}

/**
 * 벨 누름을 기록한다.
 * @param {string} roomId
 * @param {{id: string, name: string}} player
 * @param {number} at - 서버 도착 시각 (ms)
 * @param {{canStart: boolean, ping?: number|null}} opts - canStart: 새 라운드를 시작해도 되는지 (바닥에 카드가 없으면 시작하지 않는다),
 *   ping: 누른 사람의 현재 왕복 지연(ms) — 표시용
 * @returns {{round: number, rank: number, presses: Array<{rank, playerId, name, delta, ping}>}|null}
 *   기록했으면 현재까지의 순서, 기록하지 않았으면 null (같은 라운드에 이미 누름 / 시작 불가)
 */
function recordPress(roomId, player, at, { canStart, ping = null }) {
  let round = rounds.get(roomId);
  if (!round || at - round.firstAt > ROUND_WINDOW_MS) {
    if (!canStart) return null;
    sweep(at);
    round = { id: ++roundSeq, firstAt: at, presses: [] };
    rounds.set(roomId, round);
  }
  if (round.presses.some(p => p.playerId === player.id)) return null;

  // 도착 시각 순으로 끼워 넣는다 (처리 순서가 도착 순서와 다를 경우 대비)
  const entry = { playerId: player.id, name: player.name, at: Math.max(at, round.firstAt), ping: ping ?? null };
  const idx = round.presses.findIndex(p => p.at > entry.at);
  if (idx === -1) round.presses.push(entry); else round.presses.splice(idx, 0, entry);

  return {
    round: round.id,
    rank: round.presses.indexOf(entry) + 1,
    presses: round.presses.map((p, i) => ({ rank: i + 1, playerId: p.playerId, name: p.name, delta: p.at - round.firstAt, ping: p.ping })),
  };
}

function clearRound(roomId) {
  rounds.delete(roomId);
}

module.exports = { recordPress, clearRound, ROUND_WINDOW_MS, _rounds: rounds };
