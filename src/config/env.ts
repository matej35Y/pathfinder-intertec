export function getRequiredPublicEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getMapTilerKeyFromEnv(): string {
  const raw = getRequiredPublicEnv(
    'EXPO_PUBLIC_MAPTILER_API_KEY',
    process.env.EXPO_PUBLIC_MAPTILER_API_KEY
  ).trim();

  // Be forgiving: if a full MapTiler URL is pasted, extract ?key=...
  if (raw.includes('key=')) {
    try {
      const url = new URL(raw);
      const key = url.searchParams.get('key');
      if (key && key.trim().length > 0) return key.trim();
    } catch {
      const m = raw.match(/[?&]key=([^&#]+)/);
      if (m?.[1]) return decodeURIComponent(m[1]).trim();
    }
  }

  return raw;
}

