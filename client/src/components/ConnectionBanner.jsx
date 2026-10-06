import React from 'react';

/**
 * 접속 이후 서버 연결이 끊겼을 때 화면 상단에 표시되는 배너
 */
export default function ConnectionBanner({ lost, failed }) {
  if (!lost && !failed) return null;

  return (
    <div className={`connection-banner ${failed ? 'failed' : ''}`} role="status">
      {failed ? (
        <>
          <span>서버에 다시 연결할 수 없습니다.</span>
          <button type="button" className="btn btn-sm btn-light ms-2" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </>
      ) : (
        <>
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          <span>연결이 끊겼습니다. 재연결 중...</span>
        </>
      )}
    </div>
  );
}
