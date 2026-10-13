import React from 'react';

// ── 게임 방법 (PC 에서는 방 목록 오른쪽, 모바일에서는 아래) ──────────────────────

export default function HowToPlay({ className = '' }) {
  return (
    <div className={`howto card game-card ${className}`}>
      <div className="card-header">
        <h5 className="card-title mb-0">게임 방법</h5>
      </div>
      <ol className="howto-list card-body mb-0">
        <li>차례대로 <b>내 덱</b>을 눌러 카드를 한 장씩 펼칩니다.</li>
        <li>펼쳐진 카드 중 <b>같은 과일이 딱 5개</b>가 되면 누구든 <b>TOUCH DOWN</b>을 누르세요.</li>
        <li>가장 먼저 맞게 누르면 펼쳐진 카드를 <b>모두 가져갑니다</b>.</li>
        <li>틀리게 누르면 카드 <b>1장</b>을 잃습니다.</li>
        <li>한 명만 카드가 남으면 끝! <b>카드가 가장 많은 사람</b>이 이깁니다.</li>
      </ol>
    </div>
  );
}
