import React, { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext(null);

const initialState = {
  screen: 'loading',       // 'loading' | 'lobby' | 'waiting' | 'game' | 'result'
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
  discardedCards: [],
  countdown: null,         // null | number | 'GO!'
  countdownSub: '',
  halliGalliResult: null,  // 최근 할리갈리 결과
  gameResult: null,        // { winner, finalScores }
  connectError: false,
  notification: null,      // { message, type } 일시 알림
};

function reducer(state, action) {
  switch (action.type) {

    case 'CONNECTED':
      return {
        ...state,
        screen: 'lobby',
        nickname: action.nickname,
        mySocketId: action.socketId,
        roomList: action.roomList || [],
        account: action.account,
      };

    case 'CONNECT_ERROR':
      return { ...state, connectError: true };

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
      return {
        ...state,
        screen: 'lobby',
        roomId: null,
        roomName: '',
        users: [],
        countdown: null,
        hand: [],
        playerStacks: {},
        gameStatePlayers: [],
        currentTurn: 0,
        discardedCards: [],
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
        discardedCards: [],
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
      const card = action.result.playedCard;
      const prevStack = state.playerStacks[action.playerId] || { cards: [], name: action.playerName || '' };
      const newCards = [...prevStack.cards, card].slice(-3); // 최대 3장 표시
      return {
        ...state,
        playerStacks: {
          ...state.playerStacks,
          [action.playerId]: { ...prevStack, cards: newCards },
        },
      };
    }

    case 'GAME_STATE': {
      // { players: [{id, name, cardCount}], currentTurn, discardedCards }
      const newIsMyTurn = action.players
        ? action.currentTurn < action.players.length &&
          action.players[action.currentTurn]?.id === state.mySocketId
        : state.isMyTurn;
      return {
        ...state,
        gameStatePlayers: action.players || state.gameStatePlayers,
        currentTurn: action.currentTurn ?? state.currentTurn,
        discardedCards: action.discardedCards || state.discardedCards,
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
    const socket = io(url, {
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // socket.id는 connect 이후 사용 가능
    });

    socket.on('connecting', ({ nickname, roomList, account }) => {
      dispatch({
        type: 'CONNECTED',
        nickname,
        socketId: socket.id,
        roomList: roomList || [],
        account,
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
      dispatch({ type: 'COUNTDOWN_TICK', secondsLeft });
    });

    socket.on('gameCountdownCanceled', ({ reason }) => {
      dispatch({ type: 'COUNTDOWN_CANCEL' });
      if (reason !== 'completed') {
        dispatch({ type: 'SHOW_NOTIFICATION', message: '게임 시작이 취소되었습니다.', notifType: 'warning' });
      }
    });

    socket.on('gameStart', ({ message, gameData }) => {
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
      dispatch({ type: 'CARD_PLAYED', ...data });
    });

    socket.on('gameState', (gs) => {
      dispatch({ type: 'GAME_STATE', ...gs });
    });

    socket.on('halliGalliResult', (data) => {
      dispatch({ type: 'HALLI_RESULT', ...data });
      setTimeout(() => dispatch({ type: 'CLEAR_HALLI_RESULT' }), 3000);
    });

    socket.on('gameEnd', (data) => {
      dispatch({ type: 'GAME_END', ...data });
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
