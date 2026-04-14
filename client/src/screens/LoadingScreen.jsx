import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import useAuth from '../hooks/useAuth.js';

export default function LoadingScreen() {
  const { state, dispatch } = useGame();
  const { providers, loading: authLoading } = useAuth();
  const [guestPending, setGuestPending] = useState(false);
  const authError = new URLSearchParams(window.location.search).get('auth_error');

  // 비회원 버튼 클릭 후 소켓 연결 완료되면 자동 진입
  useEffect(() => {
    if (guestPending && state.socketConnected) {
      dispatch({ type: 'ENTER_LOBBY' });
    }
  }, [guestPending, state.socketConnected, dispatch]);

  function handleGuest() {
    if (state.socketConnected) {
      dispatch({ type: 'ENTER_LOBBY' });
    } else {
      setGuestPending(true);
    }
  }

  return (
    <div className="intro-screen">
      {/* 배경 오버레이 */}
      <div className="intro-overlay" />

      <div className="intro-content">
        {/* 로고 */}
        <div className="intro-logo">
          <div className="intro-bell">🔔</div>
          <h1 className="intro-title">Touch Down</h1>
          <p className="intro-subtitle">온라인 할리갈리 멀티플레이어</p>
        </div>

        {/* OAuth 오류 알림 */}
        {authError && (
          <div className="alert alert-warning py-2 px-3 mb-3 small text-center" role="alert">
            {authError === 'unavailable'
              ? '로그인 서비스가 현재 준비 중입니다. 비회원으로 접속해 주세요.'
              : '로그인에 실패했습니다. 다시 시도해 주세요.'}
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="intro-actions">
          {/* 로그인 버튼 */}
          {!authLoading && providers.length > 0 && (
            <>
              {providers.includes('google') && (
                <a href="/auth/google" className="btn intro-btn intro-btn-google">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginRight: 8 }}>
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Google로 로그인
                </a>
              )}
              {providers.includes('kakao') && (
                <a href="/auth/kakao" className="btn intro-btn intro-btn-kakao">
                  <span style={{ marginRight: 8, fontSize: '1.1rem' }}>💬</span>
                  Kakao로 로그인
                </a>
              )}

              <div className="intro-divider">
                <span>또는</span>
              </div>
            </>
          )}

          {/* 비회원 접속 버튼 */}
          <button
            className="btn intro-btn intro-btn-guest"
            onClick={handleGuest}
            disabled={guestPending && !state.socketConnected}
          >
            {guestPending && !state.socketConnected ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                서버 연결 중...
              </>
            ) : (
              <>
                <i className="icon ion-person me-2" />
                비회원으로 접속
              </>
            )}
          </button>
        </div>

        {/* 연결 상태 */}
        <div className="intro-status">
          {state.connectError ? (
            <span className="text-danger small">
              <i className="icon ion-close-circle me-1" />서버 연결 실패 — 새로고침해주세요
            </span>
          ) : state.socketConnected ? (
            <span className="text-success small">
              <i className="icon ion-checkmark-circle me-1" />서버 연결됨
            </span>
          ) : (
            <span className="text-white-50 small">
              <span className="spinner-border spinner-border-sm me-1" style={{ width: '0.7rem', height: '0.7rem' }} />
              서버에 연결 중...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
