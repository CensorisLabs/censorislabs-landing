/**
 * Database connection for Censoris.
 *
 * - expo-sqlite with async API (does not block the UI thread).
 * - The database lives in app-private storage. At-rest encryption with
 *   SQLCipher is planned once we prebuild with a SQLCipher-enabled library;
 *   see docs/DECISIONS.md for the current status. The app lock protects the
 *   data in the meantime.
 * - Migrations run on every startup (fast: no-ops once applied).
 */
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations';

const DB_NAME = 'censoris.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  try {
    return await dbPromise;
  } catch (error) {
    dbPromise = null; // allow retry on failure
    throw error;
  }
}

/** Test hook: force a fresh connection (e.g. after wiping data). */
export function resetDbConnection(): void {
  dbPromise = null;
}
