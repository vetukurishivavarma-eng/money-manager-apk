import * as SQLite from 'expo-sqlite';
import type { Txn, ParsedTxn } from './types';

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
      raw TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_txns_ts ON txns(ts);
    CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, monthly REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS category_rules (pattern TEXT PRIMARY KEY, category TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ignored_accounts (account TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  `);
}

// ---- meta ----
export function getMeta(key: string): string | null {
  const r = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key=?', [key]);
  return r ? r.value : null;
}
export function setMeta(key: string, value: string) {
  db.runSync('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
}

// ---- transactions ----
export function insertParsed(
  p: ParsedTxn & { sms_id?: string; category: string; subcategory?: string; needs_review?: number; raw?: string },
): boolean {
  const r = db.runSync(
    `INSERT OR IGNORE INTO txns (sms_id, ts, amount, direction, category, subcategory, counterparty, account, channel, ref_no, raw, manual, needs_review)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?)`,
    [
      p.sms_id ?? null, p.ts, p.amount, p.direction, p.category, p.subcategory ?? null,
      p.counterparty ?? null, p.account ?? null, p.channel ?? null, p.ref_no ?? null, p.raw ?? null,
      p.needs_review ?? 0,
    ],
  );
  return r.changes > 0;
}

export function insertManual(t: Partial<Txn>) {
  db.runSync(
    `INSERT INTO txns (ts, amount, direction, category, subcategory, counterparty, note, manual)
     VALUES (?,?,?,?,?,?,?,1)`,
    [t.ts ?? Date.now(), t.amount ?? 0, t.direction ?? 'debit', t.category ?? 'Other', t.subcategory ?? null, t.counterparty ?? null, t.note ?? null],
  );
}

export function updateTxn(id: number, f: Partial<Txn>) {
  const cols: string[] = [];
  const vals: any[] = [];
  for (const k of ['amount', 'direction', 'category', 'subcategory', 'counterparty', 'note', 'excluded', 'needs_review', 'ts'] as const) {
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

// ---- category rules (learned overrides) ----
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
// re-apply a rule to existing rows
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
  // reflect on existing rows
  db.runSync('UPDATE txns SET excluded=? WHERE account=? AND manual=0', [ignored ? 1 : 0, account]);
}

export function wipeAll() {
  db.execSync('DELETE FROM txns; DELETE FROM budgets; DELETE FROM category_rules; DELETE FROM ignored_accounts; DELETE FROM meta;');
}
