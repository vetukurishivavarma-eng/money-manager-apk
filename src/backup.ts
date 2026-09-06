import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import dayjs from 'dayjs';
import { db, allTxns } from './db';

const q = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportCsv() {
  const rows = allTxns();
  const head = 'date,time,direction,amount,category,subcategory,counterparty,account,channel,note,excluded,source\n';
  const body = rows
    .map((t) =>
      [
        dayjs(t.ts).format('YYYY-MM-DD'),
        dayjs(t.ts).format('HH:mm'),
        t.direction,
        t.amount,
        q(t.category),
        q(t.subcategory),
        q(t.counterparty),
        q(t.account),
        q(t.channel),
        q(t.note),
        t.excluded ? 'yes' : 'no',
        t.manual ? 'manual' : 'sms',
      ].join(','),
    )
    .join('\n');
  const uri = FileSystem.cacheDirectory + `money-tracker-${dayjs().format('YYYYMMDD')}.csv`;
  await FileSystem.writeAsStringAsync(uri, head + body);
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions (CSV)' });
}

function dump() {
  return {
    v: 1,
    exportedAt: Date.now(),
    txns: db.getAllSync('SELECT * FROM txns'),
    budgets: db.getAllSync('SELECT * FROM budgets'),
    category_rules: db.getAllSync('SELECT * FROM category_rules'),
    ignored_accounts: db.getAllSync('SELECT * FROM ignored_accounts'),
    meta: db.getAllSync('SELECT * FROM meta'),
  };
}

export async function backupJson() {
  const uri = FileSystem.cacheDirectory + `money-tracker-backup-${dayjs().format('YYYYMMDD-HHmm')}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(dump()));
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save backup' });
}

/** Merge a backup file into the current database. Returns rows added. */
export async function restoreJson(): Promise<number> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return 0;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.txns)) throw new Error('Not a Money Tracker backup');

  let added = 0;
  db.withTransactionSync(() => {
    for (const t of data.txns) {
      const r = db.runSync(
        `INSERT OR IGNORE INTO txns
         (sms_id, ts, amount, direction, category, subcategory, counterparty, account, channel, ref_no, note, excluded, manual, needs_review, raw)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          t.sms_id ?? null, t.ts, t.amount, t.direction, t.category ?? 'Other', t.subcategory ?? null,
          t.counterparty ?? null, t.account ?? null, t.channel ?? null, t.ref_no ?? null, t.note ?? null,
          t.excluded ?? 0, t.manual ?? 0, t.needs_review ?? 0, t.raw ?? null,
        ],
      );
      added += r.changes;
    }
    for (const b of data.budgets ?? []) {
      db.runSync('INSERT OR REPLACE INTO budgets(category,monthly) VALUES(?,?)', [b.category, b.monthly]);
    }
    for (const c of data.category_rules ?? []) {
      db.runSync('INSERT OR REPLACE INTO category_rules(pattern,category) VALUES(?,?)', [c.pattern, c.category]);
    }
    for (const m of data.meta ?? []) {
      if (m.key === 'overall_budget' || m.key === 'large_txn_threshold') {
        db.runSync('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)', [m.key, m.value]);
      }
    }
  });
  return added;
}
