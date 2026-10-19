/**
 * Accounts repository. Phase 1 only needs creation during onboarding and a
 * list; Phase 2 builds balances and transfers on top.
 */
import { assertPaise, type Paise } from '../domain/money';
import { getDb } from './db';

export type AccountType = 'cash' | 'bank' | 'wallet' | 'credit_card';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalancePaise: Paise;
  archived: boolean;
  sortOrder: number;
}

interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  opening_balance_paise: number;
  archived: number;
  sort_order: number;
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalancePaise: row.opening_balance_paise,
    archived: row.archived === 1,
    sortOrder: row.sort_order,
  };
}

/** Simple collision-free id without a native dependency: time + random. */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createAccount(params: {
  name: string;
  type: AccountType;
  openingBalancePaise: Paise;
  sortOrder?: number;
}): Promise<Account> {
  assertPaise(params.openingBalancePaise, 'openingBalancePaise');
  const db = await getDb();
  const account: Account = {
    id: newId(),
    name: params.name,
    type: params.type,
    openingBalancePaise: params.openingBalancePaise,
    archived: false,
    sortOrder: params.sortOrder ?? 0,
  };
  await db.runAsync(
    'INSERT INTO accounts (id, name, type, opening_balance_paise, archived, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    [account.id, account.name, account.type, account.openingBalancePaise, account.sortOrder, Date.now()],
  );
  return account;
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const db = await getDb();
  const sql = includeArchived
    ? 'SELECT * FROM accounts ORDER BY sort_order, name'
    : 'SELECT * FROM accounts WHERE archived = 0 ORDER BY sort_order, name';
  const rows = await db.getAllAsync<AccountRow>(sql);
  return rows.map(rowToAccount);
}

export async function getAccount(id: string): Promise<Account | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
  return row ? rowToAccount(row) : null;
}
