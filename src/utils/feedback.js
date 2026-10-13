// 유저 피드백 검증/저장
//
// 저장소: Redis 리스트 `feedback` (최신이 앞, 최대 MAX_STORED 건 유지)
// 확인 방법: GET /admin/feedback (FEEDBACK_ADMIN_TOKEN 필요)
// 선택: FEEDBACK_WEBHOOK_URL (Discord 웹훅) 을 설정하면 접수될 때마다 알림을 보낸다.
const { ensureRedisConnection } = require('../config/redisClient');

const FEEDBACK_KEY = 'feedback';
const MAX_STORED = 1000;
const MIN_LENGTH = 2;
const MAX_LENGTH = 1000;
const CATEGORIES = { bug: '버그', idea: '제안', etc: '기타' };

/**
 * 제어문자·방향 제어 문자를 지우고 줄바꿈은 남긴다 (연속 빈 줄은 2줄까지).
 * @returns {string} 정리된 본문 (너무 짧으면 빈 문자열)
 */
function sanitizeFeedback(input) {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const text = Array.from(cleaned).slice(0, MAX_LENGTH).join('');
  return Array.from(text).length >= MIN_LENGTH ? text : '';
}

function normalizeCategory(value) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, value) ? value : 'etc';
}

async function saveFeedback(entry) {
  const client = await ensureRedisConnection();
  await client.multi()
    .lPush(FEEDBACK_KEY, JSON.stringify(entry))
    .lTrim(FEEDBACK_KEY, 0, MAX_STORED - 1)
    .exec();
}

async function listFeedback(limit = 200) {
  const client = await ensureRedisConnection();
  const rows = await client.lRange(FEEDBACK_KEY, 0, Math.max(0, limit - 1));
  return rows.map(r => { try { return JSON.parse(r); } catch (_) { return null; } }).filter(Boolean);
}

/** Discord 웹훅 알림 (실패해도 접수에는 영향 없음) */
async function notifyWebhook(entry) {
  const url = process.env.FEEDBACK_WEBHOOK_URL;
  if (!url || typeof fetch !== 'function') return;
  const content = `**[${CATEGORIES[entry.category]}]** ${entry.name || '익명'}\n${entry.text}`.slice(0, 1900);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[feedback webhook]', err.message);
  }
}

module.exports = {
  sanitizeFeedback, normalizeCategory, saveFeedback, listFeedback, notifyWebhook,
  CATEGORIES, MIN_LENGTH, MAX_LENGTH, FEEDBACK_KEY,
};
