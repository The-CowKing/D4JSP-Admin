import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'adam87lewis@gmail.com';

// Restore cached avatar/name from localStorage to prevent "U" flash
function getCachedProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('d4jsp-profile');
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}

function cacheProfile(userData) {
  if (typeof window === 'undefined' || !userData) return;
  try {
    localStorage.setItem('d4jsp-profile', JSON.stringify({
      photo_url: userData.photo_url || '',
      display_name: userData.display_name || '',
      fg_balance: userData.fg_balance || 0,
      role: userData.role || 'user',
      membership: userData.membership || 'free',
    }));
  } catch {}
}

export function AuthProvider({ children }) {
  const cached = getCachedProfile();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(cached);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  const ensureUserDoc = async (supabaseUser) => {
    if (!supabaseUser) return null;
    const isAdmin = supabaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (existing) {
      let profile = existing;

      // Get session token once for server-side API calls below
      let token = null;
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        token = s?.access_token || null;
      } catch {}

      if (isAdmin && existing.role !== 'admin') {
        // Server-side role promotion — never write role via anon client (privesc vector)
        if (token) {
          await fetch('/api/auth/promote-admin', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
          }).catch(() => {});
        }
        profile = { ...profile, role: 'admin' };
      }

      // Auto-expire membership: if expiry has passed and membership isn't free, bump to free
      if (profile.membership && profile.membership !== 'free' && profile.membership_expiry) {
        const expiry = new Date(profile.membership_expiry);
        if (expiry < new Date()) {
          // Server-side membership expiry — never write membership via anon client
          if (token) {
            await fetch('/api/auth/expire-membership', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token },
            }).catch(() => {});
          }
          profile = { ...profile, membership: 'free', membership_expiry: null };
        }
      }

      setUserData(profile);
      cacheProfile(profile);
      return profile;
    }

    // Build local profile state for immediate UI display
    const newUser = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      display_name: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
      photo_url: supabaseUser.user_metadata?.avatar_url || null,
      fg_balance: 1000,
      role: isAdmin ? 'admin' : 'user',
      badges: isAdmin ? ['newbie', 'premium', 'legendary'] : ['newbie'],
      membership: isAdmin ? 'legendary' : 'free',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Server-side INSERT — role/fg_balance/membership are set by the route, not the client
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.access_token) {
        await fetch('/api/auth/setup-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
          body: JSON.stringify({ display_name: newUser.display_name, photo_url: newUser.photo_url }),
        });
      }
    } catch {}
    setUserData(newUser);
    cacheProfile(newUser);
    // Award signup XP (fire-and-forget, don't block auth flow)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/award-xp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ userId: supabaseUser.id, action: 'signup' }),
        }).catch(() => {});
      }
    } catch {}
    // Claim pending referral if present
    if (typeof window !== 'undefined') {
      try {
        const pendingRef = localStorage.getItem('pendingReferral');
        if (pendingRef && pendingRef !== supabaseUser.id) {
          fetch('/api/claim-referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrerId: pendingRef, newUserId: supabaseUser.id, ipAddress: null }),
          }).catch(() => {});
          localStorage.removeItem('pendingReferral');
        }
      } catch {}
    }
    return newUser;
  };

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 4000);

    let subscription;
    try {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s?.user) {
          setUser(s.user);
          setSession(s);
          ensureUserDoc(s.user).catch(() => {}).finally(() => { clearTimeout(timeout); setLoading(false); });
        } else {
          clearTimeout(timeout);
          setLoading(false);
        }
      }).catch(() => { clearTimeout(timeout); setLoading(false); });

      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          // Explicit sign-out — clear everything
          setUser(null);
          setUserData(null);
          setSession(null);
          if (typeof window !== 'undefined') localStorage.removeItem('d4jsp-profile');
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Silent token refresh — update auth objects but skip DB round-trip.
          // The previous code re-ran ensureUserDoc here, which raced with the
          // half-refreshed auth state, returned data:null, and fell into the
          // "create new user" branch — wiping photo_url with the OAuth stock avatar.
          setUser(session.user);
          setSession(session);
        } else if (session?.user) {
          // SIGNED_IN, USER_UPDATED, INITIAL_SESSION — full profile sync
          setUser(session.user);
          setSession(session);
          try { await ensureUserDoc(session.user); } catch {}
        }
        setLoading(false);
      });
      subscription = data?.subscription;
    } catch {
      clearTimeout(timeout);
      setLoading(false);
    }

    return () => { subscription?.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const signInEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUpEmail = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return data;
  };

  const signInGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  };

  // Redirect to Battle.net OAuth (new login or registration)
  const signInWithBattleNet = () => {
    window.location.href = '/api/auth/battlenet?mode=login';
  };

  // Redirect to Battle.net OAuth to link to an existing account
  const linkBattleNet = (uid) => {
    window.location.href = `/api/auth/battlenet?mode=link&uid=${encodeURIComponent(uid)}`;
  };

  // Remove Battle.net link from the current user
  const unlinkBattleNet = async () => {
    if (!user) return;
    await supabase.from('users').update({
      battlenet_account_id: null,
      battletag: null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    setUserData(prev => {
      const updated = { ...prev, battlenet_account_id: null, battletag: null };
      cacheProfile(updated);
      return updated;
    });
  };

  // Re-fetch the user's profile row and push into context state
  const refreshUserData = async () => {
    if (!user) return;
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) { setUserData(data); cacheProfile(data); }
  };

  const logOut = async () => {
    setUser(null);
    setUserData(null);
    setSession(null);
    setLoading(false);
    if (typeof window !== 'undefined') localStorage.removeItem('d4jsp-profile');
    await supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
    });
    if (error) throw error;
  };

  const updateUserProfile = async (updates) => {
    if (!user) return;
    const dbUpdates = {};
    if (updates.displayName) dbUpdates.display_name = updates.displayName;
    if (updates.photoURL) dbUpdates.photo_url = updates.photoURL;
    dbUpdates.updated_at = new Date().toISOString();

    await supabase.from('users').update(dbUpdates).eq('id', user.id);
    setUserData(prev => {
      const merged = { ...prev, ...dbUpdates };
      cacheProfile(merged);
      return merged;
    });

    if (updates.displayName) {
      await supabase.auth.updateUser({ data: { display_name: updates.displayName } });
    }
  };

  const getToken = async () => {
    if (!user) return null;
    // Use cached session — no network call needed
    return session?.access_token || null;
  };

  const mappedUser = user ? {
    ...user,
    uid: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0],
    // Always use DB photo_url — never fall back to OAuth avatar (per CLAUDE.md)
    photoURL: userData?.photo_url || '',
  } : null;

  const mappedUserData = userData ? {
    ...userData,
    displayName: userData.display_name,
    photoURL: userData.photo_url || '',
    fgBalance: userData.fg_balance,
    membershipExpiry: userData.membership_expiry,
  } : null;

  return (
    <AuthContext.Provider value={{
      user: mappedUser,
      userData: mappedUserData,
      loading,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signInWithBattleNet,
      linkBattleNet,
      unlinkBattleNet,
      refreshUserData,
      logOut,
      resetPassword,
      updateUserProfile,
      getToken,
      accessToken: session?.access_token || null,
      isAdmin: mappedUserData?.role === 'admin' || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}
