// 소켓 핸들러(ready / playCard / halliGalli)를 가짜 소켓 + 메모리 Redis 로 실행해
// 이벤트 내용, 저장된 상태, Redis 명령 수를 검증한다.

// 벨 판정 대기 창(보정용 100ms)은 이 파일에서는 0 으로 — 대기 창 자체는 아래 '벨 시간 보정' 테스트에서 따로 검증
process.env.BELL_JUDGE_WINDOW_MS = '0';

// ── 메모리 Redis (명령 호출 기록 포함) ─────────────────────────────────────────
const mockStore = { kv: new Map(), hash: new Map(), set: new Map() };
const mockCalls = [];
const mockRedis = {};
const mockTrack = (name, fn) => {
  mockRedis[name] = async (...args) => { mockCalls.push(name); return fn(...args); };
};
mockTrack('get', (k) => (mockStore.kv.has(k) ? mockStore.kv.get(k) : null));
mockTrack('set', (k, v) => { mockStore.kv.set(k, v); return 'OK'; });
mockTrack('del', (k) => { const keys = Array.isArray(k) ? k : [k]; let n = 0; keys.forEach(x => { n += +mockStore.kv.delete(x) + +mockStore.hash.delete(x) + +mockStore.set.delete(x); }); return n; });
mockTrack('exists', (k) => +(mockStore.kv.has(k) || mockStore.hash.has(k)));
mockTrack('hGet', (k, f) => (mockStore.hash.get(k) || {})[f] ?? null);
mockTrack('hSet', (k, f, v) => { const h = mockStore.hash.get(k) || {}; if (typeof f === 'object') Object.assign(h, f); else h[f] = v; mockStore.hash.set(k, h); return 1; });
mockTrack('hDel', (k, f) => { const h = mockStore.hash.get(k) || {}; delete h[f]; return 1; });
mockTrack('hGetAll', (k) => mockStore.hash.get(k) || {});
mockTrack('sAdd', (k, m) => { const s = mockStore.set.get(k) || new Set(); s.add(m); mockStore.set.set(k, s); return 1; });
mockTrack('sRem', (k, m) => { (mockStore.set.get(k) || new Set()).delete(m); return 1; });
mockTrack('sMembers', (k) => [...(mockStore.set.get(k) || [])]);
mockTrack('mGet', (keys) => keys.map(k => (mockStore.kv.has(k) ? mockStore.kv.get(k) : null)));

jest.mock('../../config/redisClient', () => ({
  ensureRedisConnection: jest.fn(() => Promise.resolve(mockRedis)),
}));

const userService = require('../../services/userServices');
const roomService = require('../../services/roomService');
const gameService = require('../../services/gameService');
const registerGameEvents = require('../../socket/gameEvents');
const registerRoomEvents = require('../../socket/roomEvents');

// ── 가짜 소켓/io ──────────────────────────────────────────────────────────────
function makeIo() {
  const emitted = [];
  return {
    emitted,
    to: (target) => ({ emit: (event, payload) => emitted.push({ to: target, event, payload }) }),
    sockets: { sockets: new Map() },
  };
}
function makeSocket(id, io) {
  const handlers = {};
  const own = [];
  const socket = {
    id,
    on: (ev, fn) => { handlers[ev] = fn; },
    emit: (event, payload) => own.push({ event, payload }),
    to: (target) => ({ emit: (event, payload) => io.emitted.push({ to: target, event, payload, from: id }) }),
    join: () => {},
    leave: () => {},
    own,
    fire: (ev, ...args) => handlers[ev](...args),
  };
  registerGameEvents(socket, io);
  registerRoomEvents(socket, io);
  return socket;
}

// 2~6명이 입장한 방을 만들고 게임을 시작한다
async function setupGame(playerCount = 2) {
  const io = makeIo();
  const ids = Array.from({ length: playerCount }, (_, i) => `sock${i}`);
  const sockets = [];
  for (const id of ids) {
    await userService.connectUser(id, `이름-${id}`);
    sockets.push(makeSocket(id, io));
  }
  const room = await roomService.createRoom(ids[0], `테스트방-${Math.random()}`, playerCount);
  for (const id of ids.slice(1)) await roomService.joinRoom(id, room.id);
  await gameService.startGame(room.id);
  const byId = Object.fromEntries(sockets.map(s => [s.id, s]));
  const load = () => roomService.getRoomById(room.id);
  return { io, sockets, byId, roomId: room.id, load };
}
const resetCalls = () => { mockCalls.length = 0; };

const { limiters } = require('../../utils/socketRateLimiter');

beforeEach(() => {
  mockStore.kv.clear(); mockStore.hash.clear(); mockStore.set.clear(); resetCalls();
  // 속도 제한기는 프로세스 전역 상태이므로 테스트 간에 격리한다
  ['sock0', 'sock1', 'sock2', 'sock3', 'a', 'b', 'x', 'y', 'lonely'].forEach(id =>
    Object.values(limiters).forEach(l => l.reset(id)));
});

