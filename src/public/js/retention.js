/**
 * retention.js — 랭킹 / 업적 / 일일 미션 UI 모듈
 *
 * 의존성: Bootstrap 5 탭, TDAuth (auth.js)
 */
window.TDRetention = (function () {
  'use strict';

  // ── DOM 참조 ────────────────────────────────────────────────────────────────
  const rankingList   = document.getElementById('rankingList');
  const myRankBadge   = document.getElementById('myRankBadge');
  const achieveList   = document.getElementById('achievementList');
  const missionList   = document.getElementById('missionList');
  const rankPeriod    = document.getElementById('rankPeriod');
  const rankType      = document.getElementById('rankType');

  // ── 유틸 ────────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── 랭킹 ────────────────────────────────────────────────────────────────────
  async function loadRanking() {
    if (!rankingList) return;
    const period = rankPeriod?.value || 'alltime';
    const type   = rankType?.value   || 'score';

    rankingList.innerHTML = '<div class="text-center text-muted py-2">불러오는 중...</div>';
    myRankBadge.textContent = '';

    try {
      const res  = await fetch(`/api/leaderboard?period=${period}&type=${type}&limit=20`);
      const data = await res.json();

      if (!data.leaderboard || data.leaderboard.length === 0) {
        rankingList.innerHTML = '<div class="text-muted text-center py-2">아직 기록이 없습니다.</div>';
        return;
      }

      const typeLabel = type === 'wins' ? '승' : '점';
      rankingList.innerHTML = data.leaderboard.map((row) => {
        const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `${row.rank}.`;
        const avatarHtml = row.avatar
          ? `<img src="${escHtml(row.avatar)}" class="rounded-circle me-1" width="20" height="20" style="object-fit:cover">`
          : '';
        return `<div class="d-flex align-items-center justify-content-between py-1 border-bottom">
          <span>${medal} ${avatarHtml}${escHtml(row.displayName)}</span>
          <span class="badge bg-primary">${row.score.toLocaleString()}${typeLabel}</span>
        </div>`;
      }).join('');

      // 내 순위 표시 (로그인 상태일 때)
      if (window.TDAuth?.isLoggedIn) {
        const myRes  = await fetch(`/api/leaderboard/me?period=${period}`);
        const myData = await myRes.json();
        if (myData.rank) {
          myRankBadge.textContent = `내 순위: ${myData.rank}위 · ${myData.score.toLocaleString()}점`;
        } else {
          myRankBadge.textContent = '아직 순위가 없습니다. 게임을 플레이하세요!';
        }
      }
    } catch (err) {
      rankingList.innerHTML = '<div class="text-danger small">랭킹 로드 실패</div>';
    }
  }

  // ── 업적 ────────────────────────────────────────────────────────────────────
  async function loadAchievements() {
    if (!achieveList) return;

    if (!window.TDAuth?.isLoggedIn) {
      achieveList.innerHTML = '<div class="text-muted text-center py-2">로그인 후 확인 가능합니다.</div>';
      return;
    }

    achieveList.innerHTML = '<div class="text-center text-muted py-2">불러오는 중...</div>';
    try {
      const res  = await fetch('/api/achievements');
      const data = await res.json();

      achieveList.innerHTML = data.achievements.map((ach) => {
        const pct = Math.round(ach.progress * 100);
        const badgeClass = ach.unlocked ? 'bg-success' : 'bg-secondary';
        return `<div class="mb-2">
          <div class="d-flex justify-content-between align-items-center">
            <span>${ach.icon} <strong>${escHtml(ach.title)}</strong>
              <span class="badge ${badgeClass} ms-1">${ach.unlocked ? '달성' : `${ach.current}/${ach.threshold}`}</span>
            </span>
          </div>
          <div class="text-muted" style="font-size:0.78rem">${escHtml(ach.description)}</div>
          ${!ach.unlocked ? `<div class="progress mt-1" style="height:4px">
            <div class="progress-bar" style="width:${pct}%"></div>
          </div>` : ''}
        </div>`;
      }).join('');
    } catch {
      achieveList.innerHTML = '<div class="text-danger small">업적 로드 실패</div>';
    }
  }

  // ── 일일 미션 ─────────────────────────────────────────────────────────────────
  async function loadMissions() {
    if (!missionList) return;
    missionList.innerHTML = '<div class="text-center text-muted py-2">불러오는 중...</div>';
    try {
      const res  = await fetch('/api/missions');
      const data = await res.json();

      const header = `<div class="text-muted small mb-2">
        오늘의 미션 ${data.completedCount}/${data.totalCount} 완료
      </div>`;

      const items = data.missions.map((m) => {
        const pct = Math.round(Math.min(m.current / m.goal, 1) * 100);
        const doneClass = m.completed ? 'text-decoration-line-through text-muted' : '';
        return `<div class="mb-2">
          <div class="d-flex justify-content-between align-items-center">
            <span class="${doneClass}">${m.icon} ${escHtml(m.title)}</span>
            <span class="badge ${m.completed ? 'bg-success' : 'bg-secondary'}">${m.completed ? '완료' : `${m.current}/${m.goal}`}</span>
          </div>
          <div class="text-muted" style="font-size:0.78rem">${escHtml(m.description)} · ${escHtml(m.reward)}</div>
          ${!m.completed ? `<div class="progress mt-1" style="height:4px">
            <div class="progress-bar bg-warning" style="width:${pct}%"></div>
          </div>` : ''}
        </div>`;
      }).join('');

      missionList.innerHTML = header + items;
    } catch {
      missionList.innerHTML = '<div class="text-danger small">미션 로드 실패</div>';
    }
  }

  // ── 알림 토스트 ──────────────────────────────────────────────────────────────
  function showToast(items, type) {
    if (!items || items.length === 0) return;
    items.forEach((item) => {
      const msg = type === 'achievement'
        ? `🎖️ 업적 달성: ${item.icon} ${item.title}`
        : `✅ 미션 완료: ${item.icon} ${item.title} (${item.reward})`;

      const el = document.createElement('div');
      el.className = 'toast align-items-center text-bg-success border-0 show';
      el.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:9999;min-width:260px;';
      el.innerHTML = `<div class="d-flex">
        <div class="toast-body fw-bold">${msg}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    });
  }

  // ── Socket 이벤트 수신 (app.js에서 socket 전달) ──────────────────────────────
  function bindSocket(socket) {
    socket.on('achievementsUnlocked', (achievements) => {
      showToast(achievements, 'achievement');
      // 탭이 열려 있으면 새로고침
      if (document.getElementById('panel-achievements')?.classList.contains('show')) {
        loadAchievements();
      }
    });
    socket.on('missionsCompleted', (missions) => {
      showToast(missions, 'mission');
      if (document.getElementById('panel-missions')?.classList.contains('show')) {
        loadMissions();
      }
    });
  }

  // ── 초기화 ──────────────────────────────────────────────────────────────────
  function init() {
    // 필터 변경 시 자동 새로고침
    rankPeriod?.addEventListener('change', loadRanking);
    rankType?.addEventListener('change', loadRanking);

    // 탭 전환 시 해당 패널 데이터 로드
    document.getElementById('tab-ranking')?.addEventListener('shown.bs.tab', loadRanking);
    document.getElementById('tab-achievements')?.addEventListener('shown.bs.tab', loadAchievements);
    document.getElementById('tab-missions')?.addEventListener('shown.bs.tab', loadMissions);

    // 초기 로드 (랭킹 탭이 기본 활성)
    loadRanking();
    loadMissions();
  }

  return { init, loadRanking, loadAchievements, loadMissions, bindSocket };
})();

document.addEventListener('DOMContentLoaded', () => {
  // auth.js init 완료 후 실행되도록 약간 지연
  setTimeout(() => TDRetention.init(), 200);
});
