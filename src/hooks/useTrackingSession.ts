import { useCallback, useEffect, useRef } from 'react';

import { useForegroundLocationPermission } from '@/src/hooks/useForegroundLocationPermission';
import { startForegroundLocationWatcher, type ForegroundWatcher } from '@/src/services/location/foregroundWatcher';
import { useTrackingStore } from '@/src/store/trackingStore';

export function useTrackingSession() {
  const { state: permission, request } = useForegroundLocationPermission();
  const status = useTrackingStore((s) => s.status);
  const error = useTrackingStore((s) => s.error);
  const getSessionState = useCallback(() => {
    const s = useTrackingStore.getState();
    return {
      startedAtMs: s.startedAtMs,
      elapsedSec: s.elapsedSec,
      distanceMeters: s.distanceMeters,
      coordinates: s.coordinates,
    };
  }, []);

  const start = useTrackingStore((s) => s.start);
  const stop = useTrackingStore((s) => s.stop);
  const tick = useTrackingStore((s) => s.tick);
  const appendCoordinate = useTrackingStore((s) => s.appendCoordinate);
  const setError = useTrackingStore((s) => s.setError);

  const watcherRef = useRef<ForegroundWatcher | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ensurePermission = useCallback(async () => {
    if (permission.status === 'granted') return true;
    if (permission.status === 'denied' && !permission.canAskAgain) return false;
    return await request();
  }, [permission, request]);

  useEffect(() => {
    if (status !== 'starting') return;

    let cancelled = false;

    (async () => {
      const ok = await ensurePermission();
      if (!ok) {
        useTrackingStore.setState({ status: 'idle' });
        setError('Location permission is required to start tracking.');
        return;
      }

      try {
        watcherRef.current = await startForegroundLocationWatcher({
          onCoordinate: ({ lng, lat }) => {
            appendCoordinate([lng, lat]);
          },
          onError: (msg) => setError(msg),
        });

        useTrackingStore.setState({ status: 'active' });

        timerRef.current = setInterval(() => {
          tick(Date.now());
        }, 1000);
      } catch (e) {
        if (cancelled) return;
        useTrackingStore.setState({ status: 'idle' });
        setError(e instanceof Error ? e.message : 'Failed to start tracking.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appendCoordinate, ensurePermission, setError, status, tick]);

  useEffect(() => {
    if (status !== 'stopping') return;

    watcherRef.current?.stop();
    watcherRef.current = null;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    useTrackingStore.setState({ status: 'idle' });
  }, [status]);

  useEffect(() => {
    return () => {
      watcherRef.current?.stop();
      watcherRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const startTracking = useCallback(() => {
    setError(null);
    start();
  }, [setError, start]);

  const stopTracking = useCallback(() => {
    stop();
  }, [stop]);

  const resetTracking = useCallback(() => {
    useTrackingStore.getState().reset();
  }, []);

  return {
    permission,
    requestPermission: request,
    status,
    error,
    getSessionState,
    startTracking,
    stopTracking,
    resetTracking,
  };
}