describe('playCard 핸들러', () => {
  test('카드를 내면 cardPlayed/yourHand 가 전송되고 턴이 넘어가며 상태가 저장된다', async () => {
    const { io, byId, roomId, load } = await setupGame(3);
    const before = await load();
    const turnIdx = before.gameState.currentTurn;
    const player = before.users[turnIdx];
    const expectedCard = player.cardPack[0];
    io.emitted.length = 0;

    await byId[player.id].fire('playCard', 0);

    const played = io.emitted.find(e => e.event === 'cardPlayed');
    expect(played.to).toBe(roomId);
    expect(played.payload.playerId).toBe(player.id);
    expect(played.payload.playerName).toBe(player.name);
    expect(played.payload.result.playedCard).toEqual(expectedCard);
    expect(played.payload.result.playerCardCount).toBe(player.cardPack.length - 1);

    const after = await load();
    expect(after.users[turnIdx].cardPack).toHaveLength(player.cardPack.length - 1);
    expect(after.gameState.centerCards.at(-1)).toEqual(expectedCard);
    expect(after.gameState.currentTurn).toBe(played.payload.result.nextTurn);
    expect(after.gameState.currentTurn).not.toBe(turnIdx);

    // 모든 플레이어에게 자기 손패 전송
    const hands = io.emitted.filter(e => e.event === 'yourHand');
    expect(hands.map(h => h.to).sort()).toEqual(after.users.map(u => u.id).sort());
    hands.forEach(h => expect(h.payload).toEqual({ count: after.users.find(u => u.id === h.to).cardPack.length }));
    // 카드 내용(다음에 나올 카드)은 보내지 않는다
    hands.forEach(h => expect(h.payload).not.toHaveProperty('cards'));
    expect(io.emitted.find(e => e.event === 'gameEnd')).toBeUndefined();
  });

  test('카드 1장을 내는 데 필요한 Redis 명령은 3개(방ID 조회, 방 읽기, 방 저장)뿐이다', async () => {
    const { byId, load } = await setupGame(2);
    const room = await load();
    resetCalls();
    await byId[room.users[room.gameState.currentTurn].id].fire('playCard', 0);
    expect(mockCalls).toEqual(['hGet', 'get', 'set']);
  });

  test('내 턴이 아니면 playCardError 이고 아무것도 저장하지 않는다', async () => {
    const { io, byId, load } = await setupGame(2);
    const room = await load();
    const other = room.users[(room.gameState.currentTurn + 1) % 2];
    const snapshot = JSON.stringify(room);
    resetCalls(); io.emitted.length = 0;

    await byId[other.id].fire('playCard', 0);

    expect(byId[other.id].own.at(-1)).toEqual({ event: 'playCardError', payload: '당신의 턴이 아닙니다.' });
    expect(mockCalls).not.toContain('set');
    expect(JSON.stringify(await load())).toBe(snapshot);
    expect(io.emitted).toHaveLength(0);
  });

  test('방에 없으면 playCardError', async () => {
    const io = makeIo();
    await userService.connectUser('lonely', '혼자');
    const s = makeSocket('lonely', io);
    await s.fire('playCard', 0);
    expect(s.own.at(-1)).toEqual({ event: 'playCardError', payload: '참여 중인 방이 없습니다.' });
  });

  test('마지막 카드를 내서 게임이 끝나면 gameEnd 가 전송되고 방이 대기 상태로 돌아간다', async () => {
    const { io, byId, roomId, load } = await setupGame(2);
    const room = await load();
    const cur = room.gameState.currentTurn;
    // 현재 플레이어 1장, 상대 1장만 남긴다 → 내고 나면 상대만 카드를 가짐
    room.users[cur].cardPack = room.users[cur].cardPack.slice(0, 1);
    room.users[1 - cur].cardPack = room.users[1 - cur].cardPack.slice(0, 1);
    await roomService.saveRoomState(room);
    io.emitted.length = 0;

    await byId[room.users[cur].id].fire('playCard', 0);

    const end = io.emitted.find(e => e.event === 'gameEnd');
    expect(end).toBeDefined();
    expect(end.payload.isEnded).toBe(true);
    expect(end.payload.winner.id).toBe(room.users[1 - cur].id);
    expect(end.payload.finalScores).toHaveLength(2);

    const after = await load();
    expect(after.status).toBe('waiting');
    expect(after.users.every(u => u.readyStatus === 'waiting')).toBe(true);
    // 종료 시에는 대기 방 목록에 다시 등록되어야 한다
    expect(await mockRedis.sMembers('rooms:waiting')).toContain(roomId);
  });

  test('게임 중에는 방이 대기 목록에 없고 이름 색인은 유지된다', async () => {
    const { byId, roomId, load } = await setupGame(2);
    const room = await load();
    await byId[room.users[room.gameState.currentTurn].id].fire('playCard', 0);
    expect(await mockRedis.sMembers('rooms:waiting')).not.toContain(roomId);
    expect(await mockRedis.hGet('rooms:name:index', room.name)).toBe(roomId);
  });
});

