import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
// @ts-ignore - plain JS pure modules
import { parseSms } from './parse.js';
// @ts-ignore
import { categorize, subcategorize } from '../categorize.js';
import {
  db, getMeta, setMeta, insertParsed, getRules, getIgnoredAccounts, getFlag,
} from '../db';
import type { ParsedTxn } from '../types';

const DAY = 86400000;

export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read transaction SMS',
    message:
      'Money Tracker reads your bank SMS on this phone to log spending automatically. ' +
      'Messages are processed on-device and never leave your phone.',
    buttonPositive: 'Allow',
  });
  return g === PermissionsAndroid.RESULTS.GRANTED;
}

interface RawSms { _id: string; address: string; body: string; date: number }

function listSms(minDate: number): Promise<RawSms[]> {
  return new Promise((resolve, reject) => {
    SmsAndroid.list(
      JSON.stringify({ box: 'inbox', minDate, maxCount: 10000 }),
      (err) => reject(new Error(err)),
      (_n, json) => {
        try { resolve(JSON.parse(json)); } catch (e) { reject(e as Error); }
      },
    );
  });
}

interface Picked { category: string; subcategory: string | null; review: number }

function pickCategory(counterparty: string | undefined, channel: string | undefined, direction: string): Picked {
  const sub = (cat: string, text: string): string | null => (subcategorize(cat, text) as string | null) ?? null;
  if (direction === 'credit') {
    // don't blanket-label credits "Refund" — that's what drives refund-matching,
    // and most credits (P2P, interest, reimbursements) are not refunds
    return { category: 'Income', subcategory: sub('Income', counterparty || ''), review: 0 };
  }
  const text = counterparty || '';
  // 1. user-learned rules (substring on payee)
  for (const r of getRules()) {
    if (text.toLowerCase().includes(r.pattern)) {
      return { category: r.category, subcategory: sub(r.category, text), review: 0 };
    }
  }
  // 2. built-in keyword map
  const c = categorize(counterparty, undefined, channel) as string | null;
  if (c) return { category: c, subcategory: sub(c, text), review: 0 };
  // 3. give up -> Other, flag for the user to fix later
  return { category: 'Other', subcategory: null, review: 1 };
}

export interface ScanResult {
  added: number;
  newDebits: { amount: number; counterparty: string | null }[];
}

/** Scan the SMS inbox and insert new transactions. */
export async function scanSms(opts: { full?: boolean } = {}): Promise<ScanResult> {
  if (!(await hasSmsPermission())) return { added: 0, newDebits: [] };

  const last = Number(getMeta('last_scan_ts') || 0);
  const since = opts.full || !last ? Date.now() - 185 * DAY : Math.max(0, last - 3 * DAY);

  let msgs: RawSms[];
  try {
    msgs = await listSms(since);
  } catch {
    return { added: 0, newDebits: [] };
  }

  const ignored = new Set(getIgnoredAccounts());
  const trackCash = getFlag('track_cash');
  const newDebits: { amount: number; counterparty: string | null }[] = [];
  let added = 0;

  for (const m of msgs) {
    const p = parseSms(m.body, m.address, Number(m.date)) as ParsedTxn | null;
    if (!p) continue;

    const isAtm = p.direction === 'debit' && p.channel === 'ATM';
    let { category, subcategory, review } = pickCategory(p.counterparty, p.channel, p.direction);
    if (isAtm) { category = 'Cash/ATM'; subcategory = 'ATM Withdrawal'; review = 0; }

    const isIgnored = p.account && ignored.has(p.account) ? 1 : 0;
    const ok = insertParsed({
      ...p,
      sms_id: String(m._id),
      category,
      subcategory: subcategory || undefined,
      needs_review: isIgnored ? 0 : review,
      is_cash: isAtm && trackCash ? 1 : 0,
      raw: m.body,
    });
    if (ok) {
      added++;
      // an ATM withdrawal isn't a spend when cash tracking is on — it moves money to the wallet
      if (isIgnored || (isAtm && trackCash)) db.runSync('UPDATE txns SET excluded=1 WHERE sms_id=?', [String(m._id)]);
      else if (p.direction === 'debit') newDebits.push({ amount: p.amount, counterparty: p.counterparty ?? null });
    }
  }

  markInternalTransfers();
  matchRefunds();
  setMeta('last_scan_ts', String(Date.now()));
  return { added, newDebits };
}

const norm = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Link a refund credit to the original debit and net both out of spending.
 * Conservative on purpose: only credits whose SMS text actually says
 * refund/reversal/chargeback qualify (a friend repaying your share never does),
 * and the original debit must plausibly be the same merchant.
 */
function matchRefunds() {
  const credits = db.getAllSync<{ id: number; ts: number; amount: number; counterparty: string | null; raw: string | null }>(
    `SELECT id, ts, amount, counterparty, raw FROM txns
     WHERE direction='credit' AND excluded=0 AND refund_of IS NULL
       AND (lower(raw) LIKE '%refund%' OR lower(raw) LIKE '%reversed%'
            OR lower(raw) LIKE '%reversal%' OR lower(raw) LIKE '%chargeback%')`,
  );
  for (const c of credits) {
    const cands = db.getAllSync<{ id: number; counterparty: string | null }>(
      `SELECT id, counterparty FROM txns
       WHERE direction='debit' AND excluded=0 AND refund_of IS NULL
         AND ts <= ? AND ts >= ? AND ABS(amount - ?) < 1
       ORDER BY ts DESC`,
      [c.ts, c.ts - 45 * DAY, c.amount],
    );
    if (!cands.length) continue;
    const cName = norm(c.counterparty);
    const rawN = norm(c.raw);
    const match = cands.find((d) => {
      const dName = norm(d.counterparty);
      if (!dName) return false;
      return (
        (cName && (dName.includes(cName.slice(0, 6)) || cName.includes(dName.slice(0, 6)))) ||
        (dName.length >= 5 && rawN.includes(dName.slice(0, 8)))
      );
    }) || (cands.length === 1 ? cands[0] : null);
    if (match) {
      db.runSync('UPDATE txns SET excluded=1, refund_of=? WHERE id=?', [match.id, c.id]);
      db.runSync('UPDATE txns SET excluded=1 WHERE id=?', [match.id]);
    }
  }
}

/**
 * Pair a debit with a matching credit (same amount, within 12h, one side has a
 * transfer-like channel) and exclude both — self-transfers / wallet loads shouldn't
 * count as spending.
 */
function markInternalTransfers() {
  const rows = db.getAllSync<{ id: number; ts: number; amount: number; direction: string; channel: string | null }>(
    "SELECT id, ts, amount, direction, channel FROM txns WHERE excluded=0 AND manual=0 AND ts > ?",
    [Date.now() - 200 * DAY],
  );
  const debits = rows.filter((r) => r.direction === 'debit');
  const credits = rows.filter((r) => r.direction === 'credit');
  for (const d of debits) {
    const match = credits.find(
      (c) => Math.abs(c.amount - d.amount) < 1 && Math.abs(c.ts - d.ts) < 12 * 3600 * 1000,
    );
    if (match) {
      db.runSync("UPDATE txns SET excluded=1, category='Transfers', subcategory='To Self' WHERE id IN (?,?)", [d.id, match.id]);
      credits.splice(credits.indexOf(match), 1);
    }
  }
}
