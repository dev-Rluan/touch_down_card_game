jest.mock('../../services/userServices', () => ({
  getUserName: jest.fn(async (id) => (id === 'a' ? '여우' : null)),
}));
jest.mock('../../utils/feedback', () => {
  const actual = jest.requireActual('../../utils/feedback');
  return { ...actual, saveFeedback: jest.fn(async () => {}), notifyWebhook: jest.fn(async () => {}) };
});

const registerFeedback = require('../../socket/feedbackEvents');
const { limiters } = require('../../utils/socketRateLimiter');
const { saveFeedback, notifyWebhook, sanitizeFeedback, normalizeCategory } = require('../../utils/feedback');

function makeSocket(id) {
  const handlers = {};
  const socket = {
    id,
    handshake: { headers: { 'user-agent': 'jest-agent' } },
    on: (ev, fn) => { handlers[ev] = fn; },
  };
  registerFeedback(socket);
  socket.send = (payload) => new Promise(resolve => handlers.sendFeedback(payload, resolve));
  return socket;
}

beforeEach(() => {
  jest.clearAllMocks();
  ['a', 'b'].forEach(id => limiters.feedback.reset(id));
  limiters.feedbackGlobal.reset('all');
});

describe('sendFeedback 핸들러', () => {
  test('정리된 내용을 닉네임·종류와 함께 저장하고 ok 를 돌려준다', async () => {
    const res = await makeSocket('a').send({ category: 'bug', text: '  벨이\r\n안 눌려요  ' });
    expect(res).toEqual({ ok: true });
    expect(saveFeedback).toHaveBeenCalledTimes(1);
    expect(saveFeedback.mock.calls[0][0]).toMatchObject({ category: 'bug', text: '벨이\n안 눌려요', name: '여우', ua: 'jest-agent' });
    expect(typeof saveFeedback.mock.calls[0][0].ts).toBe('number');
    expect(notifyWebhook).toHaveBeenCalledTimes(1);
  });

  test('너무 짧거나 문자열이 아니면 저장하지 않는다', async () => {
    const s = makeSocket('a');
    for (const bad of [{ text: ' a ' }, { text: 123 }, null, undefined, { text: '​​' }]) {
      const res = await s.send(bad);
      expect(res.ok).toBe(false);
    }
    expect(saveFeedback).not.toHaveBeenCalled();
  });

  test('알 수 없는 종류는 etc 로 저장한다', async () => {
    await makeSocket('b').send({ category: '__proto__', text: '좋아요!' });
    expect(saveFeedback.mock.calls[0][0]).toMatchObject({ category: 'etc', name: null });
  });

  test('소켓당 10분에 3건까지만 받는다', async () => {
    const s = makeSocket('a');
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await s.send({ text: `의견 ${i}` }));
    expect(results.map(r => r.ok)).toEqual([true, true, true, false]);
    expect(saveFeedback).toHaveBeenCalledTimes(3);
  });

  test('저장 실패 시 오류를 돌려주고 웹훅은 보내지 않는다', async () => {
    saveFeedback.mockRejectedValueOnce(new Error('redis down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await makeSocket('a').send({ text: '저장 안 됨' });
    spy.mockRestore();
    expect(res.ok).toBe(false);
    expect(notifyWebhook).not.toHaveBeenCalled();
  });

  test('ack 없이 보내도 예외가 나지 않는다', async () => {
    const handlers = {};
    registerFeedback({ id: 'b', on: (ev, fn) => { handlers[ev] = fn; } });
    await expect(handlers.sendFeedback({ text: '콜백 없음' })).resolves.toBeUndefined();
  });
});

describe('sanitizeFeedback', () => {
  test('방향 제어 문자 제거, 빈 줄 2줄로 축소, 1000자 제한', () => {
    expect(sanitizeFeedback('a‮b\n\n\n\nc')).toBe('ab\n\nc');
    expect(Array.from(sanitizeFeedback('😀'.repeat(1500)))).toHaveLength(1000);
  });
  test('normalizeCategory', () => {
    expect(normalizeCategory('idea')).toBe('idea');
    expect(normalizeCategory('toString')).toBe('etc');
  });
});