describe('halliGalli 핸들러', () => {
  async function gameWithStacks(stacks) {
    const g = await setupGame(2);
    const room = await g.load();
    room.gameState.playerStacks = { [room.users[0].id]: [stacks[0]], [room.users[1].id]: [stacks[1]] };
    room.gameState.centerCards = [stacks[0], stacks[1]];
    await roomService.saveRoomState(room);
    return { ...g, room };
  }

  test('같은 과일이 5개면 성공: 점수/카드 획득, halliGalliResult + gameState 전송', async () => {
    const { io, byId, room, load } = await gameWithStacks([{ fruit: 'banana', count: 2 }, { fruit: 'banana', count: 3 }]);
    const winner = room.users[0];
    const handBefore = winner.cardPack.length;
    io.emitted.length = 0; resetCalls();

    await byId[winner.id].fire('halliGalli');

    const result = io.emitted.find(e => e.event === 'halliGalliResult');
    expect(result.payload).toMatchObject({ playerId: winner.id, success: true, scoreGained: 2 });
    const after = await load();
    expect(after.users[0].cardPack).toHaveLength(handBefore + 2);
    expect(after.users[0].score).toBe(2);
    expect(after.gameState.centerCards).toEqual([]);
    expect(Object.values(after.gameState.playerStacks).every(s => s.length === 0)).toBe(true);

    const gs = io.emitted.find(e => e.event === 'gameState');
    expect(gs).toBeDefined();
    expect(gs.payload.centerCount).toBe(0);
    expect(gs.payload).not.toHaveProperty('centerCards');
    expect(gs.payload.players.find(p => p.id === winner.id).cardCount).toBe(handBefore + 2);
    // 결과가 gameState 보다 먼저 전송된다 (클라이언트 처리 순서)
    expect(io.emitted.findIndex(e => e.event === 'halliGalliResult')).toBeLessThan(io.emitted.findIndex(e => e.event === 'gameState'));
  });

  test('실패하면 덱 맨 아래 카드 1장을 버림 더미로 보낸다', async () => {
    const { io, byId, room, load } = await gameWithStacks([{ fruit: 'banana', count: 1 }, { fruit: 'lemon', count: 2 }]);
    const p = room.users[1];
    const bottom = p.cardPack[p.cardPack.length - 1];
    io.emitted.length = 0;

    await byId[p.id].fire('halliGalli');

    const result = io.emitted.find(e => e.event === 'halliGalliResult').payload;
    expect(result.success).toBe(false);
    // 버림 더미는 뒤집어 놓은 카드: 내용은 보내지 않고 장수만 보낸다
    expect(result).not.toHaveProperty('discardedCard');
    expect(result).not.toHaveProperty('discardedCards');
    expect(result.discardedCount).toBe(1);
    const after = await load();
    expect(after.users[1].cardPack).toHaveLength(p.cardPack.length - 1);
    expect(after.gameState.discardedCards).toEqual([bottom]); // 서버에는 그대로 저장
    const gs = io.emitted.find(e => e.event === 'gameState').payload;
    expect(gs.discardedCount).toBe(1);
    expect(gs).not.toHaveProperty('discardedCards');
  });

  test('벨 성공 후 각자의 손패(yourHand)가 최신으로 다시 전송된다', async () => {
    const { io, byId, room, load } = await gameWithStacks([{ fruit: 'banana', count: 2 }, { fruit: 'banana', count: 3 }]);
    const winner = room.users[0];
    io.emitted.length = 0;
    await byId[winner.id].fire('halliGalli');
    const after = await load();
    const hands = io.emitted.filter(e => e.event === 'yourHand');
    expect(hands.map(h => h.to).sort()).toEqual(after.users.map(u => u.id).sort());
    hands.forEach(h => expect(h.payload.count).toBe(after.users.find(u => u.id === h.to).cardPack.length));
    expect(hands.find(h => h.to === winner.id).payload.count).toBe(room.users[0].cardPack.length + 2);
  });

  test('벨 실패 후에도 손패가 다시 전송된다 (버린 1장이 반영)', async () => {
    const { io, byId, room } = await gameWithStacks([{ fruit: 'banana', count: 1 }, { fruit: 'lemon', count: 2 }]);
    const p = room.users[1];
    io.emitted.length = 0;
    await byId[p.id].fire('halliGalli');
    const mine = io.emitted.filter(e => e.event === 'yourHand').find(h => h.to === p.id);
    expect(mine.payload.count).toBe(p.cardPack.length - 1);
  });

  test('벨 처리에 필요한 Redis 명령은 3개(방ID 조회, 방 읽기, 방 저장)뿐이다', async () => {
    const { byId, room } = await gameWithStacks([{ fruit: 'banana', count: 2 }, { fruit: 'banana', count: 3 }]);
    resetCalls();
    await byId[room.users[0].id].fire('halliGalli');
    expect(mockCalls).toEqual(['hGet', 'get', 'set']);
  });

  test('카드가 하나도 없을 때의 벨은 halliGalliError', async () => {
    const { byId, room } = await setupGame(2).then(async g => ({ ...g, room: await g.load() }));
    await byId[room.users[0].id].fire('halliGalli');
    expect(byId[room.users[0].id].own.at(-1)).toEqual({ event: 'halliGalliError', payload: '아직 카드가 없습니다.' });
  });
});

describe('방 만들기: 인원과 비공개', () => {
  test('6명까지 만들 수 있고 7명은 거절한다', async () => {
    await userService.connectUser('m6', 'M6'); await userService.connectUser('m7', 'M7');
    expect((await roomService.createRoom('m6', '여섯명방', 6)).maxUserCnt).toBe(6);
    await expect(roomService.createRoom('m7', '일곱명방', 7)).rejects.toThrow('6명 이하');
  });

  test('비공개 방은 목록에 안 나오지만 방 ID(초대 링크)로 들어갈 수 있다', async () => {
    const io = makeIo();
    await userService.connectUser('p1', 'P1'); await userService.connectUser('p2', 'P2');
    const host = makeSocket('p1', io); const guest = makeSocket('p2', io);
    await host.fire('createRoom', '비밀방', 4, true);
    const created = host.own.find(e => e.event === 'roomCreated').payload;
    expect(created.private).toBe(true);
    const list = io.emitted.filter(e => e.event === 'roomList').at(-1).payload;
    expect(list.some(r => r.id === created.id)).toBe(false);
    await guest.fire('joinRoom', created.id);
    expect((await roomService.getRoomById(created.id)).users.map(u => u.id)).toEqual(['p1', 'p2']);
  });
});

describe('ready 핸들러', () => {
  test('준비 상태를 토글하고 updateReadyStatus 를 보낸다 (Redis 명령 3개)', async () => {
    const io = makeIo();
    await userService.connectUser('a', 'A'); await userService.connectUser('b', 'B');
    const a = makeSocket('a', io); makeSocket('b', io);
    const room = await roomService.createRoom('a', '준비방', 2);
    await roomService.joinRoom('b', room.id);
    io.emitted.length = 0; resetCalls();

    await a.fire('ready');

    const upd = io.emitted.find(e => e.event === 'updateReadyStatus');
    expect(upd.payload.find(u => u.id === 'a').readyStatus).toBe('ready');
    expect(mockCalls).toEqual(['hGet', 'get', 'set']);

    await a.fire('ready');
    const upd2 = io.emitted.filter(e => e.event === 'updateReadyStatus').at(-1);
    expect(upd2.payload.find(u => u.id === 'a').readyStatus).toBe('waiting');
  });

  test('방에 없으면 readyError', async () => {
    const io = makeIo();
    await userService.connectUser('x', 'X');
    const s = makeSocket('x', io);
    await s.fire('ready');
    expect(s.own.at(-1)).toEqual({ event: 'readyError', payload: '참여 중인 방이 없습니다.' });
  });
});

