import React from 'react';

// 외부 아이콘 폰트(Ionicons CDN) 대신 쓰는 인라인 SVG 아이콘 — 요청/폰트 다운로드 없음
const PATHS = {
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6" /><circle cx="17" cy="9" r="2.8" /><path d="M17.5 14.2c2.6.3 4.5 2.1 4.5 5.3" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>,
  'log-in': <><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" /><path d="M9 12h11" /><path d="m16 8 4 4-4 4" /></>,
  'log-out': <><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" /><path d="M4 12h11" /><path d="m8 8-4 4 4 4" /></>,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>,
  pause: <><path d="M9 5v14" /><path d="M15 5v14" /></>,
  checkmark: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  chat: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />,
  send: <><path d="M4 12 20 4l-5 16-3-7z" /><path d="m12 13 8-9" /></>,
};

export default function Icon({ name, size = '1em', className = '', style }) {
  return (
    <svg
      className={`icon-svg ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}
