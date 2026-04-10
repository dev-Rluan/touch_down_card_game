import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';

export default function useRetention() {
  const { state } = useGame();
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('alltime');
  const [rankType, setRankType] = useState('score');

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}&type=${rankType}&limit=20`)
      .then(r => r.json())
      .then(data => {
        setLeaderboard(data.leaderboard || data || []);
        if (data.myRank) setMyRank(data.myRank);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, rankType]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!state.account) return;
    Promise.all([
      fetch('/api/achievements').then(r => r.json()),
      fetch('/api/missions').then(r => r.json()),
    ]).then(([achData, misData]) => {
      setAchievements(achData.achievements || achData || []);
      setMissions(misData.missions || misData || []);
    }).catch(() => {});
  }, [state.account]);

  return { leaderboard, myRank, achievements, missions, loading, period, setPeriod, rankType, setRankType };
}