describe('정보 비공개 (숨겨진 카드가 클라이언트로 새지 않는다)', () => {
  const secretKeys = /"cardPack"|"discardedCards"|"discardedCard"/;
  const leaks = (io, { exceptEvents = [] } = {}) =>
    io.emitted.filter(e => !exceptEvents.includes(e.event) && secretKeys.test(JSON.stringify(e.payload)));

  test('게임 중 ready 는 거부되고 다른 플레이어의 손패가 전송되지 않는다', async () => {
    const { io, byId, load } = await setupGame(3);
    const room = await load();
    const statusBefore = room.users.map(u => u.readyStatus);
    io.emitted.length = 0;

    await byId[room.users[1].id].fire('ready');

    expect(byId[room.users[1].id].own.at(-1)).toEqual({ event: 'readyError', payload: '게임이 진행 중입니다.' });
    expect(io.emitted).toHaveLength(0);
    expect((await load()).users.map(u => u.readyStatus)).toEqual(statusBefore);
  });

  test('게임 중 누군가 나가도 남은 사람들에게 가는 leaveUser 에 손패가 없다', async () => {
    const { io, byId, roomId, load } = await setupGame(3);
    const room = await load();
    io.emitted.length = 0;

    await byId[room.users[1].id].fire('leaveRoom', roomId);

    const leave = io.emitted.find(e => e.event === 'leaveUser');
    expect(leave).toBeDefined();
    expect(leave.payload.users.every(u => typeof u.cardCount === 'number')).toBe(true);
    expect(leaks(io)).toEqual([]);
  });

  test('방 생성/입장/목록 이벤트에 손패·게임 상태가 없다', async () => {
    const io = makeIo();
    for (const id of ['x', 'y']) await userService.connectUser(id, id);
    const x = makeSocket('x', io), y = makeSocket('y', io);
    await x.fire('createRoom', '공개방', 2);
    const rooms = io.emitted.filter(e => e.event === 'roomList');
    expect(rooms.length).toBeGreaterThan(0);
    const created = x.own.find(e => e.event === 'roomCreated');
    await y.fire('joinRoom', created.payload.id);
    expect(Object.keys(created.payload).sort()).toEqual(['id', 'maxUserCnt', 'name', 'private', 'status', 'users']);
    expect(leaks(io)).toEqual([]);
    expect(y.own.filter(e => secretKeys.test(JSON.stringify(e.payload)))).toEqual([]);
  });

  test('카드 내기/벨/종료까지 한 판 동안 yourHand 외에는 손패가 전송되지 않는다', async () => {
    const { io, byId, load } = await setupGame(2);
    io.emitted.length = 0;
    for (let i = 0; i < 6; i++) {
      const room = await load();
      if (room.status !== 'playing') break;
      await byId[room.users[room.gameState.currentTurn].id].fire('playCard', 0);
    }
    expect(leaks(io, { exceptEvents: ['yourHand'] })).toEqual([]);
    // yourHand 는 각 플레이어 본인에게만 간다
    io.emitted.filter(e => e.event === 'yourHand').forEach(e => expect(e.to).toMatch(/^sock\d$/));
  });
});

describe('게임 중 퇴장 (차례/종료 처리)', () => {
  // 현재 차례를 원하는 위치로 맞춰 저장한다
  async function withTurn(g, turn) {
    const room = await g.load();
    room.gameState.currentTurn = turn;
    await roomService.saveRoomState(room);
    return room;
  }
  const lastState = (io) => io.emitted.filter(e => e.event === 'gameState').at(-1)?.payload;
  const turnHolderId = (gs) => gs.players[gs.currentTurn].id;

  test('차례인 사람이 나가면 다음 사람이 차례를 이어받고 최신 gameState 가 전송된다', async () => {
    const g = await setupGame(4);
    const room = await withTurn(g, 1);
    const leaver = room.users[1].id, next = room.users[2].id;
    g.io.emitted.length = 0;

    await g.byId[leaver].fire('leaveRoom', g.roomId);

    const gs = lastState(g.io);
    expect(gs).toBeDefined();
    expect(gs.players).toHaveLength(3);
    expect(gs.players.map(p => p.id)).not.toContain(leaver);
    expect(turnHolderId(gs)).toBe(next);
  });

  test('앞 순번 사람이 나가도 같은 사람이 계속 차례를 가진다', async () => {
    const g = await setupGame(4);
    const room = await withTurn(g, 2);
    const holder = room.users[2].id;
    g.io.emitted.length = 0;

    await g.byId[room.users[0].id].fire('leaveRoom', g.roomId);

    expect(turnHolderId(lastState(g.io))).toBe(holder);
    expect((await g.load()).gameState.currentTurn).toBe(1); // 한 칸 당겨짐
  });

  test('마지막 순번인 사람이 나가면 처음 사람에게 차례가 돌아간다', async () => {
    const g = await setupGame(4);
    const room = await withTurn(g, 3);
    g.io.emitted.length = 0;

    await g.byId[room.users[3].id].fire('leaveRoom', g.roomId);

    expect(turnHolderId(lastState(g.io))).toBe(room.users[0].id);
  });

  test('뒤 순번 사람이 나가면 차례는 그대로다', async () => {
    const g = await setupGame(4);
    const room = await withTurn(g, 0);
    g.io.emitted.length = 0;

    await g.byId[room.users[3].id].fire('leaveRoom', g.roomId);

    expect(turnHolderId(lastState(g.io))).toBe(room.users[0].id);
  });

  test('나간 뒤 남은 사람이 실제로 카드를 낼 수 있다 (교착 없음)', async () => {
    const g = await setupGame(4);
    const room = await withTurn(g, 1);
    await g.byId[room.users[1].id].fire('leaveRoom', g.roomId);
    const nextId = room.users[2].id;
    g.io.emitted.length = 0;

    await g.byId[nextId].fire('playCard', 0);

    expect(g.byId[nextId].own.filter(e => e.event === 'playCardError')).toEqual([]);
    expect(g.io.emitted.find(e => e.event === 'cardPlayed').payload.playerId).toBe(nextId);
  });

  test('2명이 하다 한 명이 나가면 남은 사람이 승자로 게임이 종료된다', async () => {
    const g = await setupGame(2);
    const room = await g.load();
    g.io.emitted.length = 0;

    await g.byId[room.users[0].id].fire('leaveRoom', g.roomId);

    const end = g.io.emitted.find(e => e.event === 'gameEnd');
    expect(end).toBeDefined();
    expect(end.payload.winner.id).toBe(room.users[1].id);
    const after = await g.load();
    expect(after.status).toBe('waiting');
    expect(await mockRedis.sMembers('rooms:waiting')).toContain(g.roomId);
  });

  test('퇴장자의 바닥 카드 더미는 벨 판정에서 빠진다', async () => {
    const g = await setupGame(3);
    const room = await g.load();
    const [a, b, c] = room.users.map(u => u.id);
    // a 의 더미에 banana 3 이 있어 b 의 banana 2 와 합치면 5 가 되는 상황
    room.gameState.playerStacks = { [a]: [{ fruit: 'banana', count: 3 }], [b]: [{ fruit: 'banana', count: 2 }], [c]: [] };
    room.gameState.centerCards = [{ fruit: 'banana', count: 3 }, { fruit: 'banana', count: 2 }];
    room.gameState.currentTurn = 1;
    await roomService.saveRoomState(room);

    await g.byId[a].fire('leaveRoom', g.roomId);
    const after = await g.load();
    expect(after.gameState.playerStacks[a]).toBeUndefined();

    g.io.emitted.length = 0;
    await g.byId[b].fire('halliGalli');
    expect(g.io.emitted.find(e => e.event === 'halliGalliResult').payload.success).toBe(false); // 나간 사람의 3 은 더 이상 합쳐지지 않음
  });

  test('대기실에서 나가는 것은 게임 상태 이벤트를 만들지 않는다', async () => {
    const io = makeIo();
    for (const id of ['w1', 'w2']) await userService.connectUser(id, id);
    const w1 = makeSocket('w1', io), w2 = makeSocket('w2', io);
    const room = await roomService.createRoom('w1', '대기방', 2);
    await roomService.joinRoom('w2', room.id);
    io.emitted.length = 0;
    await w2.fire('leaveRoom', room.id);
    expect(io.emitted.find(e => e.event === 'gameState' || e.event === 'gameEnd')).toBeUndefined();
    expect(io.emitted.find(e => e.event === 'leaveUser')).toBeDefined();
    void w1;
  });
});

