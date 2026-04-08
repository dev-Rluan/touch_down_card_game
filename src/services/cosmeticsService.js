/**
 * cosmeticsService.js
 *
 * 코스메틱(스킨) 시스템
 * - 카드 뒷면 스킨 5종 (CSS 기반, 이미지 불필요)
 * - 벨 스킨 3종
 *
 * Redis 키 구조:
 *   cosmetics:owned:{accountId}  → Set  (보유한 아이템 ID 목록)
 *   account:{accountId}          → Hash (equipped_card_skin, equipped_bell_skin 필드 포함)
 */

const { ensureRedisConnection } = require('../config/redisClient');

// ── 카탈로그 정의 ────────────────────────────────────────────────────────────

const CARD_SKINS = [
  {
    id: 'card-default',
    name: '기본 (보라)',
    cssClass: '',           // 기본값, 추가 클래스 없음
    preview: '#6366f1',
    unlockType: 'free',     // free | achievement | shop
    unlockRef: null,
  },
  {
    id: 'card-ocean',
    name: '오션',
    cssClass: 'card-skin-ocean',
    preview: '#0ea5e9',
    unlockType: 'achievement',
    unlockRef: 'first_win',  // achievementId
  },
  {
    id: 'card-sunset',
    name: '선셋',
    cssClass: 'card-skin-sunset',
    preview: '#f97316',
    unlockType: 'shop',
    price: 500,
  },
  {
    id: 'card-forest',
    name: '포레스트',
    cssClass: 'card-skin-forest',
    preview: '#16a34a',
    unlockType: 'achievement',
    unlockRef: 'wins_10',
  },
  {
    id: 'card-midnight',
    name: '미드나잇',
    cssClass: 'card-skin-midnight',
    preview: '#6366f1',
    unlockType: 'shop',
    price: 500,
  },
];

const BELL_SKINS = [
  {
    id: 'bell-gold',
    name: '골드 (기본)',
    cssClass: '',
    preview: '#fbbf24',
    unlockType: 'free',
    unlockRef: null,
  },
  {
    id: 'bell-silver',
    name: '실버',
    cssClass: 'bell-skin-silver',
    preview: '#94a3b8',
    unlockType: 'achievement',
    unlockRef: 'games_10',
  },
  {
    id: 'bell-ruby',
    name: '루비',
    cssClass: 'bell-skin-ruby',
    preview: '#ef4444',
    unlockType: 'shop',
    price: 700,
  },
];

// 전체 카탈로그 (id → 아이템)
const CATALOG = Object.fromEntries(
  [...CARD_SKINS, ...BELL_SKINS].map(item => [item.id, item])
);

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function ownedKey(accountId) {
  return `cosmetics:owned:${accountId}`;
}

function accountKey(accountId) {
  return `account:${accountId}`;
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 계정의 보유 아이템 + 장착 현황 조회
 * @returns {{ owned: string[], equipped: { card: string, bell: string }, catalog: { cards, bells } }}
 */
async function getCosmetics(accountId) {
  const redis = await ensureRedisConnection();

  const [ownedRaw, equippedCard, equippedBell] = await Promise.all([
    redis.sMembers(ownedKey(accountId)),
    redis.hGet(accountKey(accountId), 'equipped_card_skin'),
    redis.hGet(accountKey(accountId), 'equipped_bell_skin'),
  ]);

  // 무료 아이템은 항상 보유
  const freeIds = [...CARD_SKINS, ...BELL_SKINS]
    .filter(i => i.unlockType === 'free')
    .map(i => i.id);

  const owned = [...new Set([...freeIds, ...ownedRaw])];

  return {
    owned,
    equipped: {
      card: equippedCard || 'card-default',
      bell: equippedBell || 'bell-gold',
    },
    catalog: {
      cards: CARD_SKINS,
      bells: BELL_SKINS,
    },
  };
}

/**
 * 코스메틱 아이템 장착
 * @param {string} accountId
 * @param {'card'|'bell'} type
 * @param {string} skinId
 */
async function equipCosmetic(accountId, type, skinId) {
  if (type !== 'card' && type !== 'bell') {
    throw Object.assign(new Error('유효하지 않은 타입입니다.'), { status: 400 });
  }

  const item = CATALOG[skinId];
  if (!item) {
    throw Object.assign(new Error('존재하지 않는 스킨입니다.'), { status: 404 });
  }

  // 타입 일치 확인
  const isCardSkin = skinId.startsWith('card-');
  const isBellSkin = skinId.startsWith('bell-');
  if ((type === 'card' && !isCardSkin) || (type === 'bell' && !isBellSkin)) {
    throw Object.assign(new Error('스킨 타입이 맞지 않습니다.'), { status: 400 });
  }

  // 보유 확인 (무료 아이템은 항상 허용)
  if (item.unlockType !== 'free') {
    const redis = await ensureRedisConnection();
    const owned = await redis.sIsMember(ownedKey(accountId), skinId);
    if (!owned) {
      throw Object.assign(new Error('보유하지 않은 스킨입니다.'), { status: 403 });
    }
  }

  const redis = await ensureRedisConnection();
  const field = type === 'card' ? 'equipped_card_skin' : 'equipped_bell_skin';
  await redis.hSet(accountKey(accountId), field, skinId);

  return { equipped: { type, skinId } };
}

/**
 * 코스메틱 아이템 지급 (업적 달성 / 결제 완료 시 호출)
 * @param {string} accountId
 * @param {string} itemId
 */
async function unlockCosmetic(accountId, itemId) {
  if (!CATALOG[itemId]) return;       // 존재하지 않는 아이템은 무시
  if (CATALOG[itemId].unlockType === 'free') return;  // 무료는 항상 보유

  const redis = await ensureRedisConnection();
  await redis.sAdd(ownedKey(accountId), itemId);
}

/**
 * 업적 ID에 연결된 코스메틱 자동 지급
 * achievementService에서 업적 달성 시 호출
 */
async function unlockByAchievement(accountId, achievementId) {
  const items = [...CARD_SKINS, ...BELL_SKINS].filter(
    i => i.unlockType === 'achievement' && i.unlockRef === achievementId
  );
  if (items.length === 0) return [];

  const redis = await ensureRedisConnection();
  await Promise.all(items.map(i => redis.sAdd(ownedKey(accountId), i.id)));
  return items.map(i => i.id);
}

/**
 * 전체 카탈로그 반환 (상점 표시용)
 */
function getCatalog() {
  return { cards: CARD_SKINS, bells: BELL_SKINS };
}

module.exports = {
  getCosmetics,
  equipCosmetic,
  unlockCosmetic,
  unlockByAchievement,
  getCatalog,
  CARD_SKINS,
  BELL_SKINS,
  CATALOG,
};
