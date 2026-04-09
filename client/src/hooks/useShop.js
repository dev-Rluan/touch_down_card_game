import { useState, useEffect, useCallback } from 'react';

export default function useShop() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/shop/items')
      .then(r => r.json())
      .then(data => { setItems(data.items || data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const purchase = useCallback(async (itemId) => {
    const clientKey = window.__TOSS_CLIENT_KEY__;
    if (!clientKey) {
      alert('결제 서비스가 설정되지 않았습니다.');
      return;
    }
    try {
      const res = await fetch('/api/shop/purchase/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) { alert('결제 초기화 실패'); return; }
      const { orderId, amount, orderName } = await res.json();

      // Toss Payments SDK 동적 로드
      await loadTossSDK();
      const toss = window.TossPayments(clientKey);
      const payment = toss.payment({ customerKey: 'guest_' + Date.now() });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: window.location.origin + '/api/shop/purchase/confirm',
        failUrl: window.location.origin + '/',
      });
    } catch (err) {
      console.error('[Shop] 결제 오류:', err);
    }
  }, []);

  return { items, purchase, loading };
}

function loadTossSDK() {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
