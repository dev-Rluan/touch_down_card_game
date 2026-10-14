import React, { useEffect, useState } from 'react';
import { getPing, subscribePing } from '../net/clock.js';

// 내 네트워크 지연 표시: 막대 3칸 + ms (좋음 <80, 보통 <150, 나쁨)
export function pingLevel(ms) {
  if (ms == null) return 'unknown';
  if (ms < 80) return 'good';
  if (ms < 150) return 'ok';
  return 'bad';
}

export default function PingBadge() {
  const [ping, setPing] = useState(getPing());
  useEffect(() => subscribePing(v => setPing(v == null ? null : Math.round(v))), []);

  const level = pingLevel(ping);
  const bars = { good: 3, ok: 2, bad: 1, unknown: 0 }[level];
  return (
    <span className={`ping-badge ping-${level}`} title="서버까지 왕복 지연 시간" aria-label={ping == null ? '핑 측정 중' : `핑 ${ping}밀리초`}>
      <span className="ping-bars" aria-hidden="true">
        {[1, 2, 3].map(i => <i key={i} className={i <= bars ? 'on' : ''} />)}
      </span>
      {ping == null ? '…' : `${ping}ms`}
    </span>
  );
}
