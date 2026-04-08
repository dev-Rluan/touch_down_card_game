/**
 * touch.js — 터치 이벤트 최적화 유틸리티
 *
 * 문제: 모바일 브라우저는 click 이벤트에 300ms 지연을 추가합니다.
 * 해결: touchstart/touchend를 감지해 즉시 콜백을 실행합니다.
 *
 * 사용법:
 *   addFastClick(element, handler);       // 단일 요소
 *   addFastClick(element, handler, true); // 이동 시 취소 (스와이프 방지)
 */

(function () {
  'use strict';

  /**
   * 터치 디바이스 여부 판단
   */
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  /**
   * 햅틱 피드백 (지원하는 디바이스에서만)
   * @param {'light'|'medium'|'heavy'} type
   */
  function vibrate(type) {
    if (!navigator.vibrate) return;
    const patterns = { light: [10], medium: [20], heavy: [40] };
    navigator.vibrate(patterns[type] || [10]);
  }

  /**
   * 요소에 빠른 탭 핸들러 등록
   * - 터치 디바이스: touchend에서 즉시 실행 + preventDefault로 click 이벤트 억제
   * - 비터치: 일반 click 이벤트
   *
   * @param {HTMLElement} el
   * @param {Function} handler
   * @param {boolean} cancelOnMove - 손가락을 움직이면 취소 (기본 true)
   */
  function addFastClick(el, handler, cancelOnMove = true) {
    if (!el) return;

    if (!isTouchDevice) {
      el.addEventListener('click', handler);
      return;
    }

    let startX = 0;
    let startY = 0;
    let moved = false;

    el.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      moved = false;
      el.classList.add('touch-active');
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (cancelOnMove) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) moved = true;
      }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      el.classList.remove('touch-active');
      if (moved) return;
      e.preventDefault(); // 300ms click 이벤트 억제
      handler(e);
    });

    // 터치가 취소된 경우 (전화 수신 등)
    el.addEventListener('touchcancel', () => {
      el.classList.remove('touch-active');
    });
  }

  /**
   * 벨 버튼 전용 빠른 탭 — 햅틱 피드백 포함
   * @param {HTMLElement} el
   * @param {Function} handler
   */
  function addBellFastClick(el, handler) {
    addFastClick(el, (e) => {
      vibrate('medium');
      handler(e);
    }, false); // 벨은 이동 취소 없이 즉시 반응
  }

  /**
   * 기존 onclick을 Fast Click으로 업그레이드
   * @param {string} selector
   * @param {Function} handler
   */
  function upgradeFastClick(selector, handler) {
    const el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!el) return;
    // 기존 onclick 제거
    el.onclick = null;
    addFastClick(el, handler);
  }

  // 전역 공개
  window.TDTouch = { addFastClick, addBellFastClick, upgradeFastClick, vibrate, isTouchDevice };
})();
