/**
 * Versioned schema migrations for Censoris.
 *
 * Rules:
 * - Migrations are append-only. Never edit an applied migration; add a new one.
 * - PRAGMA user_version tracks the current version.
 * - Money columns are always INTEGER paise (amount_paise).
 */

/** The minimal database surface migrations need. Keeps them testable. */
export interface MigrationDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string): Promise<unknown>;
}

export interface Migration {
  version: number;
  name: string;
  up(db: MigrationDb): Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'settings and accounts',
    async up(db) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id                   TEXT PRIMARY KEY NOT NULL,
          name                 TEXT NOT NULL,
          type                 TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'wallet', 'credit_card')),
          opening_balance_paise INTEGER NOT NULL DEFAULT 0,
          archived             INTEGER NOT NULL DEFAULT 0,
          sort_order           INTEGER NOT NULL DEFAULT 0,
          created_at           INTEGER NOT NULL
        );
      `);
    },
  },
  // Phase 2 adds: categories, transactions, merchant_rules (+ indexes)
  // Phase 3 adds: bills, bill_payments, festivals, festival_budgets, goals...
];

/**
 * Apply pending migrations in order. Safe to call on every startup.
 * Returns the final schema version.
 */
export async function migrate(db: MigrationDb & { getFirstAsync<T>(sql: string): Promise<T | null> }): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    let began = false;
    try {
      await db.execAsync('BEGIN');
      began = true;
      await migration.up(db);
      // PRAGMA cannot be parameterised; version is a validated integer from our own array.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      await db.execAsync('COMMIT');
    } catch (error) {
      // Only roll back if the transaction actually started, so the original
      // error is never masked by a secondary "no transaction" failure.
      if (began) {
        try {
          await db.execAsync('ROLLBACK');
        } catch {
          // ignore; the first error is what matters
        }
      }
      throw error;
    }
    current = migration.version;
  }
  return current;
}
