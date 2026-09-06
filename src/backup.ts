import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import dayjs from 'dayjs';
import { db, allTxns } from './db';
import { computeSnapshot } from './summary';
// @ts-ignore
import { formatINR } from './format.js';

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

export async function monthlyReportPdf() {
  const { snapshot, categories, period } = computeSnapshot();
  const txns = allTxns()
    .filter((t) => t.ts >= period.from && t.ts < period.to && t.direction === 'debit' && !t.excluded)
    .sort((a, b) => b.amount - a.amount);
  const esc = (s: unknown) =>
    String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));

  const catRows = categories
    .filter((c) => c.spent > 0)
    .map((c) => `<tr><td>${esc(c.category)}</td><td class="r">${formatINR(c.spent)}</td><td class="r">${c.budget ? formatINR(c.budget) : '—'}</td></tr>`)
    .join('');
  const txnRows = txns
    .slice(0, 60)
    .map((t) => `<tr><td>${dayjs(t.ts).format('DD MMM')}</td><td>${esc(t.counterparty || '—')}</td><td>${esc(t.category)}${t.subcategory ? ' / ' + esc(t.subcategory) : ''}</td><td class="r">${formatINR(t.amount)}</td></tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,sans-serif;color:#12211C;padding:28px}
    h1{color:#0B3D2E;margin:0 0 2px} .sub{color:#5C6B65;margin-bottom:18px}
    .kpi{display:flex;gap:24px;margin:14px 0 22px}
    .kpi div{font-size:13px;color:#5C6B65} .kpi b{display:block;font-size:20px;color:#12211C}
    table{width:100%;border-collapse:collapse;margin-bottom:22px;font-size:13px}
    th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #E4E9E7} th{color:#5C6B65}
    .r{text-align:right}
  </style></head><body>
    <h1>Money Tracker</h1><div class="sub">${esc(snapshot.month)} · generated ${dayjs().format('DD MMM YYYY')}</div>
    <div class="kpi">
      <div>Spent<b>${formatINR(snapshot.spent)}</b></div>
      <div>Income<b>${formatINR(snapshot.income)}</b></div>
      <div>Net<b>${formatINR(snapshot.income - snapshot.spent)}</b></div>
      <div>Budget<b>${snapshot.budget ? formatINR(snapshot.budget) : '—'}</b></div>
    </div>
    <h3>By category</h3>
    <table><tr><th>Category</th><th class="r">Spent</th><th class="r">Budget</th></tr>${catRows}</table>
    <h3>Transactions</h3>
    <table><tr><th>Date</th><th>Merchant</th><th>Category</th><th class="r">Amount</th></tr>${txnRows}</table>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Monthly report' });
}

function dump() {
  return {
    v: 2,
    exportedAt: Date.now(),
    txns: db.getAllSync('SELECT * FROM txns'),
    budgets: db.getAllSync('SELECT * FROM budgets'),
    category_rules: db.getAllSync('SELECT * FROM category_rules'),
    ignored_accounts: db.getAllSync('SELECT * FROM ignored_accounts'),
    goals: db.getAllSync('SELECT * FROM goals'),
    meta: db.getAllSync('SELECT * FROM meta'),
  };
}

// settings that are safe to carry across a restore (no auth / lock state)
const RESTORABLE_META = new Set([
  'overall_budget', 'large_txn_threshold', 'cycle_start_day',
  'rollover', 'weekly_review', 'track_cash', 'expected_income',
]);
const num = (v: unknown) =>
  v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;

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
  if (text.length > 20_000_000) throw new Error('Backup file is too large');
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON'); }
  if (!data || !Array.isArray(data.txns)) throw new Error('Not a Money Tracker backup');

  let added = 0;
  db.withTransactionSync(() => {
    for (const t of data.txns) {
      const ts = num(t?.ts);
      const amount = num(t?.amount);
      const dir = t?.direction === 'credit' ? 'credit' : t?.direction === 'debit' ? 'debit' : null;
      if (ts === null || amount === null || amount < 0 || dir === null) continue; // skip garbage rows
      // manual rows have no sms_id, so INSERT OR IGNORE can't dedupe them on re-restore
      if (!t.sms_id) {
        const dup = db.getFirstSync<{ n: number }>(
          "SELECT COUNT(*) n FROM txns WHERE manual=1 AND ts=? AND amount=? AND direction=? AND IFNULL(counterparty,'')=?",
          [ts, amount, dir, t.counterparty ? String(t.counterparty) : ''],
        );
        if ((dup?.n ?? 0) > 0) continue;
      }
      const r = db.runSync(
        `INSERT OR IGNORE INTO txns
         (sms_id, ts, amount, direction, category, subcategory, counterparty, account, channel, ref_no, note, excluded, manual, needs_review, is_cash, balance, raw)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          t.sms_id ? String(t.sms_id) : null, ts, amount, dir, String(t.category ?? 'Other'),
          t.subcategory ? String(t.subcategory) : null, t.counterparty ? String(t.counterparty) : null,
          t.account ? String(t.account) : null, t.channel ? String(t.channel) : null,
          t.ref_no ? String(t.ref_no) : null, t.note ? String(t.note).slice(0, 500) : null,
          t.excluded ? 1 : 0, t.manual ? 1 : 0, t.needs_review ? 1 : 0, t.is_cash ? 1 : 0,
          num(t.balance), t.raw ? String(t.raw).slice(0, 2000) : null,
        ],
      );
      added += r.changes;
    }
    for (const b of data.budgets ?? []) {
      const m = num(b?.monthly);
      if (b?.category && m !== null && m >= 0) {
        db.runSync('INSERT OR REPLACE INTO budgets(category,monthly) VALUES(?,?)', [String(b.category), m]);
      }
    }
    for (const c of data.category_rules ?? []) {
      if (c?.pattern && c?.category) {
        db.runSync('INSERT OR REPLACE INTO category_rules(pattern,category) VALUES(?,?)', [String(c.pattern).toLowerCase().slice(0, 60), String(c.category)]);
      }
    }
    for (const g of data.goals ?? []) {
      const target = num(g?.target);
      const name = g?.name ? String(g.name).slice(0, 80) : '';
      if (!name || target === null || target <= 0) continue;
      const dup = db.getFirstSync<{ n: number }>('SELECT COUNT(*) n FROM goals WHERE name=? AND target=?', [name, target]);
      if ((dup?.n ?? 0) > 0) continue; // don't re-add a goal that's already here
      db.runSync('INSERT INTO goals(name,target,saved,deadline,created) VALUES(?,?,?,?,?)', [
        name, target, Math.max(0, num(g.saved) ?? 0), num(g.deadline), num(g.created) ?? Date.now(),
      ]);
    }
    for (const m of data.meta ?? []) {
      if (RESTORABLE_META.has(m?.key)) {
        db.runSync('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)', [m.key, String(m.value ?? '').slice(0, 40)]);
      }
    }
  });
  return added;
}
