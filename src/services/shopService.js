/**
 * shopService.js — 상점 & Toss Payments 결제 서비스
 *
 * 흐름:
 *  1. 클라이언트가 POST /api/shop/purchase/initiate 호출 → orderId 발급
 *  2. 클라이언트가 Toss Payments JS SDK로 결제창 오픈
 *  3. 결제 성공 시 클라이언트가 POST /api/shop/purchase/confirm 호출
 *  4. 서버가 Toss API로 결제 승인 → 코스메틱 지급
 *
 * Redis 키:
 *  shop:order:{orderId}  → Hash { accountId, itemId, amount, status }  TTL 30분
 */

const { v4: uuidv4 } = require('uuid');
const { ensureRedisConnection } = require('../config/redisClient');
const cosmeticsService = require('./cosmeticsService');

// ── 상점 카탈로그 ─────────────────────────────────────────────────────────────

/** 구매 가능한 아이템 목록 (cosmeticsService와 동기화) */
const SHOP_ITEMS = [
  ...cosmeticsService.CARD_SKINS.filter(i => i.unlockType === 'shop').map(i => ({
    id: i.id,
    name: i.name,
    type: 'card_skin',
    price: i.price,
    description: `카드 뒷면 스킨 — ${i.name}`,
    preview: i.preview,
  })),
  ...cosmeticsService.BELL_SKINS.filter(i => i.unlockType === 'shop').map(i => ({
    id: i.id,
    name: i.name,
    type: 'bell_skin',
    price: i.price,
    description: `벨 스킨 — ${i.name}`,
    preview: i.preview,
  })),
];

// ── Toss Payments API 설정 ────────────────────────────────────────────────────

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

function getTossSecretKey() {
  return process.env.TOSS_SECRET_KEY || '';
}

function tossAuthHeader() {
  const key = getTossSecretKey();
  if (!key) return null;
  // Toss Payments: Basic auth (secretKey + ':' → base64)
  const encoded = Buffer.from(`${key}:`).toString('base64');
  return `Basic ${encoded}`;
}

// ── 주문 Redis 헬퍼 ───────────────────────────────────────────────────────────

const ORDER_TTL = 60 * 30; // 30분

function orderKey(orderId) {
  return `shop:order:${orderId}`;
}

async function saveOrder(orderId, accountId, itemId, amount) {
  const redis = await ensureRedisConnection();
  await redis.hSet(orderKey(orderId), {
    accountId,
    itemId,
    amount: String(amount),
    status: 'pending',
    createdAt: Date.now().toString(),
  });
  await redis.expire(orderKey(orderId), ORDER_TTL);
}

async function getOrder(orderId) {
  const redis = await ensureRedisConnection();
  const data = await redis.hGetAll(orderKey(orderId));
  if (!data || !data.accountId) return null;
  return {
    accountId: data.accountId,
    itemId: data.itemId,
    amount: parseInt(data.amount, 10),
    status: data.status,
  };
}

async function markOrderDone(orderId) {
  const redis = await ensureRedisConnection();
  await redis.hSet(orderKey(orderId), 'status', 'done');
  await redis.expire(orderKey(orderId), ORDER_TTL);
}

// ── 공개 API ──────────────────────────────────────────────────────────────────

/**
 * 전체 상점 아이템 목록 반환
 */
function getShopItems() {
  return SHOP_ITEMS;
}

/**
 * 결제 주문 생성 (Toss SDK 호출 전 서버 측 주문 등록)
 * @returns {{ orderId, orderName, amount }}
 */
async function initiatePayment(accountId, itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) {
    throw Object.assign(new Error('존재하지 않는 상품입니다.'), { status: 404 });
  }

  // 이미 보유 중인지 확인
  const cosmetics = await cosmeticsService.getCosmetics(accountId);
  if (cosmetics.owned.includes(itemId)) {
    throw Object.assign(new Error('이미 보유한 상품입니다.'), { status: 409 });
  }

  const orderId = `tdcg-${uuidv4()}`;
  await saveOrder(orderId, accountId, itemId, item.price);

  return {
    orderId,
    orderName: item.name,
    amount: item.price,
  };
}

/**
 * 결제 승인 (클라이언트 SDK 결제 완료 후 서버 확인)
 * @param {string} orderId      - 우리 서버 주문 ID
 * @param {string} paymentKey   - Toss 결제 키 (SDK가 반환)
 * @param {number} amount       - 결제 금액 (변조 확인용)
 */
async function confirmPayment(orderId, paymentKey, amount) {
  // 주문 조회 및 검증
  const order = await getOrder(orderId);
  if (!order) {
    throw Object.assign(new Error('주문을 찾을 수 없습니다.'), { status: 404 });
  }
  if (order.status === 'done') {
    throw Object.assign(new Error('이미 처리된 주문입니다.'), { status: 409 });
  }
  if (order.amount !== amount) {
    throw Object.assign(new Error('결제 금액이 일치하지 않습니다.'), { status: 400 });
  }

  const authHeader = tossAuthHeader();

  // Toss 결제 승인 API 호출 (secret key가 없으면 테스트 모드로 진행)
  if (authHeader) {
    const tossRes = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const errBody = await tossRes.json().catch(() => ({}));
      const msg = errBody.message || '결제 승인에 실패했습니다.';
      throw Object.assign(new Error(msg), { status: 402 });
    }
  } else {
    // TOSS_SECRET_KEY 미설정 → 개발 환경 테스트 통과
    console.warn('[Shop] TOSS_SECRET_KEY 미설정 — 테스트 모드로 결제 승인 처리');
  }

  // 아이템 지급
  await cosmeticsService.unlockCosmetic(order.accountId, order.itemId);
  await markOrderDone(orderId);

  return { success: true, itemId: order.itemId };
}

module.exports = {
  getShopItems,
  initiatePayment,
  confirmPayment,
};
