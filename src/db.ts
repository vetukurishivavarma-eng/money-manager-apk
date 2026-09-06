import * as SQLite from 'expo-sqlite';
import type { Txn, ParsedTxn } from './types';

// ponytail: DB is plain SQLite in app-private storage (Android sandbox + optional
// biometric UI lock + allowBackup=false). Move to SQLCipher / expo-secure-store
// key wrapping only if the threat model grows to a rooted / forensic adversary.
export const db = SQLite.openDatabaseSync('money.db');

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS txns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sms_id TEXT UNIQUE,
      ts INTEGER NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      subcategory TEXT,
      counterparty TEXT,
      account TEXT,
      channel TEXT,
      ref_no TEXT,
      note TEXT,
      excluded INTEGER NOT NULL DEFAULT 0,
      manual INTEGER NOT NULL DEFAULT 0,
      needs_review INTEGER NOT NULL DEFAULT 0,
      is_cash INTEGER NOT NULL DEFAULT 0,
      balance REAL,
      refund_of INTEGER,
      raw TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_txns_ts ON txns(ts);
    CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, monthly REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS category_rules (pattern TEXT PRIMARY KEY, category TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ignored_accounts (account TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      saved REAL NOT NULL DEFAULT 0,
      deadline INTEGER,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  `);
  migrate();
}

// Add columns that older installs won't have. Each ALTER is harmless if it throws "duplicate column".
function migrate() {
  const have = new Set(
    db.getAllSync<{ name: string }>('PRAGMA table_info(txns)').map((r) => r.name),
  );
  const add: [string, string][] = [
    ['is_cash', 'INTEGER NOT NULL DEFAULT 0'],
    ['balance', 'REAL'],
    ['refund_of', 'INTEGER'],
  ];
  for (const [col, def] of add) {
    if (!have.has(col)) {
      try { db.execSync(`ALTER TABLE txns ADD COLUMN ${col} ${def}`); } catch {}
    }
  }
}

// ---- meta ----
export function getMeta(key: string): string | null {
  const r = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key=?', [key]);
  return r ? r.value : null;
}
export function setMeta(key: string, value: string) {
  db.runSync('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
}
export function getMetaNum(key: string, fallback: number): number {
  const v = getMeta(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
export function getFlag(key: string, def = false): boolean {
  const v = getMeta(key);
  return v == null ? def : v === '1';
}

// ---- transactions ----
export function insertParsed(
  p: ParsedTxn & {
    sms_id?: string; category: string; subcategory?: string;
    needs_review?: number; is_cash?: number; raw?: string;
  },
): boolean {
  const r = db.runSync(
    `INSERT OR IGNORE INTO txns
       (sms_id, ts, amount, direction, category, subcategory, counterparty, account, channel, ref_no, balance, raw, manual, needs_review, is_cash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    [
      p.sms_id ?? null, p.ts, p.amount, p.direction, p.category, p.subcategory ?? null,
      p.counterparty ?? null, p.account ?? null, p.channel ?? null, p.ref_no ?? null,
      p.balance ?? null, p.raw ?? null, p.needs_review ?? 0, p.is_cash ?? 0,
    ],
  );
  return r.changes > 0;
}

export function insertManual(t: Partial<Txn>) {
  db.runSync(
    `INSERT INTO txns (ts, amount, direction, category, subcategory, counterparty, note, manual, is_cash)
     VALUES (?,?,?,?,?,?,?,1,?)`,
    [
      t.ts ?? Date.now(), t.amount ?? 0, t.direction ?? 'debit', t.category ?? 'Other',
      t.subcategory ?? null, t.counterparty ?? null, t.note ?? null, t.is_cash ?? 0,
    ],
  );
}

export function updateTxn(id: number, f: Partial<Txn>) {
  const cols: string[] = [];
  const vals: any[] = [];
  for (const k of [
    'amount', 'direction', 'category', 'subcategory', 'counterparty',
    'note', 'excluded', 'needs_review', 'is_cash', 'ts',
  ] as const) {
    if (f[k] !== undefined) { cols.push(`${k}=?`); vals.push(f[k]); }
  }
  if (!cols.length) return;
  vals.push(id);
  db.runSync(`UPDATE txns SET ${cols.join(',')} WHERE id=?`, vals);
}

export function deleteTxn(id: number) {
  db.runSync('DELETE FROM txns WHERE id=?', [id]);
}
export function getTxn(id: number) {
  return db.getFirstSync<Txn>('SELECT * FROM txns WHERE id=?', [id]);
}
export function allTxns(): Txn[] {
  return db.getAllSync<Txn>('SELECT * FROM txns ORDER BY ts DESC');
}
export function txnsBetween(from: number, to: number): Txn[] {
  return db.getAllSync<Txn>('SELECT * FROM txns WHERE ts>=? AND ts<? ORDER BY ts DESC', [from, to]);
}
export function reviewCount(): number {
  const r = db.getFirstSync<{ n: number }>('SELECT COUNT(*) n FROM txns WHERE needs_review=1 AND excluded=0');
  return r?.n ?? 0;
}
export function needsReviewTxns(): Txn[] {
  return db.getAllSync<Txn>('SELECT * FROM txns WHERE needs_review=1 AND excluded=0 ORDER BY ts DESC');
}
export function distinctAccounts(): string[] {
  return db
    .getAllSync<{ account: string }>("SELECT DISTINCT account FROM txns WHERE account IS NOT NULL AND account<>'' ORDER BY account")
    .map((r) => r.account);
}

/** Latest known balance per account (from parsed "Avl Bal" in SMS). */
export function latestBalances(): { account: string; balance: number; ts: number }[] {
  return db.getAllSync(
    `SELECT t.account, t.balance, t.ts FROM txns t
     JOIN (SELECT account, MAX(ts) mx FROM txns WHERE balance IS NOT NULL GROUP BY account) m
       ON m.account = t.account AND m.mx = t.ts
     WHERE t.balance IS NOT NULL
     ORDER BY t.account`,
  );
}

/** Cash-in-hand = ATM/cash withdrawals in, minus cash spends out. */
export function cashWallet(): number {
  const inn = db.getFirstSync<{ s: number }>(
    "SELECT COALESCE(SUM(amount),0) s FROM txns WHERE is_cash=1 AND direction='debit' AND channel='ATM'",
  )?.s ?? 0;
  const out = db.getFirstSync<{ s: number }>(
    "SELECT COALESCE(SUM(amount),0) s FROM txns WHERE is_cash=1 AND direction='debit' AND (channel IS NULL OR channel<>'ATM')",
  )?.s ?? 0;
  return inn - out;
}

// ---- budgets ----
export function getBudgets(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of db.getAllSync<{ category: string; monthly: number }>('SELECT * FROM budgets')) o[r.category] = r.monthly;
  return o;
}
export function setBudget(category: string, monthly: number) {
  if (monthly > 0) {
    db.runSync('INSERT INTO budgets(category,monthly) VALUES(?,?) ON CONFLICT(category) DO UPDATE SET monthly=excluded.monthly', [category, monthly]);
  } else {
    db.runSync('DELETE FROM budgets WHERE category=?', [category]);
  }
}

