/**
 * 피드백 이벤트 핸들러 — 로비의 "피드백 보내기"에서 보낸 의견을 저장한다.
 * 결과는 ack 콜백으로 돌려준다: { ok: true } 또는 { ok: false, error }
 */
const userService = require('../services/userServices');
const { limiters } = require('../utils/socketRateLimiter');
const { sanitizeFeedback, normalizeCategory, saveFeedback, notifyWebhook, MIN_LENGTH } = require('../utils/feedback');

module.exports = function(socket) {
  socket.on('sendFeedback', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const text = sanitizeFeedback(payload?.text);
      if (!text) {
        reply({ ok: false, error: `내용을 ${MIN_LENGTH}자 이상 입력해 주세요.` });
        return;
      }
      // 소켓별 제한 + 재접속으로 우회하는 도배를 막는 전체 제한
      if (!limiters.feedback.allow(socket.id) || !limiters.feedbackGlobal.allow('all')) {
        reply({ ok: false, error: '피드백을 너무 자주 보내고 있습니다. 잠시 후 다시 시도해 주세요.' });
        return;
      }

      const entry = {
        ts: Date.now(),
        category: normalizeCategory(payload?.category),
        text,
        name: (await userService.getUserName(socket.id)) || null,
        ua: String(socket.handshake?.headers?.['user-agent'] || '').slice(0, 200),
      };
      await saveFeedback(entry);
      reply({ ok: true });
      notifyWebhook(entry);
    } catch (error) {
      console.error('[sendFeedback Error]', error);
      reply({ ok: false, error: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });
};
