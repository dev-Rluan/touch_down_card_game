const mockNames = {};
jest.mock('../../services/userServices', () => ({
  getUserName: jest.fn(async (id) => mockNames[id] || null),
}));

const registerChat = require('../../socket/chatEvents');
const { limiters } = require('../../utils/socketRateLimiter');

function makeIo() {
  const emitted = [];
  return { emitted, to: (target) => ({ emit: (event, payload) => emitted.push({ to: target, event, payload }) }) };
}
// rooms: 소켓이 속한 Socket.IO 룸 (자기 ID, 로비, 입장한 방)
function makeSocket(id, io, rooms) {
  const handlers = {};
  const own = [];
  const socket = {
    id,
    rooms: new Set([id, ...rooms]),
    on: (ev, fn) => { handlers[ev] = fn; },
    emit: (event, payload) => own.push({ event, payload }),
    own,
    send: (text) => handlers['chat message'](text),
  };
  registerChat(socket, io);
  return socket;
}

beforeEach(() => {
  Object.keys(mockNames).forEach(k => delete mockNames[k]);
  ['a', 'b', 'c'].forEach(id => limiters.chat.reset(id));
});

describe('chat message 핸들러', () => {
  test('같은 방에만 전달된다 (로비가 아니라 방 룸으로 emit)', async () => {
    const io = makeIo(); mockNames.a = '여우';
    const a = makeSocket('a', io, ['room-1']);
    await a.send('안녕');
    expect(io.emitted).toHaveLength(1);
    expect(io.emitted[0].to).toBe('room-1');
    expect(io.emitted[0].event).toBe('chat message');
    expect(io.emitted[0].payload).toMatchObject({ userId: 'a', name: '여우', text: '안녕' });
    expect(typeof io.emitted[0].payload.ts).toBe('number');
  });

  test('서로 다른 방의 메시지는 각자의 방으로만 간다', async () => {
    const io = makeIo(); mockNames.a = 'A'; mockNames.b = 'B';
    await makeSocket('a', io, ['room-1']).send('1번 방');
    await makeSocket('b', io, ['room-2']).send('2번 방');
    expect(io.emitted.map(e => [e.to, e.payload.text])).toEqual([['room-1', '1번 방'], ['room-2', '2번 방']]);
  });

  test('방에 없고 로비에만 있으면 거부한다', async () => {
    const io = makeIo(); mockNames.a = 'A';
    const a = makeSocket('a', io, ['lobby']);
    await a.send('로비에서');
    expect(io.emitted).toHaveLength(0);
    expect(a.own.at(-1)).toEqual({ event: 'chatError', payload: '방에 입장한 뒤에 채팅할 수 있습니다.' });
  });

  test('메시지를 정리하고 길이를 제한하며, 빈 메시지는 무시한다', async () => {
    const io = makeIo(); mockNames.a = 'A';
    const a = makeSocket('a', io, ['room-1']);
    await a.send('   ');
    await a.send(null);
    await a.send(123);
    expect(io.emitted).toHaveLength(0);
    await a.send('x'.repeat(500));
    expect(Array.from(io.emitted[0].payload.text)).toHaveLength(200);
  });

  test('도배는 속도 제한에 걸려 chatError 를 받는다', async () => {
    const io = makeIo(); mockNames.a = 'A';
    const a = makeSocket('a', io, ['room-1']);
    for (let i = 0; i < 8; i++) await a.send(`m${i}`);
    expect(io.emitted).toHaveLength(5);
    expect(a.own.filter(e => e.event === 'chatError')).toHaveLength(3);
  });

  test('닉네임은 서버 값을 쓴다 (클라이언트가 이름을 속일 수 없다)', async () => {
    const io = makeIo(); mockNames.a = '진짜이름';
    const a = makeSocket('a', io, ['room-1']);
    await a.send({ text: '객체로 보내기', name: '가짜' });
    expect(io.emitted).toHaveLength(0); // 문자열이 아니면 무시
    await a.send('문자열');
    expect(io.emitted[0].payload.name).toBe('진짜이름');
  });
});
