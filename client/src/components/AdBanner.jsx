import React, { useEffect, useRef } from 'react';

const PUBLISHER_ID_PATTERN = /^ca-pub-\d{10,20}$/;

// 광고 스크립트는 게시자 ID 가 설정된 경우에만, 한 번만 로드한다 (무광고 모드에서는 외부 요청 없음)
function loadAdsScript(publisherId) {
  if (document.querySelector('script[data-adsbygoogle-loader]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-adsbygoogle-loader', '1');
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  document.head.appendChild(script);
}

export default function AdBanner({ slot, format = 'auto', className = '' }) {
  const ref = useRef(null);
  const publisherId = window.__ADSENSE_PUBLISHER_ID__;

  useEffect(() => {
    if (!publisherId || !slot || !ref.current) return;
    if (!PUBLISHER_ID_PATTERN.test(publisherId)) return;
    loadAdsScript(publisherId);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }, [publisherId, slot]);

  if (!publisherId || !slot || !PUBLISHER_ID_PATTERN.test(publisherId)) return null;

  return (
    <div className={`ad-banner-container ${className}`} ref={ref}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
