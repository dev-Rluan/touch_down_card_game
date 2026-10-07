import React, { useEffect, useRef, useState } from 'react';
import { THEMES, getStoredTheme, saveTheme } from '../theme.js';

export default function ThemePicker({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getStoredTheme);
  const rootRef = useRef(null);

  // 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(id) {
    setCurrent(saveTheme(id));
    setOpen(false);
  }

  return (
    <div className={`theme-picker ${className}`} ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline-light theme-picker-toggle"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title="색 테마 변경"
      >
        <span aria-hidden="true">🎨</span>
        <span className="d-none d-md-inline ms-1">테마</span>
      </button>

      {open && (
        <div className="theme-picker-menu" role="menu" aria-label="색 테마">
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={current === t.id}
              className={`theme-option ${current === t.id ? 'active' : ''}`}
              onClick={() => choose(t.id)}
            >
              <span
                className="theme-swatch"
                style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                aria-hidden="true"
              />
              <span className="theme-option-label">{t.label}</span>
              {current === t.id && <span className="theme-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
