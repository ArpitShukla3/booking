import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SESSION_KEY, useTravellerStore } from '@/store/useTravellerStore';
import { Button } from '@/components/ui/button';
import { LoadingState, PageContainer } from '@/components/shared/common';

export function SessionLifecycle() {
  const expiresAt = useTravellerStore(state => state.expiresAt);
  useEffect(() => {
    void useTravellerStore.getState().restoreSession();
    const check = () => useTravellerStore.getState().ensureValidSession();
    const sync = (event: StorageEvent) => { if (event.key === SESSION_KEY || event.key === null) void useTravellerStore.getState().restoreSession(true); };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', check); window.addEventListener('storage', sync); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', check); window.removeEventListener('storage', sync); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => {
    if (!expiresAt) return;
    let timer: number;
    const schedule = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) useTravellerStore.getState().logout('Your remembered sign-in expired. Enter your Traveller ID to continue.');
      else timer = window.setTimeout(schedule, Math.min(remaining, 2147483647));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  return null;
}
export function RequireTraveller({ children }: { children: ReactNode }) {
  const traveller = useTravellerStore(state => state.traveller);
  const initialized = useTravellerStore(state => state.isInitialized);
  const loading = useTravellerStore(state => state.isLoading);
  const error = useTravellerStore(state => state.restoreError);
  const location = useLocation();
  if (!initialized || loading) return <PageContainer className="page-content"><LoadingState /></PageContainer>;
  if (error) return <PageContainer className="page-content"><section className="error-state" role="alert"><h1>We couldn’t restore your profile</h1><p>{error}</p><p>Your remembered sign-in has been kept so you can try again.</p><Button onClick={() => void useTravellerStore.getState().restoreSession(true)}>Retry profile restoration</Button><Button variant="outline" onClick={() => useTravellerStore.getState().logout()}>Use another Traveller ID</Button></section></PageContainer>;
  if (!traveller) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}
export function HomeSessionRedirect({ children }: { children: ReactNode }) {
  const traveller = useTravellerStore(state => state.traveller);
  const initialized = useTravellerStore(state => state.isInitialized);
  if (!initialized) return <PageContainer className="page-content"><LoadingState /></PageContainer>;
  return traveller ? <Navigate to="/dashboard" replace /> : children;
}
