import { migrate, migrations, type MigrationDb } from '../migrations';

/** In-memory stand-in for the SQLite handle migrations run against. */
class FakeDb implements MigrationDb {
  userVersion = 0;
  executedSql: string[] = [];
  /** When true, the migration body itself fails (after BEGIN succeeded). */
  failOnCreateTable = false;

  async execAsync(sql: string): Promise<void> {
    this.executedSql.push(sql);
    const pragma = sql.match(/^PRAGMA user_version = (\d+)$/);
    if (pragma) {
      this.userVersion = Number(pragma[1]);
      return;
    }
    if (this.failOnCreateTable && sql.includes('CREATE TABLE')) {
      throw new Error('simulated migration failure');
    }
  }

  async runAsync(sql: string): Promise<unknown> {
    this.executedSql.push(sql);
    return { changes: 0 };
  }

  async getFirstAsync<T>(_sql: string): Promise<T | null> {
    return { user_version: this.userVersion } as T;
  }
}

describe('migrate', () => {
  it('applies all pending migrations from scratch', async () => {
    const db = new FakeDb();
    const version = await migrate(db);
    expect(version).toBe(migrations[migrations.length - 1].version);
    expect(db.userVersion).toBe(version);
    expect(db.executedSql.some((s) => s.includes('CREATE TABLE'))).toBe(true);
  });

  it('is a no-op when already up to date', async () => {
    const db = new FakeDb();
    await migrate(db);
    db.executedSql = [];
    const version = await migrate(db);
    expect(version).toBe(db.userVersion);
    expect(db.executedSql.some((s) => s.includes('CREATE TABLE'))).toBe(false);
  });

  it('rolls back and rethrows when a migration fails', async () => {
    const db = new FakeDb();
    db.failOnCreateTable = true;
    await expect(migrate(db)).rejects.toThrow('simulated migration failure');
    expect(db.userVersion).toBe(0);
    expect(db.executedSql).toContain('ROLLBACK');
  });

  it('has strictly increasing, gap-free versions starting at 1', () => {
    migrations.forEach((m, i) => {
      expect(m.version).toBe(i + 1);
      expect(m.name.length).toBeGreaterThan(0);
    });
  });
});
