// 채팅 메시지 검증/정리
const MAX_CHAT_LENGTH = 200;

/**
 * 제어문자, 제로폭 문자, 방향 제어 문자(텍스트를 뒤집어 보이게 하는 U+202A~202E, U+2066~2069)를 제거하고
 * 앞뒤 공백을 정리한 뒤 최대 길이로 자른다. 이모지가 깨지지 않도록 코드 포인트 단위로 자른다.
 * @returns {string} 정리된 메시지 (비어 있으면 빈 문자열)
 */
function sanitizeChatMessage(input) {
  if (typeof input !== 'string') return '';
  const cleaned = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_CHAT_LENGTH).join('');
}

module.exports = { sanitizeChatMessage, MAX_CHAT_LENGTH };
