import React, { useEffect, useRef } from 'react';

export default function AdBanner({ slot, format = 'auto', className = '' }) {
  const ref = useRef(null);
  const publisherId = window.__ADSENSE_PUBLISHER_ID__;

  useEffect(() => {
    if (!publisherId || !slot || !ref.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }, [publisherId, slot]);

  if (!publisherId || !slot) return null;

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
