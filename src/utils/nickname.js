// 임시 닉네임 생성 및 닉네임 검증
const ADJECTIVES = ['빠른', '용감한', '조용한', '느긋한', '날쌘', '듬직한', '반짝이는', '엉뚱한', '씩씩한', '똑똑한', '장난꾸러기', '졸린'];
const ANIMALS = ['여우', '고양이', '펭귄', '너구리', '다람쥐', '수달', '부엉이', '호랑이', '토끼', '고래', '판다', '오리'];

const MAX_NICKNAME_LENGTH = 12;

function generateNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10~99
  return `${adj}${animal}${num}`;
}

/**
 * 닉네임 정리: 제어문자/제로폭 문자 제거, 공백 정리, 최대 길이 제한
 * @returns {string} 정리된 닉네임 (비어 있으면 빈 문자열)
 */
function sanitizeNickname(input) {
  if (typeof input !== 'string') return '';
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NICKNAME_LENGTH);
}

module.exports = { generateNickname, sanitizeNickname, MAX_NICKNAME_LENGTH };
