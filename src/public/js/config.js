/**
 * 클라이언트 설정 파일
 * 환경에 따라 서버 URL을 자동으로 설정합니다.
 */

const ClientConfig = {
  /**
   * 환경 감지 및 서버 URL 설정
   * @returns {string} 서버 URL
   */
  getServerUrl() {
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

