import { useState, useEffect, useCallback } from 'react';

export default function useCosmetics(isLoggedIn = false) {
  const [cosmetics, setCosmetics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetch('/api/cosmetics')
      .then(r => r.json())
      .then(data => { setCosmetics(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isLoggedIn]);

  const equip = useCallback(async (type, skinId) => {
    try {
      const res = await fetch('/api/cosmetics/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, skinId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCosmetics(prev => prev ? { ...prev, equipped: updated.equipped } : prev);
      }
    } catch (_) {}
  }, []);

  return { cosmetics, equip, loading };
}
