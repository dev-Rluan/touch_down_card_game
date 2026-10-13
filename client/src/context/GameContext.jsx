import React, { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { emitFx } from '../fx/fxBus.js';
import { startClockSync } from '../net/clock.js';

const GameContext = createContext(null);

const initialState = {
  screen: 'loading',       // 'loading' | 'lobby' | 'waiting' | 'game' | 'result'
  socketConnected: false,  // 소켓 connecting 이벤트 수신 여부
  nickname: '',
  mySocketId: null,
  roomId: null,
  roomName: '',
  users: [],
  maxUserCnt: 4,
  roomList: [],
  isMyTurn: false,
  hand: [],                // 내 카드 배열
  playerStacks: {},        // { [playerId]: { cards: [], name: '' } }
  gameStatePlayers: [],    // gameState에서 온 { id, name, cardCount }[]
  currentTurn: 0,
  discardedCount: 0,       // 버림 더미 장수 (뒤집어 놓은 카드라 내용은 모른다)
  countdown: null,         // null | number | 'GO!'
  countdownSub: '',
  halliGalliResult: null,  // 최근 벨 결과
  bellOrder: null,         // { round, presses: [{ rank, playerId, name, delta }] } 서버가 받은 벨 누른 순서
  fxSeq: 0,                // 바닥에 놓인 카드마다 붙이는 고유 번호 (새로 놓인 카드만 애니메이션하기 위함)
  gameResult: null,        // { winner, finalScores }
  connectError: false,
  chat: [],                // [{ userId, name, text, ts }] 같은 방의 채팅 (최근 100건)
  chatUnread: 0,
  chatOpen: false,         // 게임 화면의 채팅 시트가 열려 있는지
  notification: null,      // { message, type } 일시 알림
};

function reducer(state, action) {
  switch (action.type) {

    case 'SOCKET_READY':
      // 소켓 연결 완료 — 서버가 부여한 임시 닉네임으로 바로 로비 진입
      return {
        ...state,
        screen: 'lobby',
        socketConnected: true,
        connectError: false,
        nickname: action.nickname,
        mySocketId: action.socketId,
        roomList: action.roomList || [],
      };

    case 'CONNECT_ERROR':
      return { ...state, connectError: true };

    case 'ROOM_LIST':
      return { ...state, roomList: action.rooms };

    case 'ROOM_JOINED':
      return {
        ...state,
        ...(state.roomId !== action.room.id ? { chat: [], chatUnread: 0, chatOpen: false } : null),
        screen: 'waiting',
        roomId: action.room.id,
        roomName: action.room.name,
        users: action.room.users || [],
        maxUserCnt: action.room.maxUserCnt || 4,
      };

    case 'ROOM_LEFT':
      return {
        ...state,
        chat: [],
        chatUnread: 0,
        chatOpen: false,
        screen: 'lobby',
        roomId: null,
        roomName: '',
        users: [],
        countdown: null,
        hand: [],
        playerStacks: {},
        gameStatePlayers: [],
        currentTurn: 0,
        discardedCount: 0,
        bellOrder: null,
        gameResult: null,
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
      return {
        ...state,
        screen: 'game',
        countdown: 'GO!',
        countdownSub: '',
        gameStatePlayers: action.players || [],
        playerStacks: stacks,
        discardedCount: 0,
        bellOrder: null,
        gameResult: null,
      };
    }

    case 'HIDE_COUNTDOWN':
      return { ...state, countdown: null };

    case 'YOUR_HAND':
      return { ...state, hand: action.cards || [] };

    case 'CARD_PLAYED': {
      // action.playerId, action.result.playedCard
      if (!action.playerId || !action.result || !action.result.playedCard) return state;
      const fxSeq = (state.fxSeq || 0) + 1;
      const card = { ...action.result.playedCard, _k: fxSeq };
      const prevStack = state.playerStacks[action.playerId] || { cards: [], name: action.playerName || '' };
      const newCards = [...prevStack.cards, card].slice(-3); // 최대 3장 표시
      const nextTurn = action.result.nextTurn;
      const players = state.gameStatePlayers.map(p =>
        p.id === action.playerId && action.result.playerCardCount !== undefined
          ? { ...p, cardCount: action.result.playerCardCount }
          : p
      );
      const hasNextTurn = typeof nextTurn === 'number';
      return {
        ...state,
        fxSeq,
        gameStatePlayers: players,
        currentTurn: hasNextTurn ? nextTurn : state.currentTurn,
        isMyTurn: hasNextTurn ? players[nextTurn]?.id === state.mySocketId : state.isMyTurn,
        playerStacks: {
          ...state.playerStacks,
          [action.playerId]: { ...prevStack, cards: newCards },
        },
      };
    }

    case 'GAME_STATE': {
      // { players: [{id, name, cardCount}], currentTurn, discardedCount }
      const newIsMyTurn = action.players
        ? action.currentTurn < action.players.length &&
          action.players[action.currentTurn]?.id === state.mySocketId
        : state.isMyTurn;
      return {
        ...state,
        gameStatePlayers: action.players || state.gameStatePlayers,
        currentTurn: action.currentTurn ?? state.currentTurn,
        discardedCount: action.discardedCount ?? state.discardedCount,
        isMyTurn: newIsMyTurn,
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
        halliGalliResult: action,
        playerStacks: newStacks,
        discardedCount: action.success ? 0 : (action.discardedCount ?? state.discardedCount),
      };
    }

    case 'CLEAR_HALLI_RESULT':
      return { ...state, halliGalliResult: null };

    case 'BELL_ORDER':
      return { ...state, bellOrder: { round: action.round, presses: action.presses || [] } };

    case 'CLEAR_BELL_ORDER':
      // 그 사이 새 라운드가 시작됐으면 지우지 않는다
      return state.bellOrder && state.bellOrder.round === action.round ? { ...state, bellOrder: null } : state;

    case 'GAME_END':
      return {
        ...state,
        screen: 'result',
        gameResult: { winner: action.winner, finalScores: action.finalScores },
        countdown: null,
        isMyTurn: false,
        bellOrder: null,
        hand: [],
        // 서버가 종료 시 모든 유저를 waiting 으로 되돌리므로 동기화
        users: state.users.map(u => ({ ...u, readyStatus: 'waiting' })),
      };

    case 'CHAT_MESSAGE': {
      const msg = { userId: action.userId, name: action.name, text: action.text, ts: action.ts };
      const mine = msg.userId === state.mySocketId;
      return {
        ...state,
        chat: [...state.chat, msg].slice(-100),
        chatUnread: state.chatOpen || mine ? state.chatUnread : state.chatUnread + 1,
      };
    }

    case 'CHAT_OPEN':
      return { ...state, chatOpen: true, chatUnread: 0 };

    case 'CHAT_CLOSE':
      return { ...state, chatOpen: false };

    case 'SHOW_NOTIFICATION':
      return { ...state, notification: { message: action.message, type: action.notifType } };

    case 'CLEAR_NOTIFICATION':
      return { ...state, notification: null };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);

  useEffect(() => {
    // env.js가 로드되면 __TOUCHDOWN_SOCKET_URL__ 사용, 아니면 현재 origin(개발: proxy 경유)
    const url = window.__TOUCHDOWN_SOCKET_URL__ || '';
    // 벨 결과 알림 타이머: 결과가 연달아 오면 이전 타이머가 새 알림을 일찍 지우지 않도록 하나만 유지
    let halliResultTimer = null;
    let bellOrderTimer = null;

    const socket = io(url, {
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    const stopClockSync = startClockSync(socket);

    socket.on('connect', () => {
      // socket.id는 connect 이후 사용 가능
    });

    socket.on('connecting', ({ nickname, roomList }) => {
      dispatch({
        type: 'SOCKET_READY',
        nickname,
        socketId: socket.id,
        roomList: roomList || [],
      });
    });

    socket.on('connect_error', () => {
      dispatch({ type: 'CONNECT_ERROR' });
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

    socket.on('leaveRoomResult', ({ status }) => {
      if (status === 200) dispatch({ type: 'ROOM_LEFT' });
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
      emitFx('countdown', { secondsLeft });
      dispatch({ type: 'COUNTDOWN_TICK', secondsLeft });
    });

    socket.on('gameCountdownCanceled', ({ reason }) => {
      dispatch({ type: 'COUNTDOWN_CANCEL' });
      if (reason !== 'completed') {
        dispatch({ type: 'SHOW_NOTIFICATION', message: '게임 시작이 취소되었습니다.', notifType: 'warning' });
      }
    });

    socket.on('gameStart', ({ message, gameData }) => {
      emitFx('gameStart', gameData);
      const players = gameData?.players || [];
      dispatch({ type: 'GAME_START', players });
      setTimeout(() => dispatch({ type: 'HIDE_COUNTDOWN' }), 900);
      if (message) {
        dispatch({ type: 'SHOW_NOTIFICATION', message, notifType: 'success' });
      }
    });

    socket.on('yourHand', ({ cards }) => {
      dispatch({ type: 'YOUR_HAND', cards });
    });

    socket.on('cardPlayed', (data) => {
      emitFx('cardPlayed', data);
      dispatch({ type: 'CARD_PLAYED', ...data });
    });

    socket.on('gameState', (gs) => {
      dispatch({ type: 'GAME_STATE', ...gs });
    });

    socket.on('halliGalliResult', (data) => {
      // 성공 시 reducer 가 바닥 카드를 비우므로, 그 전에 이펙트가 카드 위치를 측정할 수 있게 먼저 알린다
      emitFx('halliResult', data);
      dispatch({ type: 'HALLI_RESULT', ...data });
      clearTimeout(halliResultTimer);
      halliResultTimer = setTimeout(() => dispatch({ type: 'CLEAR_HALLI_RESULT' }), 3000);
    });

    // 벨 누른 순서 (서버 도착 순). 마지막 갱신 후 2.5초 동안 보여준다
    socket.on('bellOrder', (data) => {
      if (!data || !Array.isArray(data.presses)) return;
      emitFx('bellOrder', data);
      dispatch({ type: 'BELL_ORDER', ...data });
      clearTimeout(bellOrderTimer);
      bellOrderTimer = setTimeout(() => dispatch({ type: 'CLEAR_BELL_ORDER', round: data.round }), 2500);
    });

    // 벨 거부(쿨타임·늦음·탈락)는 알림 대신 내 더미 위 글자로 보여준다
    socket.on('halliGalliError', (message) => {
      emitFx('bellError', { message: typeof message === 'string' ? message : '' });
    });

    socket.on('gameEnd', (data) => {
      emitFx('gameEnd', data);
      dispatch({ type: 'GAME_END', ...data });
    });

    socket.on('chat message', (msg) => {
      if (msg && typeof msg.text === 'string') {
        emitFx('chat', msg);
        dispatch({ type: 'CHAT_MESSAGE', ...msg });
      }
    });

    // 서버 에러 이벤트 → 사용자 알림
    const errorEvents = [
      'createRoomError', 'roomListError', 'faildJoinRoom', 'readyError',
      'playCardError', 'gameStateError', 'name change error', 'chatError',
    ];
    errorEvents.forEach(evt => {
      socket.on(evt, (message) => {
        dispatch({
          type: 'SHOW_NOTIFICATION',
          message: typeof message === 'string' ? message : '요청을 처리하지 못했습니다.',
          notifType: 'warning',
        });
      });
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      dispatch({ type: 'SHOW_NOTIFICATION', message: '서버와 연결이 끊어졌습니다. 재연결 중...', notifType: 'warning' });
    });

    // 업적/미션 알림
    socket.on('achievementsUnlocked', (achievements) => {
      achievements.forEach(a => {
        dispatch({ type: 'SHOW_NOTIFICATION', message: `업적 달성: ${a.title}`, notifType: 'success' });
      });
    });

    socket.on('missionsCompleted', (missions) => {
      missions.forEach(m => {
        dispatch({ type: 'SHOW_NOTIFICATION', message: `미션 완료: ${m.title}`, notifType: 'info' });
      });
    });

    return () => {
      clearTimeout(halliResultTimer);
      clearTimeout(bellOrderTimer);
      stopClockSync();
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event, ...args) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const getSocketId = useCallback(() => socketRef.current?.id || null, []);

  return (
    <GameContext.Provider value={{ state, dispatch, emit, getSocketId }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
