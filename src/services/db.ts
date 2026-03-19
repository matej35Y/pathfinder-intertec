import * as SQLite from 'expo-sqlite';
import { LngLat } from '@/src/types/geo';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const DB_NAME = 'pathfinder.db';

export type TrackingSessionRecord = {
  id: string;
  name: string | null;
  activityType: string | null;
  distanceMeters: number;
  durationSec: number;
  coordinates: LngLat[];
  createdAtMs: number;
};

export async function initDB() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tracking_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      distanceMeters REAL NOT NULL,
      durationSec INTEGER NOT NULL,
      coordinates_json TEXT NOT NULL,
      createdAtMs INTEGER NOT NULL
    );
  `);
  // Add name column to existing databases that predate this feature
  try {
    await db.execAsync(`ALTER TABLE tracking_sessions ADD COLUMN name TEXT;`);
  } catch { }
  try {
    await db.execAsync(`ALTER TABLE tracking_sessions ADD COLUMN activityType TEXT;`);
  } catch { }
}

export async function saveSession(
  distanceMeters: number,
  durationSec: number,
  coordinates: LngLat[],
  startedAtMs: number,
  name?: string | null,
  activityType?: string | null
): Promise<TrackingSessionRecord> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const session: TrackingSessionRecord = {
    id: generateId(),
    name: name || null,
    activityType: activityType || null,
    distanceMeters,
    durationSec,
    coordinates,
    createdAtMs: startedAtMs,
  };

  await db.runAsync(
    'INSERT INTO tracking_sessions (id, name, activityType, distanceMeters, durationSec, coordinates_json, createdAtMs) VALUES (?, ?, ?, ?, ?, ?, ?)',
    session.id,
    session.name,
    session.activityType,
    session.distanceMeters,
    session.durationSec,
    JSON.stringify(session.coordinates),
    session.createdAtMs
  );

  return session;
}

export async function getHistorySessions(): Promise<TrackingSessionRecord[]> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const rows = await db.getAllAsync<{
      id: string;
      name: string | null;
      activityType: string | null;
      distanceMeters: number;
      durationSec: number;
      coordinates_json: string;
      createdAtMs: number;
    }>('SELECT * FROM tracking_sessions ORDER BY createdAtMs DESC');

    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? null,
      activityType: row.activityType ?? null,
      distanceMeters: row.distanceMeters,
      durationSec: row.durationSec,
      coordinates: JSON.parse(row.coordinates_json),
      createdAtMs: row.createdAtMs,
    }));
  } catch (err) {
    console.error('Failed to load history sessions', err);
    return [];
  }
}

export async function getSessionById(id: string): Promise<TrackingSessionRecord | null> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const row = await db.getFirstAsync<{
      id: string;
      name: string | null;
      activityType: string | null;
      distanceMeters: number;
      durationSec: number;
      coordinates_json: string;
      createdAtMs: number;
    }>('SELECT * FROM tracking_sessions WHERE id = ?', id);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name ?? null,
      activityType: row.activityType ?? null,
      distanceMeters: row.distanceMeters,
      durationSec: row.durationSec,
      coordinates: JSON.parse(row.coordinates_json),
      createdAtMs: row.createdAtMs,
    };
  } catch (err) {
    console.error('Failed to load session by id', err);
    return null;
  }
}

export async function updateSessionName(id: string, name: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.runAsync('UPDATE tracking_sessions SET name = ? WHERE id = ?', name.trim() || null, id);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.runAsync('DELETE FROM tracking_sessions WHERE id = ?', id);
}
