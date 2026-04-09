import { useState, useEffect } from 'react';

let _cache = null;

export default function useAuth() {
  const [auth, setAuth] = useState(_cache || { account: null, providers: [], loading: true });

  useEffect(() => {
    if (_cache) return;
    Promise.all([
      fetch('/auth/me').then(r => r.json()),
      fetch('/auth/providers').then(r => r.json()),
    ]).then(([meData, provData]) => {
      _cache = {
        account: meData.loggedIn && meData.user ? meData.user : null,
        providers: provData.providers || [],
        loading: false,
      };
      setAuth(_cache);
    }).catch(() => {
      _cache = { account: null, providers: [], loading: false };
      setAuth(_cache);
    });
  }, []);

  return auth;
}
