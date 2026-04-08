/**
 * 클라이언트 설정 파일
 * 환경에 따라 서버 URL을 자동으로 설정합니다.
 */

const ENV_SOCKET_URL = typeof window !== 'undefined' ? window.__TOUCHDOWN_SOCKET_URL__ : '';

const ClientConfig = {
  /**
   * 환경 감지 및 서버 URL 설정
   * @returns {string} 서버 URL
   */
  getServerUrl() {
    if (ENV_SOCKET_URL) {
      return ENV_SOCKET_URL;
    }
    // 현재 호스트 확인
    const { hostname, protocol } = window.location;
    
    // 로컬 개발 환경
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//localhost:3000`;
    }
    
    // Docker 환경
    if (hostname.includes('docker')) {
      return `${protocol}//${hostname}:3000`;
    }
    
    // 프로덕션 환경 (실제 도메인)
    // 여기에 실제 프로덕션 서버 URL을 설정하세요
    // return 'https://your-production-server.com';
    
    // 기본값: 현재 페이지의 origin 사용
    return window.location.origin;
  },

  /**
   * 수동으로 서버 URL 설정
   * @param {string} url - 서버 URL
   */
  setServerUrl(url) {
    this.customServerUrl = url;
  },

  /**
   * 최종 서버 URL 반환
   * @returns {string} 서버 URL
   */
  get serverUrl() {
    return this.customServerUrl || this.getServerUrl();
  },

  /**
   * Socket.IO 옵션
   */
  socketOptions: {
    // 재연결 설정
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    
    // 타임아웃 설정
    timeout: 10000,
    
    // 전송 방식
    transports: ['websocket', 'polling']
  },

  /**
   * 디버그 모드 (개발 환경에서만 true)
   */
  get debug() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  }
};

// 디버그 정보 출력
if (ClientConfig.debug) {
  console.log('[Config] 서버 URL:', ClientConfig.serverUrl);
  console.log('[Config] Socket 옵션:', ClientConfig.socketOptions);
}

// ── Google AdSense 초기화 ──────────────────────────────────────────────────────

const TDAds = (function () {
  'use strict';

  const publisherId = (typeof window !== 'undefined' && window.__ADSENSE_PUBLISHER_ID__) || '';
  let _initialized = false;

  /**
   * AdSense 스크립트 동적 삽입 (publisher ID 설정 시)
   */
  function init() {
    if (!publisherId || _initialized) return;
    _initialized = true;

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    document.head.appendChild(script);
  }

  /**
   * 특정 컨테이너에 AdSense 광고 유닛 렌더링
   * @param {string} containerId - 컨테이너 엘리먼트 ID
   * @param {string} adSlot     - AdSense 광고 슬롯 ID (env에서 설정 가능)
   * @param {'auto'|'rectangle'} format
   */
  function renderAd(containerId, adSlot, format) {
    if (!publisherId) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = `
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="${publisherId}"
           data-ad-slot="${adSlot || 'auto'}"
           data-ad-format="${format || 'auto'}"
           data-full-width-responsive="true"></ins>`;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // AdSense 스크립트 미로드 상태에서의 오류 무시
    }
  }

  return {
    publisherId,
    init,
    renderAd,
    get enabled() { return !!publisherId; },
  };
})();

// 로비 배너 광고 (페이지 로드 시)
document.addEventListener('DOMContentLoaded', () => {
  TDAds.init();
  // 로비 배너
  TDAds.renderAd('adLobbyBanner', window.__ADSENSE_LOBBY_SLOT__ || '', 'horizontal');
});
