const { generateNickname, sanitizeNickname, MAX_NICKNAME_LENGTH } = require('../../utils/nickname');

describe('nickname', () => {
  test('generateNickname 은 형용사+동물+숫자 형태의 12자 이하 문자열을 만든다', () => {
    for (let i = 0; i < 50; i++) {
      const n = generateNickname();
      expect(n.length).toBeLessThanOrEqual(MAX_NICKNAME_LENGTH);
      expect(n).toMatch(/^[가-힣]+\d{2}$/);
    }
  });

  test('sanitizeNickname 은 공백/제어문자를 정리하고 길이를 제한한다', () => {
    expect(sanitizeNickname('  철수  ')).toBe('철수');
    expect(sanitizeNickname('a\u0000b​c')).toBe('abc');
    expect(sanitizeNickname('a   b')).toBe('a b');
    expect(sanitizeNickname('가'.repeat(30))).toHaveLength(MAX_NICKNAME_LENGTH);
  });

  test('문자열이 아니거나 비어 있으면 빈 문자열', () => {
    expect(sanitizeNickname(null)).toBe('');
    expect(sanitizeNickname(123)).toBe('');
    expect(sanitizeNickname('   ')).toBe('');
  });
});
