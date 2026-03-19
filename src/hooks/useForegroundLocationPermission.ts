import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';

export type ForegroundPermissionState =
  | { status: 'checking' }
  | { status: 'granted' }
  | { status: 'denied'; canAskAgain: boolean };

export function useForegroundLocationPermission() {
  const [state, setState] = useState<ForegroundPermissionState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (res.granted) setState({ status: 'granted' });
      else setState({ status: 'denied', canAskAgain: res.canAskAgain });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    if (res.granted) setState({ status: 'granted' });
    else setState({ status: 'denied', canAskAgain: res.canAskAgain });
    return res.granted;
  }, []);

  return useMemo(
    () => ({
      state,
      request,
    }),
    [request, state]
  );
}

