import React, { useEffect } from 'react';
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