describe('공정성/종료 처리 보강', () => {
  test('cardPlayed 에 벨 정답(isHalliGalli)과 중앙 카드 목록이 없다 (장수만)', async () => {
    const g = await setupGame(2);
    const room = await g.load();
    g.io.emitted.length = 0;
    await g.byId[room.users[room.gameState.currentTurn].id].fire('playCard', 0);
    const played = g.io.emitted.find(e => e.event === 'cardPlayed').payload;
    expect(played.result).not.toHaveProperty('isHalliGalli');
    expect(played.result).not.toHaveProperty('centerCards');
    expect(played.result.centerCount).toBe(1);
    expect(Object.keys(played.result).sort()).toEqual(['boardSeq', 'centerCount', 'nextTurn', 'playedCard', 'playerCardCount']);
  });

  test('벨 결과에도 중앙 카드 목록 대신 장수만 간다', async () => {
    const g = await setupGame(2);
    const room = await g.load();
    room.gameState.playerStacks = { [room.users[0].id]: [{ fruit: 'banana', count: 1 }], [room.users[1].id]: [{ fruit: 'lemon', count: 2 }] };
    room.gameState.centerCards = [{ fruit: 'banana', count: 1 }, { fruit: 'lemon', count: 2 }];
    await roomService.saveRoomState(room);
    g.io.emitted.length = 0;
    await g.byId[room.users[0].id].fire('halliGalli');
    const r = g.io.emitted.find(e => e.event === 'halliGalliResult').payload;
    expect(r).not.toHaveProperty('centerCards');
    expect(r.centerCount).toBe(2);
  });

  test('끝난 게임에서는 카드를 낼 수 없고 상태가 바뀌지 않는다', async () => {
    const g = await setupGame(2);
    const room = await g.load();
    const cur = room.gameState.currentTurn;
    room.users[cur].cardPack = room.users[cur].cardPack.slice(0, 1);
    room.users[1 - cur].cardPack = room.users[1 - cur].cardPack.slice(0, 2);
    await roomService.saveRoomState(room);
    await g.byId[room.users[cur].id].fire('playCard', 0); // 마지막 카드 → 게임 종료
    const ended = await g.load();
    expect(ended.status).toBe('waiting');
    const snapshot = JSON.stringify(ended);
    g.io.emitted.length = 0;

    const other = g.byId[room.users[1 - cur].id];
    await other.fire('playCard', 0);

    expect(other.own.at(-1)).toEqual({ event: 'playCardError', payload: '게임이 진행 중이 아닙니다.' });
    expect(g.io.emitted.find(e => e.event === 'cardPlayed' || e.event === 'gameEnd')).toBeUndefined();
    expect(JSON.stringify(await g.load())).toBe(snapshot);
  });

  test('벨 실패로 마지막 카드를 잃어 카드가 있는 사람이 1명이 되면 바로 게임이 끝난다', async () => {
    const g = await setupGame(2);
    const room = await g.load();
    const [a, b] = room.users;
    a.cardPack = a.cardPack.slice(0, 1);          // a 는 1장만 남음
    room.gameState.playerStacks = { [a.id]: [{ fruit: 'banana', count: 1 }], [b.id]: [{ fruit: 'lemon', count: 2 }] };
    room.gameState.centerCards = [{ fruit: 'banana', count: 1 }, { fruit: 'lemon', count: 2 }];
    await roomService.saveRoomState(room);
    g.io.emitted.length = 0;

    await g.byId[a.id].fire('halliGalli'); // 합 5 아님 → 실패 → 마지막 1장 버림

    expect(g.io.emitted.find(e => e.event === 'halliGalliResult').payload.success).toBe(false);
    const end = g.io.emitted.find(e => e.event === 'gameEnd');
    expect(end).toBeDefined();
    expect(end.payload.winner.id).toBe(b.id);
    expect((await g.load()).status).toBe('waiting');
  });

  test('게임이 끝나면 로비에 갱신된 방 목록이 방송된다 (끝난 방이 다시 보임)', async () => {
    const g = await setupGame(2);
    const room = await g.load();
    const cur = room.gameState.currentTurn;
    room.users[cur].cardPack = room.users[cur].cardPack.slice(0, 1);
    room.users[1 - cur].cardPack = room.users[1 - cur].cardPack.slice(0, 1);
    await roomService.saveRoomState(room);
    g.io.emitted.length = 0;

    await g.byId[room.users[cur].id].fire('playCard', 0);

    const lobby = g.io.emitted.filter(e => e.event === 'roomList' && e.to === 'lobby');
    expect(lobby.length).toBeGreaterThan(0);
    expect(lobby.at(-1).payload.map(r => r.id)).toContain(g.roomId);
    // 게임 종료 이벤트 다음에 방송된다
    expect(g.io.emitted.findIndex(e => e.event === 'gameEnd')).toBeLessThan(g.io.emitted.findIndex(e => e.event === 'roomList'));
  });
});

