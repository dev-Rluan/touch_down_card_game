// 벨 시간 보정 2단계: 네트워크 지연을 고려해 "실제로 누른 순서"로 판정한다.
//
// 1) 보정 시각
//    클라이언트는 손가락이 닿은 순간을 서버 시계 기준으로 환산해 pressedAt 으로 보낸다.
//    클라이언트 값은 조작될 수 있으므로, 서버가 직접 잰 그 사람의 편도 지연만큼만 앞당겨 인정한다.
//
//      보정 = min(편도 지연(RTT/2) + 여유 MARGIN, 상한 MAX_COMPENSATION)     ← 측정값이 없으면 0
//      보정시각 = min(도착시각, max(pressedAt, 도착시각 − 보정))
//
//    → 아무리 빠른 시각을 주장해도 "도착시각 − 보정"보다 앞설 수 없고, 미래 시각은 도착시각으로 자른다.
//
// 2) 모아서 판정
//    방마다 첫 누름이 도착하면 잠깐 기다렸다가 그동안 들어온 누름을 보정시각 순으로 판정한다.
//    기다리는 시간 = 첫 누름 보정시각 + 방에서 가장 큰 보정 − 첫 누름 도착시각 (0 ~ 보정 상한)
//    → 그 뒤에 도착한 누름은 최대 보정을 받아도 첫 누름보다 늦으므로 이미 끝난 판정을 뒤집지 못한다.
//      지연이 비슷한 사람끼리면 거의 기다리지 않는다.
const MAX_COMPENSATION_MS = 200;
const MARGIN_MS = 20;

function compensationFor(rtt) {
  return Number.isFinite(rtt) && rtt > 0 ? Math.min(rtt / 2 + MARGIN_MS, MAX_COMPENSATION_MS) : 0;
}

/** 첫 누름 뒤 기다릴 시간. roomMaxComp = 방 안 모든 사람 중 가장 큰 보정 */
function waitFor(press, roomMaxComp) {
  return Math.max(0, Math.min(press.effective + roomMaxComp - press.arrivedAt, MAX_COMPENSATION_MS));
}

// 테스트용 고정 창 (설정 안 하면 null → 누름마다 계산한 대기 시간)
function judgeWindowMs() {
  const v = Number(process.env.BELL_JUDGE_WINDOW_MS);
  return process.env.BELL_JUDGE_WINDOW_MS !== undefined && Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * @param {number} arrivedAt - 서버 도착 시각
 * @param {*} claimed - 클라이언트가 보낸 누른 시각 (서버 시계 기준, 신뢰하지 않음)
 * @param {number|null} rtt - 서버가 잰 그 플레이어의 왕복 지연
 * @returns {{effective: number, compensation: number}}
 */
function effectiveTime(arrivedAt, claimed, rtt) {
  const compensation = compensationFor(rtt);
  const c = Number.isFinite(claimed) ? claimed : arrivedAt;
  const effective = Math.min(arrivedAt, Math.max(c, arrivedAt - compensation));
  return { effective, compensation: Math.round(arrivedAt - effective) };
}

const batches = new Map(); // roomId -> { presses: [], done: Promise }

/**
 * 누름을 방의 판정 묶음에 넣는다. 묶음이 없으면 새로 열고 창이 닫히면 judge(presses) 를 한 번 호출한다.
 * @returns {Promise} 이 누름이 속한 묶음의 판정이 끝나면 resolve
 */
function enqueue(roomId, press, judge) {
  let batch = batches.get(roomId);
  if (!batch) {
    batch = { presses: [] };
    batch.done = new Promise(resolve => setTimeout(resolve, judgeWindowMs() ?? press.wait ?? MAX_COMPENSATION_MS))
      .then(() => {
        batches.delete(roomId);
        // 보정시각 순, 같으면 도착 순
        const ordered = [...batch.presses].sort((a, b) => a.effective - b.effective || a.arrivedAt - b.arrivedAt);
        return judge(ordered);
      });
    batches.set(roomId, batch);
  }
  // 같은 사람이 같은 묶음에 두 번 들어가지 않게 (쿨타임이 있어 보통은 없음)
  if (!batch.presses.some(p => p.playerId === press.playerId)) batch.presses.push(press);
  return batch.done;
}

/**
 * 지금 바닥을 보고 누른 벨의 하한: 바닥을 바꾼 카드가 깔린 시각 + 그 사람의 편도 지연.
 * 카드가 그 사람 화면에 도착하기 전에 눌렀다는 주장은 인정하지 않는다.
 * (지연을 부풀려 보정을 크게 받으려 하면, 이 하한도 그만큼 늦어진다)
 * @returns {number} 하한 시각 (적용할 것이 없으면 -Infinity)
 */
function currentBoardFloor(press, gameState) {
  if (!gameState || !gameState.lastPlayAt) return -Infinity;
  const oneWay = Number.isFinite(press.ping) && press.ping > 0 ? press.ping / 2 : 0;
  return gameState.lastPlayAt + oneWay;
}

// 사람이 카드를 보고 누르는 데 걸리는 시간보다 짧은 반응 (기록만 하고 판정은 바꾸지 않는다)
const SUSPICIOUS_REACTION_MS = 100;
const suspicious = new Map(); // playerId -> { name, count, fastest }
function noteReaction(press, name, gameState) {
  if (!gameState || !gameState.lastPlayAt) return null;
  const reaction = press.effective - currentBoardFloor(press, gameState);
  if (reaction >= SUSPICIOUS_REACTION_MS) return reaction;
  const s = suspicious.get(press.playerId) || { name, count: 0, fastest: Infinity };
  s.count++; s.fastest = Math.min(s.fastest, Math.round(reaction)); s.name = name;
  suspicious.set(press.playerId, s);
  if (suspicious.size > 1000) suspicious.delete(suspicious.keys().next().value);
  return reaction;
}
function suspiciousSummary() {
  return [...suspicious.values()].sort((a, b) => b.count - a.count).slice(0, 50);
}

/**
 * 직전 바닥으로 판정할지: 그 사람이 보고 누른 바닥이 마지막 카드가 깔리기 직전 바닥이고,
 * 보정시각이 그 카드가 깔린 시각보다 앞서며, 카드가 깔린 뒤 보정 상한 안에 도착한 경우만.
 */
function shouldUsePrevBoard(press, gameState) {
  if (!gameState || !Array.isArray(gameState.prevTopCards)) return false;
  if (!Number.isInteger(press.boardSeq) || press.boardSeq !== (gameState.boardSeq || 0) - 1) return false;
  const playedAt = gameState.lastPlayAt || 0;
  return press.effective < playedAt && press.arrivedAt - playedAt <= MAX_COMPENSATION_MS;
}

module.exports = { effectiveTime, compensationFor, waitFor, enqueue, shouldUsePrevBoard, currentBoardFloor, noteReaction, suspiciousSummary, SUSPICIOUS_REACTION_MS, MAX_COMPENSATION_MS, MARGIN_MS, judgeWindowMs, _batches: batches };
