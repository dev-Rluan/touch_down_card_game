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
    own,
    fire: (ev, ...args) => handlers[ev](...args),
  };
  registerGameEvents(socket, io);
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

beforeEach(() => {
  mockStore.kv.clear(); mockStore.hash.clear(); mockStore.set.clear(); resetCalls();
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
    expect(gs.payload.centerCards).toEqual([]);
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
    expect(result.discardedCard).toEqual(bottom);
    const after = await load();
    expect(after.users[1].cardPack).toHaveLength(p.cardPack.length - 1);
    expect(after.gameState.discardedCards).toEqual([bottom]);
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
