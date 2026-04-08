/**
 * shop.js — 상점 UI 모듈 (Toss Payments 연동)
 *
 * 역할:
 *  1. /api/shop/items 에서 상품 목록 로드
 *  2. 코스메틱 탭의 상점 섹션 렌더링
 *  3. Toss Payments JS SDK로 결제창 오픈
 *  4. 결제 완료 후 /api/shop/purchase/confirm 호출
 *  5. 성공 시 코스메틱 자동 반영
 *
 * 의존:
 *  - window.TDAuth (auth.js)
 *  - window.TDCosmetics (cosmetics.js)
 *  - window.TDRetention (retention.js) — 토스트 알림용
 */

window.TDShop = (function () {
  'use strict';

  const TOSS_SDK_URL = 'https://js.tosspayments.com/v2/standard';
  const tossClientKey = (typeof window !== 'undefined' && window.__TOSS_CLIENT_KEY__) || '';

  let _items = [];
  let _tossPayments = null;

  // ── Toss SDK 로드 ───────────────────────────────────────────────────────────

  function loadTossSDK() {
    if (!tossClientKey) return Promise.resolve(null);
    if (window.TossPayments) return Promise.resolve(window.TossPayments);

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TOSS_SDK_URL;
      script.onload = () => resolve(window.TossPayments);
      script.onerror = () => reject(new Error('Toss SDK 로드 실패'));
      document.head.appendChild(script);
    });
  }

  // ── 렌더링 ──────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderShopItems(container, ownedList) {
    if (!_items.length) {
      container.innerHTML = '<div class="text-muted small text-center py-2">판매 중인 상품이 없습니다.</div>';
      return;
    }

    const html = _items.map(item => {
      const owned = ownedList.includes(item.id);
      return `
        <div class="shop-item">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size:1.5rem;width:32px;text-align:center">
              ${item.type === 'card_skin' ? '🃏' : '🔔'}
            </span>
            <div>
              <div class="fw-semibold" style="font-size:0.85rem">${escapeHtml(item.name)}</div>
              <div class="text-muted" style="font-size:0.75rem">${escapeHtml(item.description)}</div>
            </div>
          </div>
          ${owned
            ? '<span class="price-badge free">보유 중</span>'
            : `<button class="price-badge btn p-0 border-0"
                       style="background:var(--primary-color);color:white;border-radius:999px;padding:0.2rem 0.6rem;font-size:0.75rem;font-weight:600;cursor:pointer"
                       data-item-id="${escapeHtml(item.id)}"
                       data-item-name="${escapeHtml(item.name)}"
                       data-item-price="${item.price}">
                ${item.price.toLocaleString()}원
               </button>`
          }
        </div>`;
    }).join('');

    container.innerHTML = html;

    // 구매 버튼 이벤트 바인딩
    container.querySelectorAll('button[data-item-id]').forEach(btn => {
      const handler = () => handlePurchase(btn.dataset.itemId, btn.dataset.itemName, parseInt(btn.dataset.itemPrice, 10));
      if (window.TDTouch) TDTouch.addFastClick(btn, handler);
      else btn.addEventListener('click', handler);
    });
  }

  // ── 구매 처리 ───────────────────────────────────────────────────────────────

  async function handlePurchase(itemId, itemName, price) {
    if (!TDAuth.isLoggedIn) {
      alert('로그인 후 구매할 수 있습니다.');
      return;
    }

    if (!tossClientKey) {
      alert('결제 시스템이 준비되지 않았습니다.\n관리자에게 문의하세요.');
      return;
    }

    try {
      // 1. 주문 생성
      const orderRes = await fetch('/api/shop/purchase/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(err.error || '주문 생성에 실패했습니다.');
        return;
      }
      const { orderId, orderName, amount } = await orderRes.json();

      // 2. Toss SDK 초기화 (lazy load)
      if (!_tossPayments) {
        const TossPayments = await loadTossSDK();
        if (!TossPayments) {
          alert('결제 모듈을 불러올 수 없습니다.');
          return;
        }
        _tossPayments = TossPayments(tossClientKey);
      }

      // 3. 결제창 오픈
      const payment = _tossPayments.payment({ customerKey: TDAuth.currentUser.id });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/api/shop/purchase/success?orderId=${orderId}`,
        failUrl: `${window.location.origin}/api/shop/purchase/fail`,
      });

    } catch (err) {
      if (err.code === 'USER_CANCEL') return; // 사용자 취소 — 무시
      console.error('[Shop] 결제 오류:', err);
      alert(err.message || '결제 중 오류가 발생했습니다.');
    }
  }

  /**
   * 결제 성공 콜백 처리 (successUrl 리다이렉트 없이 인앱 처리 시)
   * Toss successUrl이 서버 측 redirect를 사용하는 경우 이 함수는 건너뜁니다.
   */
  async function handleSuccess(orderId, paymentKey, amount) {
    try {
      const res = await fetch('/api/shop/purchase/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentKey, amount: parseInt(amount, 10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 코스메틱 새로고침
      if (window.TDCosmetics) {
        fetch('/api/cosmetics').then(r => r.json()).then(d => {
          TDCosmetics.render(d);
          TDCosmetics.applyCardSkin(d.equipped.card);
          if (TDAuth.applyBellSkin) TDAuth.applyBellSkin(d.equipped.bell);
        });
      }

      if (window.TDRetention) {
        TDRetention.showToast([{ title: '구매 완료!', description: '코스메틱이 지급되었습니다.' }], 'equip');
      }

      return data;
    } catch (err) {
      console.error('[Shop] 승인 오류:', err);
      throw err;
    }
  }

  // ── 초기화 ──────────────────────────────────────────────────────────────────

  async function init() {
    // URL 파라미터 확인 (서버 리다이렉트 처리)
    const params = new URLSearchParams(location.search);
    if (params.get('payment_success')) {
      history.replaceState({}, '', '/');
      // 서버 측에서 이미 승인 완료 → 코스메틱 새로고침만
      setTimeout(() => {
        if (window.TDCosmetics) {
          fetch('/api/cosmetics').then(r => r.json()).then(d => {
            TDCosmetics.render(d);
            TDCosmetics.applyCardSkin(d.equipped.card);
            if (TDAuth && TDAuth.applyBellSkin) TDAuth.applyBellSkin(d.equipped.bell);
          });
        }
        if (window.TDRetention) {
          TDRetention.showToast([{ title: '구매 완료!', description: '코스메틱이 지급되었습니다.' }], 'equip');
        }
      }, 500);
    } else if (params.get('payment_error')) {
      const errMsg = decodeURIComponent(params.get('payment_error'));
      history.replaceState({}, '', '/');
      if (errMsg && errMsg !== '결제가 취소되었습니다.') {
        console.warn('[Shop] 결제 오류:', errMsg);
      }
    }

    // 상품 목록 로드
    try {
      const res = await fetch('/api/shop/items');
      const data = await res.json();
      _items = data.items || [];
    } catch (e) {
      console.warn('[Shop] 상품 목록 로드 실패:', e);
    }
  }

  /**
   * 코스메틱 패널 내 상점 섹션 렌더링
   * @param {string[]} ownedList - 이미 보유한 아이템 ID 배열
   * @param {HTMLElement} container - 렌더링 대상 컨테이너
   */
  function renderInPanel(container, ownedList) {
    renderShopItems(container, ownedList || []);
  }

  return {
    init,
    renderInPanel,
    handleSuccess,
    get items() { return _items; },
    get enabled() { return !!tossClientKey; },
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  TDShop.init();
});
