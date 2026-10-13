// 소켓 핸들러(ready / playCard / halliGalli)를 가짜 소켓 + 메모리 Redis 로 실행해
// 이벤트 내용, 저장된 상태, Redis 명령 수를 검증한다.

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

// 2~4명이 입장한 방을 만들고 게임을 시작한다
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
    hands.forEach(h => expect(h.payload.cards).toEqual(after.users.find(u => u.id === h.to).cardPack));
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
    hands.forEach(h => expect(h.payload.cards).toHaveLength(after.users.find(u => u.id === h.to).cardPack.length));
    expect(hands.find(h => h.to === winner.id).payload.cards).toHaveLength(room.users[0].cardPack.length + 2);
  });

  test('벨 실패 후에도 손패가 다시 전송된다 (버린 1장이 반영)', async () => {
    const { io, byId, room } = await gameWithStacks([{ fruit: 'banana', count: 1 }, { fruit: 'lemon', count: 2 }]);
    const p = room.users[1];
    io.emitted.length = 0;
    await byId[p.id].fire('halliGalli');
    const mine = io.emitted.filter(e => e.event === 'yourHand').find(h => h.to === p.id);
    expect(mine.payload.cards).toHaveLength(p.cardPack.length - 1);
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
    expect(Object.keys(created.payload).sort()).toEqual(['id', 'maxUserCnt', 'name', 'status', 'users']);
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
    expect(Object.keys(played.result).sort()).toEqual(['centerCount', 'nextTurn', 'playedCard', 'playerCardCount']);
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
