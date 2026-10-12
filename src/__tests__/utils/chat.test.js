const { sanitizeChatMessage, MAX_CHAT_LENGTH } = require('../../utils/chat');

describe('sanitizeChatMessage', () => {
  test('앞뒤 공백 제거, 연속 공백/탭 정리', () => {
    expect(sanitizeChatMessage('  안녕   하세요\t!  ')).toBe('안녕 하세요 !');
  });
  test('제어문자/제로폭/방향 제어 문자를 제거한다', () => {
    expect(sanitizeChatMessage('a\u0000b​c‮d⁦e﻿')).toBe('abcde');
  });
  test('줄바꿈은 유지하되 앞뒤는 정리한다', () => {
    expect(sanitizeChatMessage('\n한 줄\n두 줄\n')).toBe('한 줄\n두 줄');
  });
  test('최대 길이로 자르고 이모지를 깨뜨리지 않는다', () => {
    const out = sanitizeChatMessage('😀'.repeat(MAX_CHAT_LENGTH + 50));
    expect(Array.from(out)).toHaveLength(MAX_CHAT_LENGTH);
    expect(out).toBe('😀'.repeat(MAX_CHAT_LENGTH));
  });
  test('문자열이 아니거나 비면 빈 문자열', () => {
    expect(sanitizeChatMessage(null)).toBe('');
    expect(sanitizeChatMessage(42)).toBe('');
    expect(sanitizeChatMessage({ a: 1 })).toBe('');
    expect(sanitizeChatMessage('  ​ ')).toBe('');
  });
  test('HTML 은 그대로 문자열로 둔다 (렌더링 쪽에서 이스케이프)', () => {
    expect(sanitizeChatMessage('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });
});
