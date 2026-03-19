import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type ActivityType = {
  id: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
};

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: 'WALK',  label: 'Walk',  icon: 'walk',    color: '#10b981' },
  { id: 'RUN',   label: 'Run',   icon: 'fitness', color: '#ef4444' },
  { id: 'DRIVE', label: 'Drive', icon: 'car',     color: '#3b82f6' },
];

/** Keyed by id for fast O(1) lookup in history / detail screens */
export const ACTIVITY_META: Record<string, ActivityType> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.id, t])
);
