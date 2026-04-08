/**
 * /api/shop 라우터 — 상점 & Toss Payments 결제
 *
 * GET  /api/shop/items                    — 상품 목록 (미로그인 가능)
 * POST /api/shop/purchase/initiate        — 주문 생성 (로그인 필요)
 * POST /api/shop/purchase/confirm         — 결제 승인 (로그인 필요)
 */

const express = require('express');
const router = express.Router();
const shopService = require('../services/shopService');

// ── 미들웨어 ──────────────────────────────────────────────────────────────────

function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

// ── 상품 목록 ─────────────────────────────────────────────────────────────────

/**
 * GET /api/shop/items
 * 로그인 사용자의 보유 여부를 포함해 반환
 */
router.get('/items', async (req, res) => {
  try {
    const items = shopService.getShopItems();
    res.json({ items });
  } catch (err) {
    console.error('[shop/items]', err);
    res.status(500).json({ error: '상품 목록을 불러올 수 없습니다.' });
  }
});

// ── 결제 주문 생성 ────────────────────────────────────────────────────────────

/**
 * POST /api/shop/purchase/initiate
 * Body: { itemId: string }
 * Returns: { orderId, orderName, amount }
 */
router.post('/purchase/initiate', requireLogin, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: 'itemId가 필요합니다.' });
    }
    const order = await shopService.initiatePayment(req.user.id, itemId);
    res.json(order);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ── 결제 승인 ─────────────────────────────────────────────────────────────────

/**
 * POST /api/shop/purchase/confirm
 * Body: { orderId, paymentKey, amount }
 * Toss SDK가 결제 완료 후 클라이언트가 이 엔드포인트 호출
 */
router.post('/purchase/confirm', requireLogin, async (req, res) => {
  try {
    const { orderId, paymentKey, amount } = req.body;
    if (!orderId || !paymentKey || amount === undefined) {
      return res.status(400).json({ error: 'orderId, paymentKey, amount가 필요합니다.' });
    }
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: '유효하지 않은 금액입니다.' });
    }

    const result = await shopService.confirmPayment(orderId, paymentKey, parsedAmount);
    res.json(result);
  } catch (err) {
    console.error('[shop/confirm]', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ── Toss Payments 리다이렉트 처리 (successUrl / failUrl) ─────────────────────

/**
 * GET /api/shop/purchase/success
 * Toss SDK successUrl 리다이렉트 처리
 * Query: orderId, paymentKey, amount
 */
router.get('/purchase/success', requireLogin, async (req, res) => {
  try {
    const { orderId, paymentKey, amount } = req.query;
    if (!orderId || !paymentKey || !amount) {
      return res.redirect('/?payment_error=missing_params');
    }
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount)) {
      return res.redirect('/?payment_error=invalid_amount');
    }
    const result = await shopService.confirmPayment(orderId, paymentKey, parsedAmount);
    res.redirect(`/?payment_success=1&itemId=${encodeURIComponent(result.itemId || '')}`);
  } catch (err) {
    console.error('[shop/success]', err);
    const msg = encodeURIComponent(err.message || '결제 오류');
    res.redirect(`/?payment_error=${msg}`);
  }
});

/**
 * GET /api/shop/purchase/fail
 * Toss SDK failUrl 리다이렉트 처리
 */
router.get('/purchase/fail', (req, res) => {
  const msg = encodeURIComponent(req.query.message || '결제가 취소되었습니다.');
  res.redirect(`/?payment_error=${msg}`);
});

module.exports = router;
