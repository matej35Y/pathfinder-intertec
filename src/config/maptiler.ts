import { getMapTilerKeyFromEnv } from './env';

export function getMapTilerStyleUrl(): string {
  const key = getMapTilerKeyFromEnv() || "0ZSuddmV7eFsqG8PpHgc";
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key)}`;
}

export function getMapTilerRasterUrl(): string {
  try {
    const key = getMapTilerKeyFromEnv() || "0ZSuddmV7eFsqG8PpHgc";
    return `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`;
  } catch {
    return "";
  }
}