// ---- category rules ----
export function getRules(): { pattern: string; category: string }[] {
  return db.getAllSync('SELECT * FROM category_rules ORDER BY pattern');
}
export function setRule(pattern: string, category: string) {
  const p = pattern.trim().toLowerCase();
  if (!p) return;
  db.runSync('INSERT INTO category_rules(pattern,category) VALUES(?,?) ON CONFLICT(pattern) DO UPDATE SET category=excluded.category', [p, category]);
}
export function deleteRule(pattern: string) {
  db.runSync('DELETE FROM category_rules WHERE pattern=?', [pattern]);
}
export function applyRuleToPast(pattern: string, category: string) {
  db.runSync("UPDATE txns SET category=? WHERE lower(counterparty) LIKE '%' || ? || '%' AND manual=0", [category, pattern.trim().toLowerCase()]);
}

// ---- ignored accounts ----
export function getIgnoredAccounts(): string[] {
  return db.getAllSync<{ account: string }>('SELECT account FROM ignored_accounts').map((r) => r.account);
}
export function toggleIgnoredAccount(account: string, ignored: boolean) {
  if (ignored) db.runSync('INSERT OR IGNORE INTO ignored_accounts(account) VALUES(?)', [account]);
  else db.runSync('DELETE FROM ignored_accounts WHERE account=?', [account]);
  db.runSync('UPDATE txns SET excluded=? WHERE account=? AND manual=0', [ignored ? 1 : 0, account]);
}

// ---- goals ----
export interface Goal { id: number; name: string; target: number; saved: number; deadline: number | null; created: number }
export function getGoals(): Goal[] {
  return db.getAllSync<Goal>('SELECT * FROM goals ORDER BY (deadline IS NULL), deadline, created');
}
export function addGoal(name: string, target: number, deadline: number | null) {
  db.runSync('INSERT INTO goals(name,target,deadline,created) VALUES(?,?,?,?)', [name, target, deadline, Date.now()]);
}
export function contributeGoal(id: number, delta: number) {
  db.runSync('UPDATE goals SET saved = MAX(0, saved + ?) WHERE id=?', [delta, id]);
}
export function deleteGoal(id: number) {
  db.runSync('DELETE FROM goals WHERE id=?', [id]);
}

export function wipeAll() {
  db.execSync('DELETE FROM txns; DELETE FROM budgets; DELETE FROM category_rules; DELETE FROM ignored_accounts; DELETE FROM goals; DELETE FROM meta;');
}
