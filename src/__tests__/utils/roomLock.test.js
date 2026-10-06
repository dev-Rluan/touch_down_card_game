const { withRoomLock } = require('../../utils/roomLock');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe('withRoomLock', () => {
  test('같은 방의 작업은 순서대로 하나씩 실행된다', async () => {
    const log = [];
    const task = (name, ms) => withRoomLock('room-1', async () => {
      log.push(`${name}:start`);
      await delay(ms);
      log.push(`${name}:end`);
      return name;
    });

    const results = await Promise.all([task('a', 20), task('b', 5), task('c', 1)]);

    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  test('다른 방의 작업은 서로 기다리지 않는다', async () => {
    const log = [];
    await Promise.all([
      withRoomLock('room-a', async () => { await delay(20); log.push('a'); }),
      withRoomLock('room-b', async () => { log.push('b'); }),
    ]);
    expect(log).toEqual(['b', 'a']);
  });

  test('앞선 작업이 실패해도 다음 작업은 실행되고, 에러는 호출자에게 전달된다', async () => {
    const failing = withRoomLock('room-2', async () => { throw new Error('boom'); });
    const next = withRoomLock('room-2', async () => 'ok');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});
