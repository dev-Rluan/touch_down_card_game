import React, { useCallback } from 'react';
import { useGame } from './context/GameContext.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import WaitingScreen from './screens/WaitingScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import NotificationStack from './components/Notification.jsx';
import ConnectionBanner from './components/ConnectionBanner.jsx';

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

  const closeNotification = useCallback(
    (id) => dispatch({ type: 'CLEAR_NOTIFICATION', id }),
    [dispatch]
  );

  return (
    <div className="game-body">
      {state.screen !== 'loading' && (
        <ConnectionBanner lost={state.connectionLost} failed={state.connectError} />
      )}
      <Screen />
      <NotificationStack items={state.notifications} onClose={closeNotification} />
    </div>
  );
}
