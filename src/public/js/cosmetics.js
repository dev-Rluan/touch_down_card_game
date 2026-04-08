/**
 * cosmetics.js — 코스메틱 UI 모듈
 *
 * 역할:
 *  1. /api/cosmetics 에서 보유/장착 데이터 로드
 *  2. 코스메틱 탭 패널 렌더링 (카드 스킨 + 벨 스킨 선택)
 *  3. POST /api/cosmetics/equip 로 장착 요청
 *  4. 장착된 스킨을 실시간으로 게임 UI에 반영
 *
 * 의존:
 *  - window.TDAuth (auth.js)
 */

window.TDCosmetics = (function () {
  'use strict';

  let _data = null; // { owned, equipped, catalog }

  // ── 내부 헬퍼 ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isOwned(itemId) {
    if (!_data) return false;
    const item = [...(_data.catalog.cards || []), ...(_data.catalog.bells || [])]
      .find(i => i.id === itemId);
    if (item && item.unlockType === 'free') return true;
    return _data.owned.includes(itemId);
  }

  function isEquipped(itemId) {
    if (!_data) return false;
    return _data.equipped.card === itemId || _data.equipped.bell === itemId;
  }

  // ── 렌더링 ─────────────────────────────────────────────────────────────────

  function renderSkinCard(item) {
    const owned = isOwned(item.id);
    const equipped = isEquipped(item.id);
    const isCard = item.id.startsWith('card-');

    const preview = isCard
      ? `<div class="skin-preview-card" style="background:${escapeHtml(item.preview)}">🃏</div>`
      : `<span class="skin-preview-bell">🔔</span>`;

    const lockBadge = !owned
      ? (item.unlockType === 'achievement'
          ? `<div style="font-size:10px;color:#6366f1;margin-top:2px">🏆 업적</div>`
          : `<div style="font-size:10px;color:#f59e0b;margin-top:2px">🛒 ${item.price}원</div>`)
      : '';

    return `
      <div class="skin-item${equipped ? ' equipped' : ''}${!owned ? ' locked' : ''}"
           data-skin-id="${escapeHtml(item.id)}"
           data-skin-type="${isCard ? 'card' : 'bell'}"
           title="${escapeHtml(item.name)}">
        ${preview}
        <div style="font-size:11px;margin-top:2px">${escapeHtml(item.name)}</div>
        ${lockBadge}
      </div>`;
  }

  function render(data) {
    _data = data;
    const panel = document.getElementById('panel-cosmetics');
    if (!panel) return;

    if (!TDAuth.isLoggedIn) {
      panel.innerHTML = `
        <div class="cosmetics-panel text-center py-4 text-muted">
          <div style="font-size:2rem">🎨</div>
          <div class="mt-2">로그인 후 코스메틱을 이용할 수 있습니다.</div>
        </div>`;
      return;
    }

    const cards = (data.catalog.cards || []).map(renderSkinCard).join('');
    const bells = (data.catalog.bells || []).map(renderSkinCard).join('');

    panel.innerHTML = `
      <div class="cosmetics-panel">
        <div class="mb-3">
          <div class="fw-semibold mb-1" style="font-size:0.85rem">🃏 카드 뒷면 스킨</div>
          <div class="skin-grid">${cards}</div>
        </div>
        <div class="mb-3">
          <div class="fw-semibold mb-1" style="font-size:0.85rem">🔔 벨 스킨</div>
          <div class="skin-grid">${bells}</div>
        </div>
        <div class="mt-3 text-muted" style="font-size:0.75rem">
          🏆 업적 달성 시 무료 해금 · 🛒 상점에서 구매 가능
        </div>
        <hr class="my-2">
        <div class="fw-semibold mb-2" style="font-size:0.85rem">🛒 상점</div>
        <div id="shopItemsContainer"></div>
      </div>`;

    // 스킨 이벤트 바인딩
    panel.querySelectorAll('.skin-item:not(.locked)').forEach(el => {
      if (window.TDTouch) {
        TDTouch.addFastClick(el, () => handleEquip(el));
      } else {
        el.addEventListener('click', () => handleEquip(el));
      }
    });

    // 상점 섹션 렌더링
    const shopContainer = document.getElementById('shopItemsContainer');
    if (shopContainer && window.TDShop) {
      TDShop.renderInPanel(shopContainer, data.owned || []);
    }
  }

  // ── 장착 처리 ──────────────────────────────────────────────────────────────

  async function handleEquip(el) {
    const skinId = el.dataset.skinId;
    const skinType = el.dataset.skinType;
    if (!skinId || !skinType) return;
    if (isEquipped(skinId)) return; // 이미 장착됨

    try {
      const res = await fetch('/api/cosmetics/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: skinType, skinId }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.warn('[Cosmetics] 장착 실패:', err.error);
        return;
      }

      // 로컬 상태 업데이트
      if (skinType === 'card') {
        _data.equipped.card = skinId;
        applyCardSkin(skinId);
      } else {
        _data.equipped.bell = skinId;
        TDAuth.applyBellSkin(skinId);
      }

      // UI 재렌더링
      render(_data);

      // 토스트 알림
      if (window.TDRetention) {
        const name = [...(_data.catalog.cards || []), ...(_data.catalog.bells || [])]
          .find(i => i.id === skinId)?.name || skinId;
        TDRetention.showToast([{ title: name, description: '장착 완료!' }], 'equip');
      }
    } catch (err) {
      console.error('[Cosmetics] 장착 오류:', err);
    }
  }

  // ── 카드 스킨 적용 ─────────────────────────────────────────────────────────

  function applyCardSkin(skinId) {
    // 게임보드의 모든 .card-back 요소에 스킨 클래스 적용
    const skinClasses = ['card-skin-ocean', 'card-skin-sunset', 'card-skin-forest', 'card-skin-midnight'];
    const gameBoard = document.getElementById('gameBoard');
    const target = gameBoard || document.body;

    skinClasses.forEach(c => target.classList.remove(c));

    if (skinId && skinId !== 'card-default') {
      const cls = skinId.replace('card-', 'card-skin-');
      target.classList.add(cls);
    }
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────────

  async function init() {
    if (!TDAuth.isLoggedIn) {
      // 미로그인: 탭 패널에 로그인 안내 표시
      render({ owned: [], equipped: { card: 'card-default', bell: 'bell-gold' }, catalog: { cards: [], bells: [] } });
      return;
    }
    // 이미 auth.js에서 로드된 경우 재사용
    if (TDAuth.cosmetics) {
      render(TDAuth.cosmetics);
      applyCardSkin(TDAuth.cosmetics.equipped.card);
      return;
    }
    try {
      const res = await fetch('/api/cosmetics');
      const data = await res.json();
      render(data);
      applyCardSkin(data.equipped.card);
    } catch (err) {
      console.warn('[Cosmetics] 로드 실패:', err);
    }
  }

  return {
    init,
    render,
    applyCardSkin,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // auth.js init 이후 실행되도록 짧게 지연
  setTimeout(() => TDCosmetics.init(), 200);
});
