const connectionLimit = require('../../socket/connectionLimit');

function fakeIo() {
  let mw = null;
  return { use: fn => { mw = fn; }, connect: (headers, address = '10.0.0.1') => {
    const handlers = {};
    const socket = { handshake: { headers, address }, on: (ev, fn) => { handlers[ev] = fn; } };
    let err = null; mw(socket, e => { err = e || null; });
    return { err, disconnect: () => handlers.disconnect && handlers.disconnect() };
  } };
}

describe('IP당 연결 수 제한', () => {
  test('같은 IP 는 maxPerIp 개까지, 끊기면 다시 허용', () => {
    const io = fakeIo(); connectionLimit(io, { maxPerIp: 2 });
    const a = io.connect({}), b = io.connect({}), c = io.connect({});
    expect([a.err, b.err]).toEqual([null, null]);
    expect(c.err.data.code).toBe('TOO_MANY_CONNECTIONS');
    a.disconnect();
    expect(io.connect({}).err).toBeNull();
  });

  test('X-Forwarded-For 는 마지막 값(프록시가 본 주소)을 쓴다 — 앞쪽 값을 바꿔도 우회 불가', () => {
    const io = fakeIo(); connectionLimit(io, { maxPerIp: 1 });
    expect(io.connect({ 'x-forwarded-for': '1.1.1.1, 9.9.9.9' }).err).toBeNull();
    expect(io.connect({ 'x-forwarded-for': '2.2.2.2, 9.9.9.9' }).err).not.toBeNull(); // 같은 실제 IP
    expect(io.connect({ 'x-forwarded-for': '8.8.8.8' }).err).toBeNull();
  });

  test('maxPerIp 0 이면 제한하지 않는다', () => {
    const io = { use: jest.fn() }; connectionLimit(io, { maxPerIp: 0 });
    expect(io.use).not.toHaveBeenCalled();
  });
});
