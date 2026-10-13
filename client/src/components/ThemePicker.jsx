import React, { useState, useEffect, useRef } from 'react';
import { THEMES, getSavedTheme, applyTheme } from '../theme/themes.js';
import { FX_STYLES, getFxStyle, setFxStyle } from '../fx/style.js';
import { playSound, unlockAudio } from '../fx/sound.js';

export default function ThemePicker() {
  const [current, setCurrent] = useState(getSavedTheme);
  const [open, setOpen] = useState(false);
  const [fxStyle, setFxStyleState] = useState(getFxStyle);
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

  function chooseFx(id) {
    setFxStyle(id);
    setFxStyleState(id);
    unlockAudio();
    playSound('bellSuccess'); // 고른 스타일의 소리를 바로 들려준다
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
          <div className="theme-menu-divider" role="separator" />
          <div className="theme-menu-label">이펙트·소리</div>
          {FX_STYLES.map(st => (
            <button
              key={st.id}
              type="button"
              role="menuitemradio"
              aria-checked={st.id === fxStyle}
              className={`theme-option ${st.id === fxStyle ? 'selected' : ''}`}
              onClick={() => chooseFx(st.id)}
            >
              <span className={`fx-style-dot fx-style-${st.id}`} aria-hidden="true" />
              <span>{st.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