describe('3인 이상: 카드를 모두 잃은 플레이어는 탈락', () => {
  async function threeWithEliminated() {
    const g = await setupGame(3);
    const room = await g.load();
    const [a, b, c] = room.users;
    a.cardPack = [];                                   // a 는 카드를 모두 잃음
    room.gameState.playerStacks = { [a.id]: [{ fruit: 'banana', count: 3 }], [b.id]: [{ fruit: 'banana', count: 2 }], [c.id]: [] };
    room.gameState.centerCards = [{ fruit: 'banana', count: 3 }, { fruit: 'banana', count: 2 }];
    room.gameState.currentTurn = 1;
    await roomService.saveRoomState(room);
    return { ...g, a, b, c };
  }

  test('탈락한 플레이어는 벨을 눌러도 카드를 가져가 부활하지 못한다', async () => {
    const g = await threeWithEliminated();
    g.io.emitted.length = 0;
    await g.byId[g.a.id].fire('halliGalli');
    expect(g.io.emitted.find(e => e.event === 'halliGalliResult')).toBeUndefined();
    expect(g.byId[g.a.id].own.at(-1)).toEqual({ event: 'halliGalliError', payload: '카드를 모두 잃어 탈락했습니다.' });
    const after = await g.load();
    expect(after.users[0].cardPack).toHaveLength(0);
    expect(after.gameState.centerCards).toHaveLength(2); // 판 그대로 → 남은 사람이 가져갈 수 있다
  });

  test('탈락한 플레이어의 차례는 건너뛰고 게임은 남은 2명으로 계속된다', async () => {
    const g = await threeWithEliminated();
    const room = await g.load();
    room.gameState.currentTurn = 2;
    await roomService.saveRoomState(room);
    g.io.emitted.length = 0;
    await g.byId[g.c.id].fire('playCard', 0);
    const played = g.io.emitted.find(e => e.event === 'cardPlayed').payload;
    expect(played.result.nextTurn).toBe(1); // a(0) 를 건너뛰고 b(1)
    expect(g.io.emitted.find(e => e.event === 'gameEnd')).toBeUndefined();
  });
});

describe('벨 내부 쿨타임 / 누른 순서', () => {
  const bellOrder = require('../../utils/bellOrder');

  async function threeWithFive() {
    const g = await setupGame(3);
    const room = await g.load();
    const [a, b, c] = room.users;
    room.gameState.playerStacks = { [a.id]: [{ fruit: 'banana', count: 3 }], [b.id]: [{ fruit: 'banana', count: 2 }], [c.id]: [] };
    room.gameState.centerCards = [{ fruit: 'banana', count: 3 }, { fruit: 'banana', count: 2 }];
    await roomService.saveRoomState(room);
    return { ...g, a, b, c };
  }

  test('같은 사람이 1초 안에 다시 누르면 거부되고 판정하지 않는다', async () => {
    const g = await threeWithFive();
    const room = await g.load();
    room.gameState.playerStacks[g.a.id] = [{ fruit: 'lemon', count: 1 }]; // 실패 상황
    await roomService.saveRoomState(room);
    await g.byId[g.b.id].fire('halliGalli');
    g.io.emitted.length = 0;
    await g.byId[g.b.id].fire('halliGalli');
    expect(g.byId[g.b.id].own.at(-1)).toEqual({ event: 'halliGalliError', payload: '벨은 1초에 한 번만 누를 수 있습니다.' });
    expect(g.io.emitted.find(e => e.event === 'halliGalliResult')).toBeUndefined();
    expect((await g.load()).users[1].cardPack).toHaveLength(room.users[1].cardPack.length - 1); // 1장만 잃음
  });

  test('누른 순서가 서버 도착 순으로 방 전체에 전송되고, 늦게 누른 사람은 판정 없이 "늦었음"', async () => {
    const g = await threeWithFive();
    g.io.emitted.length = 0;
    // 동시에 누름: c → a 순서로 서버에 도착
    await Promise.all([g.byId[g.c.id].fire('halliGalli'), g.byId[g.a.id].fire('halliGalli')]);

    const orders = g.io.emitted.filter(e => e.event === 'bellOrder');
    expect(orders.map(o => o.to)).toEqual([g.roomId, g.roomId]);
    expect(orders.at(-1).payload.presses.map(p => [p.rank, p.playerId])).toEqual([[1, g.c.id], [2, g.a.id]]);
    expect(orders.at(-1).payload.presses[0].delta).toBe(0);
    expect(orders[0].payload.round).toBe(orders[1].payload.round);

    const results = g.io.emitted.filter(e => e.event === 'halliGalliResult');
    expect(results).toHaveLength(1);
    expect(results[0].payload).toMatchObject({ playerId: g.c.id, success: true });
    expect(g.byId[g.a.id].own.at(-1)).toEqual({ event: 'halliGalliError', payload: '한 발 늦었어요!' });
    const after = await g.load();
    expect(after.users[0].cardPack).toHaveLength(g.a.cardPack.length); // 늦은 사람은 벌칙 없음
  });

  test('탈락자와 빈 바닥의 누름은 순서에 들어가지 않는다', async () => {
    const g = await setupGame(3);
    g.io.emitted.length = 0;
    const room = await g.load();
    await g.byId[room.users[0].id].fire('halliGalli'); // 바닥에 카드 없음
    expect(g.io.emitted.find(e => e.event === 'bellOrder')).toBeUndefined();
  });

  test('카드가 새로 나오면 새 라운드가 시작된다', async () => {
    const g = await threeWithFive();
    await g.byId[g.b.id].fire('halliGalli');
    const room = await g.load();
    expect(bellOrder._rounds.has(g.roomId)).toBe(true);
    await g.byId[room.users[room.gameState.currentTurn].id].fire('playCard', 0);
    expect(bellOrder._rounds.has(g.roomId)).toBe(false);
  });

  test('recordPress: 1.5초가 지나면 새 라운드, 도착 시각 순 정렬', () => {
    const r1 = bellOrder.recordPress('t', { id: 'x', name: 'X' }, 1000, { canStart: true });
    const r2 = bellOrder.recordPress('t', { id: 'y', name: 'Y' }, 1200, { canStart: true });
    expect(r2.round).toBe(r1.round);
    expect(r2.presses.map(p => [p.name, p.delta])).toEqual([['X', 0], ['Y', 200]]);
    expect(bellOrder.recordPress('t', { id: 'x', name: 'X' }, 1300, { canStart: true })).toBeNull(); // 같은 라운드 중복
    const r3 = bellOrder.recordPress('t', { id: 'x', name: 'X' }, 3000, { canStart: true });
    expect(r3.round).not.toBe(r1.round);
    expect(bellOrder.recordPress('u', { id: 'x', name: 'X' }, 1000, { canStart: false })).toBeNull();
    bellOrder.clearRound('t');
  });
});

