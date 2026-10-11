const { withRoomLock, _pending } = require('../../utils/roomLock');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('withRoomLock', () => {
  test('같은 방의 작업은 순서대로 실행되어 lost update 가 없다', async () => {
    const db = { n: 0 };
    const incr = async () => {
      const v = db.n;      // read
      await sleep(5);      // 다른 요청이 끼어들 수 있는 구간
      db.n = v + 1;        // write
    };
    await Promise.all(Array.from({ length: 10 }, () => withRoomLock('r1', incr)));
    expect(db.n).toBe(10);
  });

  test('락 없이 동시 실행하면 갱신이 유실된다 (대조군)', async () => {
    const db = { n: 0 };
    const incr = async () => { const v = db.n; await sleep(5); db.n = v + 1; };
    await Promise.all(Array.from({ length: 10 }, () => incr()));
    expect(db.n).toBeLessThan(10);
  });

  test('다른 방의 작업은 서로 막지 않는다', async () => {
    const order = [];
    await Promise.all([
      withRoomLock('a', async () => { await sleep(30); order.push('a'); }),
      withRoomLock('b', async () => { order.push('b'); }),
    ]);
    expect(order).toEqual(['b', 'a']);
  });

  test('앞 작업이 실패해도 다음 작업은 실행되고, 에러는 호출자에게 전달된다', async () => {
    const failing = withRoomLock('c', async () => { throw new Error('boom'); });
    const next = withRoomLock('c', async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  test('작업이 끝나면 내부 맵이 비워진다', async () => {
    await withRoomLock('d', async () => {});
    await sleep(5);
    expect(_pending()).toBe(0);
  });
});
