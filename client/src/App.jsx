import React, { useEffect, useRef } from 'react';
import { onFx } from './fx/fxBus.js';
import { playSound, vibrate } from './fx/sound.js';
import { useGame } from './context/GameContext.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import WaitingScreen from './screens/WaitingScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import Notification from './components/Notification.jsx';

const SCREENS = {
  loading: LoadingScreen,
  lobby: LobbyScreen,
  waiting: WaitingScreen,
  game: GameScreen,
  result: ResultScreen,
};

export default function App() {
  const { state, dispatch } = useGame();
  const Screen = SCREENS[state.screen] || LoadingScreen;

  // 화면과 상관없이 나는 효과음: 채팅 도착, 카운트다운, 게임 시작, 승리/패배
  const myIdRef = useRef(state.mySocketId);
  myIdRef.current = state.mySocketId;
  useEffect(() => onFx((type, data) => {
    const me = myIdRef.current;
    if (type === 'chat' && data.userId !== me) playSound('chat');
    if (type === 'countdown' && data.secondsLeft > 0) playSound('tick');
    if (type === 'gameStart') playSound('go');
    if (type === 'gameEnd') {
      const won = data?.winner?.id === me;
      playSound(won ? 'win' : 'lose');
      if (won) vibrate([40, 60, 40, 60, 80]);
    }
  }), []);

  // 알림 자동 제거
  useEffect(() => {
    if (!state.notification) return;
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 3000);
    return () => clearTimeout(timer);
  }, [state.notification, dispatch]);

  return (
    <div className="game-body">
      <Screen />
      {state.notification && (
        <Notification
          message={state.notification.message}
          type={state.notification.type}
          onClose={() => dispatch({ type: 'CLEAR_NOTIFICATION' })}
        />
      )}
    </div>
  );
}
