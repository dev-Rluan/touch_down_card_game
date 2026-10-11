import React, { useState, useEffect, useRef } from 'react';
import { THEMES, getSavedTheme, applyTheme } from '../theme/themes.js';

export default function ThemePicker() {
  const [current, setCurrent] = useState(getSavedTheme);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(id) {
    applyTheme(id);
    setCurrent(id);
    setOpen(false);
  }

  const active = THEMES.find(t => t.id === current) || THEMES[0];

  return (
    <div className="theme-picker" ref={wrapRef}>
      <button
        type="button"
        className="theme-picker-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="색 테마 선택"
        aria-expanded={open}
        title="색 테마"
      >
        <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${active.bg} 50%, ${active.accent} 50%)` }} />
      </button>
      {open && (
        <div className="theme-picker-menu" role="menu">
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === current}
              className={`theme-option ${t.id === current ? 'selected' : ''}`}
              onClick={() => choose(t.id)}
            >
              <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
