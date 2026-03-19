import { create } from 'zustand';

import type { LngLat } from '@/src/types/geo';
import { haversineDistanceMeters } from '@/src/utils/distance';

type TrackingStatus = 'idle' | 'starting' | 'active' | 'stopping';

type TrackingState = {
  status: TrackingStatus;
  error: string | null;

  startedAtMs: number | null;
  elapsedSec: number;

  distanceMeters: number;
  coordinates: LngLat[];

  startRequestedAtMs: number | null;

  reset: () => void;
  start: () => void;
  stop: () => void;
  tick: (nowMs: number) => void;
  appendCoordinate: (coord: LngLat) => void;
  setError: (message: string | null) => void;
};

export const useTrackingStore = create<TrackingState>((set, get) => ({
  status: 'idle',
  error: null,

  startedAtMs: null,
  elapsedSec: 0,

  distanceMeters: 0,
  coordinates: [],

  startRequestedAtMs: null,

  reset: () =>
    set({
      status: 'idle',
      error: null,
      startedAtMs: null,
      elapsedSec: 0,
      distanceMeters: 0,
      coordinates: [],
      startRequestedAtMs: null,
    }),

  start: () => {
    const { status } = get();
    if (status === 'starting' || status === 'active') return;
    const now = Date.now();
    set({
      status: 'starting',
      error: null,
      startedAtMs: now,
      elapsedSec: 0,
      distanceMeters: 0,
      coordinates: [],
      startRequestedAtMs: now,
    });
  },

  stop: () => {
    const { status } = get();
    if (status === 'idle' || status === 'stopping') return;
    set({ status: 'stopping' });
  },

  tick: (nowMs) => {
    const { startedAtMs, status } = get();
    if (status !== 'active' || !startedAtMs) return;
    set({ elapsedSec: Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)) });
  },

  appendCoordinate: (coord) => {
    const { coordinates, distanceMeters } = get();
    const prev = coordinates[coordinates.length - 1];
    const increment = prev ? haversineDistanceMeters(prev, coord) : 0;

    // Filter obvious duplicates that sometimes appear in quick succession.
    const nextDistance = increment < 0.5 ? distanceMeters : distanceMeters + increment;

    set({
      coordinates: [...coordinates, coord],
      distanceMeters: nextDistance,
    });
  },

  setError: (message) => set({ error: message }),
}));

