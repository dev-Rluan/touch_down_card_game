/**
 * auth.js — OAuth 로그인 상태 관리 클라이언트 모듈
 *
 * 역할:
 *  1. 페이지 로드 시 /auth/me 로 현재 로그인 상태 확인
 *  2. 내비게이션 바 #authArea 에 로그인/프로필 버튼 렌더링
 *  3. 활성화된 OAuth 제공자 목록을 /auth/providers 에서 동적으로 읽어 버튼 표시
 *  4. 로그인 성공 후 닉네임을 Socket 닉네임과 동기화
 *  5. window.TDAuth 네임스페이스로 현재 유저 정보 공유 (app.js에서 참조 가능)
 */

window.TDAuth = (function () {
  'use strict';

  let _currentUser = null; // { id, provider, displayName, email, avatar, ... } | null

  // ── DOM 참조 ────────────────────────────────────────────────────────────────

  const authArea = document.getElementById('authArea');

  // ── 렌더링 ──────────────────────────────────────────────────────────────────

  function renderLoggedIn(user) {
    const avatarHtml = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" class="rounded-circle" width="28" height="28" style="object-fit:cover" alt="avatar">`
      : `<i class="icon ion-person-stalker text-light" style="font-size:1.2rem"></i>`;

    authArea.innerHTML = `
      <span class="text-light small d-none d-md-inline">${escapeHtml(user.displayName)}</span>
      ${avatarHtml}
      <a href="/auth/logout" class="btn btn-sm btn-outline-light ms-1">로그아웃</a>
    `;
  }

  function renderLoggedOut(providers) {
    const buttons = providers.map((p) => {
      const label = p === 'google' ? '<i class="icon ion-social-google"></i> Google' : '<i class="icon ion-social-buffer"></i> Kakao';
      const cls = p === 'google' ? 'btn-light' : 'btn-warning';
      return `<a href="/auth/${p}" class="btn btn-sm ${cls}">${label}</a>`;
    });

    if (buttons.length === 0) {
      authArea.innerHTML = ''; // 키 미설정 시 버튼 없이 게스트 전용
      return;
    }

    authArea.innerHTML = `
      <span class="text-light small d-none d-md-inline opacity-75">로그인</span>
      ${buttons.join('')}
    `;
  }

  // ── 초기화 ──────────────────────────────────────────────────────────────────

  async function init() {
    try {
      const [meRes, providersRes] = await Promise.all([
        fetch('/auth/me'),
        fetch('/auth/providers'),
      ]);

      const meData = await meRes.json();
      const providersData = await providersRes.json();
      const providers = providersData.providers || [];

      if (meData.loggedIn && meData.user) {
        _currentUser = meData.user;
        renderLoggedIn(_currentUser);
        // 로그인 성공 알림 쿼리 파라미터 처리
        const params = new URLSearchParams(location.search);
        if (params.get('auth_success')) {
          history.replaceState({}, '', '/');
        }
      } else {
        _currentUser = null;
        renderLoggedOut(providers);
        // 로그인 실패 알림
        const params = new URLSearchParams(location.search);
        if (params.get('auth_error')) {
          const provider = params.get('auth_error');
          console.warn(`[Auth] ${provider} 로그인 실패`);
          history.replaceState({}, '', '/');
        }
      }
    } catch (err) {
      console.warn('[Auth] 인증 상태 확인 실패 (게스트로 진행):', err.message);
      _currentUser = null;
    }
  }

  // ── 유틸 ────────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── 공개 API ─────────────────────────────────────────────────────────────────

  return {
    /** 현재 로그인 사용자 정보 (미로그인 시 null) */
    get currentUser() {
      return _currentUser;
    },

    /** 로그인 여부 */
    get isLoggedIn() {
      return _currentUser !== null;
    },

    /**
     * 로그인 사용자의 닉네임 변경
     * app.js의 닉네임 변경과 동기화해서 사용
     */
    async updateDisplayName(newName) {
      if (!_currentUser) return { success: false, error: '로그인이 필요합니다.' };
      try {
        const res = await fetch('/auth/me/name', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });
        const data = await res.json();
        if (data.success) {
          _currentUser.displayName = data.displayName;
          renderLoggedIn(_currentUser);
        }
        return data;
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    init,
  };
})();

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', () => {
  TDAuth.init();
});
