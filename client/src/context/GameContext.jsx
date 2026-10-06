import React, { createContext, useContext, useReducer, useRef, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext(null);

const initialState = {
  screen: 'loading',       // 'loading' | 'lobby' | 'waiting' | 'game' | 'result'
  socketConnected: false,  // 소켓 connecting 이벤트 수신 여부
  connectionLost: false,   // 접속 후 연결이 끊겨 재연결 시도 중
  pendingLobby: null,      // { nickname, roomList, account, socketId } — 인트로 화면 대기 중
  nickname: '',
  mySocketId: null,
  roomId: null,
  roomName: '',
  users: [],
  maxUserCnt: 4,
  roomList: [],
  account: null,           // OAuth 로그인 계정 정보
  isMyTurn: false,
  hand: [],                // 내 카드 배열
  playerStacks: {},        // { [playerId]: { cards: [], name: '' } }
  gameStatePlayers: [],    // gameState에서 온 { id, name, cardCount }[]
  currentTurn: 0,
  centerCardCount: 0,      // 중앙에 깔린 카드 총 장수 (서버 기준)
  discardedCards: [],
  countdown: null,         // null | number | 'GO!'
  countdownSub: '',
  halliGalliResult: null,  // 최근 할리갈리 결과
  gameResult: null,        // { winner, finalScores }
  connectError: false,
  notifications: [],       // [{ id, message, type }] 일시 알림 (최대 3개)
};

const MAX_NOTIFICATIONS = 3;
let notificationSeq = 0;

// 방/게임 관련 상태 초기값 (방 퇴장·재연결 시 공통 초기화)
const ROOM_RESET = {
  roomId: null,
  roomName: '',
  users: [],
  countdown: null,
  countdownSub: '',
  isMyTurn: false,
  hand: [],
  playerStacks: {},
  gameStatePlayers: [],
  currentTurn: 0,
  centerCardCount: 0,
  discardedCards: [],
  halliGalliResult: null,
  gameResult: null,
};

function isMyTurnAt(players, turn, myId) {
  return !!players && turn != null && players[turn]?.id === myId;
}

function reducer(state, action) {
  switch (action.type) {

    case 'SOCKET_READY':
      // 재연결: 서버는 이전 소켓의 방 참여를 정리하므로 로비로 복귀시킨다
      if (state.screen !== 'loading') {
        return {
          ...state,
          ...ROOM_RESET,
          screen: 'lobby',
          socketConnected: true,
          connectionLost: false,
          connectError: false,
          nickname: action.nickname,
          mySocketId: action.socketId,
          roomList: action.roomList || [],
          account: action.account ?? state.account,
          pendingLobby: null,
        };
      }
      // 소켓 연결 완료 — 로그인 사용자면 바로 로비로, 게스트면 인트로 대기
      if (action.account) {
        return {
          ...state,
          screen: 'lobby',
          socketConnected: true,
          nickname: action.nickname,
          mySocketId: action.socketId,
          roomList: action.roomList || [],
          account: action.account,
          pendingLobby: null,
        };
      }
      return {
        ...state,
        socketConnected: true,
        pendingLobby: {
          nickname: action.nickname,
          roomList: action.roomList || [],
          socketId: action.socketId,
        },
      };

    case 'ENTER_LOBBY': {
      const p = state.pendingLobby || {};
      return {
        ...state,
        screen: 'lobby',
        nickname: p.nickname || state.nickname,
        mySocketId: p.socketId || state.mySocketId,
        roomList: p.roomList || state.roomList,
        account: null,
        pendingLobby: null,
      };
    }

    // 하위 호환 (직접 로비 진입)
    case 'CONNECTED':
      return {
        ...state,
        screen: 'lobby',
        socketConnected: true,
        nickname: action.nickname,
        mySocketId: action.socketId,
        roomList: action.roomList || [],
        account: action.account,
        pendingLobby: null,
      };

    case 'CONNECT_ERROR':
      return { ...state, connectError: true };

    case 'CONNECTION_LOST':
      return { ...state, connectionLost: true };

    case 'CONNECTION_RESTORED':
      return { ...state, connectionLost: false, connectError: false };

    case 'ROOM_LIST':
      return { ...state, roomList: action.rooms };

    case 'ROOM_JOINED':
      return {
        ...state,
        screen: 'waiting',
        roomId: action.room.id,
        roomName: action.room.name,
        users: action.room.users || [],
        maxUserCnt: action.room.maxUserCnt || 4,
      };

    case 'ROOM_LEFT':
      return { ...state, ...ROOM_RESET, screen: 'lobby' };

    case 'BACK_TO_WAITING':
      // 결과 화면 → 같은 방 대기실 (users는 서버의 updateReadyStatus로 이미 갱신됨)
      return {
        ...state,
        screen: 'waiting',
        countdown: null,
        hand: [],
        playerStacks: {},
        gameStatePlayers: [],
        currentTurn: 0,
        centerCardCount: 0,
        discardedCards: [],
        halliGalliResult: null,
        isMyTurn: false,
      };

    case 'USERS_UPDATED':
      return {
        ...state,
        users: action.users || [],
        maxUserCnt: action.maxUserCnt || state.maxUserCnt,
      };

    case 'NICKNAME_CHANGED':
      return { ...state, nickname: action.nickname };

    case 'COUNTDOWN_START':
      return {
        ...state,
        countdown: action.total,
        countdownSub: '모든 플레이어가 준비되었습니다!',
      };

    case 'COUNTDOWN_TICK':
      return {
        ...state,
        countdown: action.secondsLeft,
        countdownSub: '게임이 곧 시작됩니다!',
      };

    case 'COUNTDOWN_CANCEL':
      return { ...state, countdown: null, countdownSub: '' };

    case 'GAME_START': {
      const stacks = {};
      if (action.players) {
        action.players.forEach(p => {
          stacks[p.id] = { cards: [], name: p.name };
        });
      }
      const players = action.players || [];
      const currentTurn = action.currentTurn ?? 0;
      return {
        ...state,
        screen: 'game',
        countdown: 'GO!',
        countdownSub: '',
        gameStatePlayers: players,
        playerStacks: stacks,
        currentTurn,
        isMyTurn: isMyTurnAt(players, currentTurn, state.mySocketId),
        centerCardCount: 0,
        discardedCards: [],
        halliGalliResult: null,
        gameResult: null,
      };
    }

    case 'HIDE_COUNTDOWN':
      return { ...state, countdown: null };

    case 'YOUR_HAND':
      return { ...state, hand: action.cards || [] };

    case 'CARD_PLAYED': {
      // { playerId, playerName, result: { playedCard, nextTurn, playerCardCount } }
      if (!action.playerId || !action.result || !action.result.playedCard) return state;
      const { playedCard, nextTurn, playerCardCount, centerCardCount } = action.result;
      const prevStack = state.playerStacks[action.playerId] || { cards: [], name: action.playerName || '' };
      const newCards = [...prevStack.cards, playedCard].slice(-3); // 최대 3장 표시
      // 서버가 매 카드마다 gameState를 다시 보내지 않으므로 턴/장수를 여기서 반영
      const players = typeof playerCardCount === 'number'
        ? state.gameStatePlayers.map(p => (p.id === action.playerId ? { ...p, cardCount: playerCardCount } : p))
        : state.gameStatePlayers;
      const currentTurn = nextTurn ?? state.currentTurn;
      return {
        ...state,
        gameStatePlayers: players,
        currentTurn,
        centerCardCount: centerCardCount ?? state.centerCardCount + 1,
        isMyTurn: isMyTurnAt(players, currentTurn, state.mySocketId),
        playerStacks: {
          ...state.playerStacks,
          [action.playerId]: { ...prevStack, cards: newCards },
        },
      };
    }

    case 'GAME_STATE': {
      // { players: [{id, name, cardCount, score}], currentTurn, discardedCards }
      const players = action.players || state.gameStatePlayers;
      const currentTurn = action.currentTurn ?? state.currentTurn;
      // 게임 도중 나간 플레이어의 스택은 화면에서 제거
      const ids = new Set(players.map(p => p.id));
      const playerStacks = Object.fromEntries(
        Object.entries(state.playerStacks).filter(([id]) => ids.has(id))
      );
      return {
        ...state,
        gameStatePlayers: players,
        playerStacks,
        currentTurn,
        centerCardCount: action.centerCardCount ?? state.centerCardCount,
        discardedCards: action.discardedCards || state.discardedCards,
        isMyTurn: isMyTurnAt(players, currentTurn, state.mySocketId),
      };
    }

    case 'HALLI_RESULT': {
      // 성공 시 중앙 카드 더미 초기화
      const newStacks = action.success
        ? Object.fromEntries(
            Object.entries(state.playerStacks).map(([id, s]) => [id, { ...s, cards: [] }])
          )
        : state.playerStacks;
      return {
        ...state,
        halliGalliResult: { ...action, receivedAt: Date.now() },
        playerStacks: newStacks,
        centerCardCount: action.success ? 0 : state.centerCardCount,
        discardedCards: action.success ? [] : (action.discardedCards || state.discardedCards),
      };
    }

    case 'CLEAR_HALLI_RESULT':
      return { ...state, halliGalliResult: null };

    case 'GAME_END':
      return {
        ...state,
        screen: 'result',
        gameResult: { winner: action.winner, finalScores: action.finalScores },
        countdown: null,
      };

    case 'SHOW_NOTIFICATION': {
      if (!action.message) return state;
      // 같은 문구가 이미 떠 있으면 중복 표시하지 않음 (연타 시 에러 폭주 방지)
      if (state.notifications.some(n => n.message === action.message)) return state;
      const next = [...state.notifications, { id: ++notificationSeq, message: action.message, type: action.notifType || 'info' }];
      return { ...state, notifications: next.slice(-MAX_NOTIFICATIONS) };
    }

    case 'CLEAR_NOTIFICATION':
      return {
        ...state,
        notifications: action.id == null ? [] : state.notifications.filter(n => n.id !== action.id),
      };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);
  const timersRef = useRef({ halli: null, countdown: null });
  // 소켓 핸들러(최초 1회 등록)에서 최신 상태를 읽기 위한 ref
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // env.js가 로드되면 __TOUCHDOWN_SOCKET_URL__ 사용, 아니면 현재 origin(개발: proxy 경유)
    const url = window.__TOUCHDOWN_SOCKET_URL__ || '';
    const socket = io(url, {
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const notify = (message, notifType = 'info') =>
      dispatch({ type: 'SHOW_NOTIFICATION', message, notifType });
    const notifyError = (message) => {
      if (typeof message === 'string' && message) notify(message, 'error');
    };

    socket.on('connect', () => {
      dispatch({ type: 'CONNECTION_RESTORED' });
    });

    socket.on('disconnect', (reason) => {
      // 클라이언트가 직접 끊은 경우(언마운트)는 무시
      if (reason !== 'io client disconnect') dispatch({ type: 'CONNECTION_LOST' });
    });

    socket.on('connecting', ({ nickname, roomList, account }) => {
      const prev = stateRef.current;
      if (prev.screen !== 'loading') {
        if (prev.roomId) notify('연결이 끊겨 방에서 나왔습니다. 로비로 이동합니다.', 'warning');
        // 재연결 시 서버가 기본 닉네임을 새로 부여하므로 사용자가 바꾼 닉네임을 복원
        if (!account && prev.nickname && prev.nickname !== nickname) {
          socket.emit('change name', prev.nickname);
        }
      }
      dispatch({
        type: 'SOCKET_READY',
        nickname,
        socketId: socket.id,
        roomList: roomList || [],
        account,
      });
    });

    // 개별 시도 실패(connect_error)가 아니라 재시도를 모두 소진했을 때만 실패로 표시
    socket.io.on('reconnect_failed', () => {
      dispatch({ type: 'CONNECT_ERROR' });
    });
    socket.on('connect_error', () => {
      if (!socket.active) dispatch({ type: 'CONNECT_ERROR' });
    });

    socket.on('roomList', (rooms) => {
      dispatch({ type: 'ROOM_LIST', rooms });
    });

    socket.on('roomCreated', (room) => {
      dispatch({ type: 'ROOM_JOINED', room });
    });

    socket.on('successJoinRoom', (room) => {
      dispatch({ type: 'ROOM_JOINED', room });
    });

    socket.on('joinUser', (payload) => {
      const users = Array.isArray(payload) ? payload : (payload?.users || []);
      const maxUserCnt = Array.isArray(payload) ? undefined : payload?.maxUserCnt;
      dispatch({ type: 'USERS_UPDATED', users, maxUserCnt });
    });

    socket.on('leaveUser', (payload) => {
      const users = Array.isArray(payload) ? payload : (payload?.users || []);
      dispatch({ type: 'USERS_UPDATED', users });
    });

    socket.on('leaveRoomResult', ({ status, message }) => {
      if (status === 200) dispatch({ type: 'ROOM_LEFT' });
      else notifyError(message);
    });

    socket.on('updateReadyStatus', (users) => {
      if (Array.isArray(users)) dispatch({ type: 'USERS_UPDATED', users });
    });

    socket.on('name change successful', (name) => {
      dispatch({ type: 'NICKNAME_CHANGED', nickname: name });
    });

    socket.on('gameCountdownStart', ({ total }) => {
      dispatch({ type: 'COUNTDOWN_START', total });
    });

    socket.on('gameCountdown', ({ secondsLeft }) => {
      dispatch({ type: 'COUNTDOWN_TICK', secondsLeft });
    });

    socket.on('gameCountdownCanceled', ({ reason }) => {
      dispatch({ type: 'COUNTDOWN_CANCEL' });
      // 정상 시작/재시작은 알림 불필요
      if (reason !== 'completed' && reason !== 'restarting') {
        notify('게임 시작이 취소되었습니다.', 'warning');
      }
    });

    socket.on('gameStart', ({ gameData }) => {
      const players = gameData?.players || [];
      dispatch({ type: 'GAME_START', players, currentTurn: gameData?.currentTurn });
      clearTimeout(timersRef.current.countdown);
      timersRef.current.countdown = setTimeout(() => dispatch({ type: 'HIDE_COUNTDOWN' }), 900);
    });

    socket.on('yourHand', ({ cards }) => {
      dispatch({ type: 'YOUR_HAND', cards });
    });

    socket.on('cardPlayed', (data) => {
      dispatch({ type: 'CARD_PLAYED', ...data });
    });

    socket.on('gameState', (gs) => {
      dispatch({ type: 'GAME_STATE', ...gs });
    });

    socket.on('halliGalliResult', (data) => {
      dispatch({ type: 'HALLI_RESULT', ...data });
      // 연속 결과 시 이전 타이머가 새 결과를 일찍 지우지 않도록 재설정
      clearTimeout(timersRef.current.halli);
      timersRef.current.halli = setTimeout(() => dispatch({ type: 'CLEAR_HALLI_RESULT' }), 2500);
    });

    socket.on('gameEnd', (data) => {
      dispatch({ type: 'GAME_END', ...data });
    });

    // 업적/미션 알림
    socket.on('achievementsUnlocked', (achievements) => {
      achievements.forEach(a => notify(`업적 달성: ${a.title}`, 'success'));
    });

    socket.on('missionsCompleted', (missions) => {
      missions.forEach(m => notify(`미션 완료: ${m.title}`, 'info'));
    });

    // 서버 에러 응답 — 이전에는 수신하지 않아 실패해도 아무 피드백이 없었다
    [
      'createRoomError', 'faildJoinRoom', 'readyError', 'playCardError',
      'halliGalliError', 'name change error', 'gameStartError', 'roomListError',
    ].forEach(evt => socket.on(evt, notifyError));

    const timers = timersRef.current;
    return () => {
      clearTimeout(timers.halli);
      clearTimeout(timers.countdown);
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event, ...args) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      dispatch({ type: 'SHOW_NOTIFICATION', message: '서버와 연결이 끊겨 있습니다. 재연결 중...', notifType: 'warning' });
      return;
    }
    socket.emit(event, ...args);
  }, []);

  const getSocketId = useCallback(() => socketRef.current?.id || null, []);

  const value = useMemo(() => ({ state, dispatch, emit, getSocketId }), [state, emit, getSocketId]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
