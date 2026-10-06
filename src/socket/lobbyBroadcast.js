/**
 * 로비 방 목록 브로드캐스트 (디바운스)
 *
 * 방 생성/입장/퇴장/게임 시작·종료가 짧은 시간에 몰리면 매번 전체 방 목록을
 * 조회해 로비 전원에게 보내게 된다. 짧은 구간의 변경을 하나로 묶어
 * Redis 조회와 네트워크 전송을 줄인다.
 */
const roomService = require('../services/roomService');

const DEBOUNCE_MS = 150;
let timer = null;

function scheduleLobbyBroadcast(io) {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    try {
      const rooms = await roomService.getWaitingRoomSummaries();
      io.to('lobby').emit('roomList', rooms);
    } catch (error) {
      console.error('[lobbyBroadcast Error]', error);
    }
  }, DEBOUNCE_MS);
  if (timer.unref) timer.unref();
}

module.exports = { scheduleLobbyBroadcast };