describe('벨 시간 보정 (2단계)', () => {
  const latency = require('../../utils/latency');
  const bellTiming = require('../../utils/bellTiming');
  afterEach(() => { latency._stats.clear(); process.env.BELL_JUDGE_WINDOW_MS = '0'; });

  async function twoWithFive() {
    const g = await setupGame(2);
    const room = await g.load();
    const [a, b] = room.users;
    room.gameState.playerStacks = { [a.id]: [{ fruit: 'plum', count: 3 }], [b.id]: [{ fruit: 'plum', count: 2 }] };
    room.gameState.centerCards = [{ fruit: 'plum', count: 3 }, { fruit: 'plum', count: 2 }];
    await roomService.saveRoomState(room);
    return { ...g, a, b };
  }

  test('핑이 높은 사람이 실제로 먼저 눌렀으면, 늦게 도착해도 보정해서 이긴다', async () => {
    process.env.BELL_JUDGE_WINDOW_MS = '60';
    const g = await twoWithFive();
    [140, 140, 140].forEach(v => latency.record(g.b.id, v)); // b: 왕복 140ms → 보정 최대 90ms
    [4, 4, 4].forEach(v => latency.record(g.a.id, v));       // a: 거의 0
    g.io.emitted.length = 0;
    const t = Date.now();
    // a 가 먼저 도착하지만, b 는 그보다 50ms 먼저 눌렀다고 보고 (보정 범위 안)
    const pa = g.byId[g.a.id].fire('halliGalli', { pressedAt: t });
    await new Promise(r => setTimeout(r, 20));
    const pb = g.byId[g.b.id].fire('halliGalli', { pressedAt: t - 50 });
    await Promise.all([pa, pb]);

    const results = g.io.emitted.filter(e => e.event === 'halliGalliResult');
    expect(results).toHaveLength(1);
    expect(results[0].payload).toMatchObject({ playerId: g.b.id, success: true });
    expect(g.byId[g.a.id].own.at(-1)).toEqual({ event: 'halliGalliError', payload: '한 발 늦었어요!' });
    const order = g.io.emitted.filter(e => e.event === 'bellOrder').at(-1).payload.presses;
    expect(order.map(p => p.playerId)).toEqual([g.b.id, g.a.id]);
    expect(order[0].ping).toBe(140);
  });

  test('보정은 서버가 잰 지연만큼만: 터무니없이 이른 시각을 보내도 이득이 없다', async () => {
    process.env.BELL_JUDGE_WINDOW_MS = '60';
    const g = await twoWithFive();
    [4, 4, 4].forEach(v => { latency.record(g.a.id, v); latency.record(g.b.id, v); }); // 둘 다 지연 없음
    g.io.emitted.length = 0;
    const pa = g.byId[g.a.id].fire('halliGalli', { pressedAt: Date.now() });
    await new Promise(r => setTimeout(r, 30));
    const pb = g.byId[g.b.id].fire('halliGalli', { pressedAt: Date.now() - 10000 }); // 10초 전이라고 거짓말
    await Promise.all([pa, pb]);
    expect(g.io.emitted.find(e => e.event === 'halliGalliResult').payload.playerId).toBe(g.a.id);
  });

  test('새 카드가 깔리기 직전 바닥을 보고 누른 벨은 그 바닥으로 판정한다', async () => {
    const g = await twoWithFive();
    const room = await g.load();
    // 지금 바닥: 합 5 (plum 3 + plum 2). 다음 카드로 깨진다
    const cur = room.users[room.gameState.currentTurn];
    const other = room.users.find(u => u.id !== cur.id);
    cur.cardPack[0] = { fruit: 'lemon', count: 1 };
    await roomService.saveRoomState(room);
    const seqBefore = (await g.load()).gameState.boardSeq;
    [100, 100].forEach(v => latency.record(other.id, v)); // 보정 최대 70ms
    const pressedAt = Date.now() - 5; // 카드가 깔리기 조금 전에 누름

    await g.byId[cur.id].fire('playCard', 0);                   // 그 직후 카드가 깔림 → 현재 바닥은 5 아님
    g.io.emitted.length = 0;
    await g.byId[other.id].fire('halliGalli', { pressedAt, boardSeq: seqBefore });

    const r = g.io.emitted.find(e => e.event === 'halliGalliResult').payload;
    expect(r).toMatchObject({ playerId: other.id, success: true, judgedOnPrev: true });
  });

  test('직전 바닥 인정은 그 바닥 번호를 보고 누른 경우만 (번호가 없거나 다르면 현재 바닥)', async () => {
    const g = await twoWithFive();
    const room = await g.load();
    const cur = room.users[room.gameState.currentTurn];
    const other = room.users.find(u => u.id !== cur.id);
    cur.cardPack[0] = { fruit: 'lemon', count: 1 };
    await roomService.saveRoomState(room);
    [100, 100].forEach(v => latency.record(other.id, v));
    const pressedAt = Date.now();
    await g.byId[cur.id].fire('playCard', 0);
    g.io.emitted.length = 0;
    await g.byId[other.id].fire('halliGalli', { pressedAt }); // boardSeq 없음
    expect(g.io.emitted.find(e => e.event === 'halliGalliResult').payload).toMatchObject({ success: false, judgedOnPrev: false });
  });

  test('waitFor: 지연이 비슷하면 거의 안 기다리고, 느린 사람이 있으면 그만큼 기다린다', () => {
    const p = bellTiming.effectiveTime(1000, 850, 300); // 편도 150 → 보정 170, 보정시각 850
    const press = { arrivedAt: 1000, effective: p.effective };
    expect(bellTiming.waitFor(press, 170)).toBe(20);                 // 모두 RTT 300
    expect(bellTiming.waitFor(press, bellTiming.compensationFor(20))).toBe(0); // 나머지가 빠름
    expect(bellTiming.waitFor({ arrivedAt: 1000, effective: 1000 }, 200)).toBe(200); // 상한
  });

  test('effectiveTime: 보정 상한·미래 시각·측정값 없음', () => {
    expect(bellTiming.effectiveTime(1000, 900, 400)).toEqual({ effective: 900, compensation: 100 });
    expect(bellTiming.effectiveTime(1000, 500, 400)).toEqual({ effective: 800, compensation: 200 }); // 상한 200, 거짓 시각은 잘림
    expect(bellTiming.effectiveTime(1000, 990, 40)).toEqual({ effective: 990, compensation: 10 });
    expect(bellTiming.effectiveTime(1000, 1500, 40)).toEqual({ effective: 1000, compensation: 0 }); // 미래 → 도착시각
    expect(bellTiming.effectiveTime(1000, 900, null)).toEqual({ effective: 1000, compensation: 0 }); // 측정 전 → 보정 없음
    expect(bellTiming.effectiveTime(1000, 'x', 100)).toEqual({ effective: 1000, compensation: 0 });
  });
});

