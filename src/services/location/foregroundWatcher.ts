import * as Location from 'expo-location';

export type ForegroundWatcher = {
  stop: () => void;
};

export async function startForegroundLocationWatcher(params: {
  onCoordinate: (coord: { lng: number; lat: number }) => void;
  onError?: (message: string) => void;
}): Promise<ForegroundWatcher> {
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 1,
      timeInterval: 1000,
      mayShowUserSettingsDialog: true,
    },
    (pos) => {
      params.onCoordinate({ lng: pos.coords.longitude, lat: pos.coords.latitude });
    }
  );

  return {
    stop: () => sub.remove(),
  };
}

