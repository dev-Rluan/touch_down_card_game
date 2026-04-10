import React, { useState, useRef } from 'react';
import { useGame } from '../context/GameContext.jsx';
import Navbar from '../components/Navbar.jsx';
import RoomList from '../components/RoomList.jsx';
import AdBanner from '../components/AdBanner.jsx';
import useRetention from '../hooks/useRetention.js';
import useCosmetics from '../hooks/useCosmetics.js';
import useShop from '../hooks/useShop.js';

// ── 게임방 탭 ────────────────────────────────────────────────────────────────

function RoomsPanel({ emit }) {
  const [roomName, setRoomName] = useState('');
  const [maxUsers, setMaxUsers] = useState(4);
  const modalRef = useRef(null);

  function handleCreateRoom(e) {
    e.preventDefault();
    const name = roomName.trim();
    if (!name) return;
    emit('createRoom', name, maxUsers);
    setRoomName('');
    setMaxUsers(4);
    window.bootstrap?.Modal?.getInstance(modalRef.current)?.hide();
  }

  return (
    <div className="lobby-panel">
      <AdBanner slot={window.__ADSENSE_LOBBY_SLOT__} className="mb-3" />

      {/* 방 목록 카드 */}
      <div className="card game-card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            <i className="icon ion-ios-people me-2" />게임 방 목록
          </h5>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => emit('roomList')}>
              <i className="icon ion-refresh" />
            </button>
            <button
              className="btn btn-sm btn-primary"
              data-bs-toggle="modal"
              data-bs-target="#modal_createRoom"
            >
              <i className="icon ion-plus me-1" />방 만들기
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <RoomList />
        </div>
      </div>

      {/* 방 만들기 모달 */}
      <div className="modal fade" id="modal_createRoom" tabIndex="-1" ref={modalRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">방 만들기</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <form onSubmit={handleCreateRoom}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">방 이름</label>
                  <input
                    className="form-control"
                    style={{ fontSize: 16 }}
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    placeholder="방 이름을 입력하세요"
                    maxLength={30}
                    autoFocus
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">최대 인원</label>
                  <select
                    className="form-select"
                    style={{ fontSize: 16 }}
                    value={maxUsers}
                    onChange={e => setMaxUsers(Number(e.target.value))}
                  >
                    <option value={2}>2명</option>
                    <option value={3}>3명</option>
                    <option value={4}>4명</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="submit" className="btn btn-primary">방 만들기</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 랭킹 탭 ─────────────────────────────────────────────────────────────────

const MEDAL = ['🥇', '🥈', '🥉'];

function LeaderboardPanel() {
  const { leaderboard, myRank, period, setPeriod, rankType, setRankType, loading } = useRetention();

  return (
    <div className="lobby-panel">
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', fontSize: 16 }}
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          <option value="alltime">전체 기간</option>
          <option value="weekly">이번 주</option>
          <option value="monthly">이번 달</option>
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', fontSize: 16 }}
          value={rankType}
          onChange={e => setRankType(e.target.value)}
        >
          <option value="score">점수</option>
          <option value="wins">승리수</option>
        </select>
      </div>

      {myRank && (
        <div className="alert alert-info py-2 mb-3 small">
          내 순위: <strong>{myRank.rank ? `${myRank.rank}위` : '순위 없음'}</strong>
          &nbsp;·&nbsp;점수: <strong>{myRank.score}</strong>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border" style={{ color: 'rgba(255,255,255,0.7)' }} />
        </div>
      ) : (
        <div className="card game-card p-0">
          <div className="list-group list-group-flush">
            {leaderboard.map((entry, i) => (
              <div key={entry.accountId} className="list-group-item bg-transparent border-light-subtle">
                <div className="d-flex align-items-center gap-3 py-1">
                  <span style={{ width: 32, textAlign: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                    {i < 3 ? MEDAL[i] : <span className="text-muted small fw-bold">#{entry.rank}</span>}
                  </span>
                  {entry.avatar
                    ? <img src={entry.avatar} className="rounded-circle flex-shrink-0" width="32" height="32" style={{ objectFit: 'cover' }} alt="" />
                    : <span className="navbar-avatar flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>{entry.displayName.charAt(0)}</span>
                  }
                  <span className="flex-grow-1 fw-semibold">{entry.displayName}</span>
                  <span className="badge bg-primary fs-6">{entry.score}</span>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="text-muted text-center py-4">랭킹 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 업적 탭 ─────────────────────────────────────────────────────────────────

function AchievementsPanel() {
  const { achievements, loading } = useRetention();

  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border" style={{ color: 'rgba(255,255,255,0.7)' }} /></div>;
  }

  return (
    <div className="lobby-panel">
      <div className="row g-2">
        {achievements.map(a => (
          <div key={a.id} className="col-12 col-md-6">
            <div className={`achievement-card ${a.unlocked ? 'unlocked' : ''}`}>
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '2rem', flexShrink: 0 }}>{a.icon || '🏆'}</span>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{a.title}</div>
                  <div className="text-muted small">{a.description}</div>
                  {a.progress !== undefined && (
                    <div className="progress mt-1" style={{ height: 5 }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {a.unlocked
                  ? <i className="icon ion-checkmark-circle text-success" style={{ fontSize: '1.3rem' }} />
                  : a.progress !== undefined && (
                    <span className="badge bg-secondary">{a.progress}/{a.target}</span>
                  )
                }
              </div>
            </div>
          </div>
        ))}
        {achievements.length === 0 && (
          <div className="col-12 text-center py-4 text-muted">업적이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

// ── 미션 탭 ─────────────────────────────────────────────────────────────────

function MissionsPanel() {
  const { missions, loading } = useRetention();

  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border" style={{ color: 'rgba(255,255,255,0.7)' }} /></div>;
  }

  return (
    <div className="lobby-panel">
      <div className="row g-2">
        {missions.map(m => (
          <div key={m.id} className="col-12 col-md-6">
            <div className={`mission-card ${m.completed ? 'completed' : ''}`}>
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{m.icon || '📋'}</span>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{m.title}</div>
                  <div className="text-muted small">{m.description}</div>
                  {m.progress !== undefined && (
                    <div className="progress mt-1" style={{ height: 5 }}>
                      <div
                        className="progress-bar bg-success"
                        style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {m.completed
                  ? <span className="badge bg-success">완료</span>
                  : <span className="badge bg-secondary">{m.progress || 0}/{m.target}</span>
                }
              </div>
            </div>
          </div>
        ))}
        {missions.length === 0 && (
          <div className="col-12 text-center py-4 text-muted">오늘의 미션이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

// ── 꾸미기 탭 ────────────────────────────────────────────────────────────────

function CosmeticsPanel({ account }) {
  const { cosmetics, equip, loading } = useCosmetics(!!account);
  const { items: shopItems, purchase } = useShop();

  if (!account) {
    return (
      <div className="lobby-panel text-center py-5">
        <i className="icon ion-locked" style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.3)' }} />
        <p className="mt-3 text-white-50">꾸미기 기능은 로그인 후 이용 가능합니다.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border" style={{ color: 'rgba(255,255,255,0.7)' }} /></div>;
  }

  const catalog = cosmetics?.catalog || [];
  const owned = cosmetics?.owned || [];
  const equipped = cosmetics?.equipped || {};
  const isOwned = id => owned.includes(id) || id === 'card-default' || id === 'bell-gold';
  const isEquipped = (type, id) => equipped[type] === id;
  const cardSkins = catalog.filter(c => c.type === 'card');
  const bellSkins = catalog.filter(c => c.type === 'bell');

  function SkinGrid({ skins, type }) {
    return (
      <div className="row g-2">
        {skins.map(item => {
          const ownedItem = isOwned(item.id);
          const equippedItem = isEquipped(type, item.id);
          const shopItem = shopItems.find(s => s.skinId === item.id);
          return (
            <div key={item.id} className="col-6 col-sm-4 col-md-3">
              <div className={`cosmetic-card ${equippedItem ? 'equipped' : ''} ${!ownedItem ? 'locked' : ''}`}>
                <div className={`cosmetic-card-preview ${type === 'bell' ? 'bell-preview' : ''} ${item.cssClass || ''}`}>
                  {type === 'bell' && <i className="icon ion-ios-bell" style={{ fontSize: '1.8rem' }} />}
                </div>
                <div className="cosmetic-card-name">{item.name}</div>
                <div className="cosmetic-card-action">
                  {ownedItem ? (
                    <button
                      className={`btn btn-sm w-100 ${equippedItem ? 'btn-success' : 'btn-outline-primary'}`}
                      onClick={() => !equippedItem && equip(type, item.id)}
                      disabled={equippedItem}
                    >
                      {equippedItem ? '장착중' : '장착'}
                    </button>
                  ) : shopItem ? (
                    <button className="btn btn-sm btn-warning w-100" onClick={() => purchase(shopItem.id)}>
                      {shopItem.price.toLocaleString()}원
                    </button>
                  ) : (
                    <span className="badge bg-secondary w-100 py-1">업적 해금</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="lobby-panel">
      <h6 className="text-white-75 fw-bold mb-3">카드 뒷면 스킨</h6>
      <SkinGrid skins={cardSkins} type="card" />

      <h6 className="text-white-75 fw-bold mt-4 mb-3">벨 스킨</h6>
      <SkinGrid skins={bellSkins} type="bell" />
    </div>
  );
}

// ── 탭 정의 ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rooms',        label: '🎮 게임방' },
  { id: 'ranking',      label: '🏆 랭킹' },
  { id: 'achievements', label: '🎖 업적' },
  { id: 'missions',     label: '📋 미션' },
  { id: 'cosmetics',    label: '🎨 꾸미기' },
];

// ── 메인 로비 화면 ────────────────────────────────────────────────────────────

export default function LobbyScreen() {
  const { emit, state } = useGame();
  const { account } = useAuth();
  const [activeTab, setActiveTab] = useState('rooms');

  return (
    <div className="lobby-layout">
      <Navbar />

      {/* 탭 바 */}
      <div className="lobby-tab-bar">
        <nav className="nav nav-pills">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-link lobby-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="lobby-tab-content">
        {activeTab === 'rooms'        && <RoomsPanel emit={emit} />}
        {activeTab === 'ranking'      && <LeaderboardPanel />}
        {activeTab === 'achievements' && <AchievementsPanel />}
        {activeTab === 'missions'     && <MissionsPanel />}
        {activeTab === 'cosmetics'    && <CosmeticsPanel account={account} />}
      </div>
    </div>
  );
}