describe('조작된 패킷 방어', () => {
  const bellTiming = require('../../utils/bellTiming');
  const latency = require('../../utils/latency');
  afterEach(() => { latency._stats.clear(); process.env.BELL_JUDGE_WINDOW_MS = '0'; });

  test('방 만들기: 최대 인원은 정수 2~4만, 방 이름은 정리 후 30자', async () => {
    const io = makeIo();
    await userService.connectUser('x', 'X');
    const x = makeSocket('x', io);
    for (const bad of ['abc', 100, 1, 2.5, -3, { a: 1 }]) {
      await x.fire('createRoom', '방' + Math.random(), bad);
      expect(x.own.at(-1).event).toBe('createRoomError');
    }
    limiters.roomAction.reset('x');
    await x.fire('createRoom', '  가‮나' + '다'.repeat(100), 3);
    const created = x.own.find(e => e.event === 'roomCreated').payload;
    expect(created.name).toBe('가나' + '다'.repeat(28));
    expect(created.maxUserCnt).toBe(3);
  });

  test('roomList·getGameState 연타는 속도 제한으로 무시된다', async () => {
    const io = makeIo();
    await userService.connectUser('y', 'Y');
    const y = makeSocket('y', io);
    resetCalls();
    for (let i = 0; i < 30; i++) await y.fire('roomList');
    expect(y.own.filter(e => e.event === 'roomList')).toHaveLength(5);
  });

  test('카드가 도착하기 전에 눌렀다는 주장은 인정하지 않는다 (핑 부풀리기 + 과거 시각)', async () => {
    process.env.BELL_JUDGE_WINDOW_MS = '80';
    const g = await setupGame(2);
    const room = await g.load();
    const turn = room.users[room.gameState.currentTurn];
    const other = room.users.find(u => u.id !== turn.id);
    room.gameState.playerStacks = { [turn.id]: [{ fruit: 'plum', count: 1 }], [other.id]: [{ fruit: 'plum', count: 2 }] };
    room.gameState.centerCards = [{ fruit: 'plum', count: 1 }, { fruit: 'plum', count: 2 }];
    turn.cardPack[0] = { fruit: 'plum', count: 3 };
    await roomService.saveRoomState(room);
    [250, 250, 250].forEach(v => latency.record(turn.id, v)); // turn: 핑을 250ms 로 부풀림 (실제로는 0)
    [4, 4, 4].forEach(v => latency.record(other.id, v));

    await g.byId[turn.id].fire('playCard', 0); // 카드가 깔림 → 합 5
    const seq = (await g.load()).gameState.boardSeq;
    g.io.emitted.length = 0;
    // 정직한 사람이 먼저 누르고, 사기꾼은 60ms 늦게 누르면서 "1초 전에 눌렀다"고 주장
    const honest = g.byId[other.id].fire('halliGalli', { pressedAt: Date.now(), boardSeq: seq });
    await new Promise(r => setTimeout(r, 60));
    const cheat = g.byId[turn.id].fire('halliGalli', { pressedAt: Date.now() - 1000, boardSeq: seq });
    await Promise.all([cheat, honest]);
    const r = g.io.emitted.find(e => e.event === 'halliGalliResult').payload;
    expect(r.playerId).toBe(other.id);
    // 사기꾼의 "카드 도착 전 누름" 주장은 의심 기록으로 남는다
    expect(bellTiming.suspiciousSummary().some(s => s.name === turn.name)).toBe(true);
  });
});

describe('같은 사람의 동시 요청', () => {
  test('방 만들기를 연달아 두 번 보내도 방은 하나만 생긴다 (유령 방 방지)', async () => {
    const io = makeIo();
    await userService.connectUser('dbl', '더블');
    const s = makeSocket('dbl', io);
    await Promise.all([s.fire('createRoom', '중복A', 2), s.fire('createRoom', '중복B', 2)]);
    expect(s.own.filter(e => e.event === 'roomCreated')).toHaveLength(1);
    expect(s.own.find(e => e.event === 'createRoomError').payload).toBe('이미 다른 방에 참여 중입니다.');
    expect(await mockRedis.sMembers('rooms:waiting')).toHaveLength(1);
  });
});

describe('닉네임 변경', () => {
  test('방 안에서는 바꿀 수 없고, 로비에서는 바뀐다', async () => {
    const registerUserEvents = require('../../socket/userEvents');
    const io = makeIo();
    const s = makeSocket('nick', io);
    registerUserEvents(s, io);
    await new Promise(r => setTimeout(r, 20)); // 접속 처리(connectUser) 완료 대기
    await s.fire('change name', '로비이름');
    expect(s.own.at(-1)).toEqual({ event: 'name change successful', payload: '로비이름' });
    await s.fire('createRoom', '닉방', 2);
    await s.fire('change name', '방이름');
    expect(s.own.at(-1)).toEqual({ event: 'name change error', payload: '방에서는 닉네임을 바꿀 수 없습니다.' });
    expect(await userService.getUserName('nick')).toBe('로비이름');
  });
});
