// Detect subscriptions / recurring debits from transaction history. Pure.
const DAY = 86400000;

function normPayee(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
}

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// txns: [{ ts, amount, direction, category, counterparty, excluded }]
// returns [{ payee, category, amount, count, lastTs, nextTs, monthlyEstimate, cadenceDays }]
function detectRecurring(txns) {
  const groups = {};
  for (const t of txns) {
    if (!t || t.direction !== 'debit' || t.excluded) continue;
    const k = normPayee(t.counterparty);
    if (!k || k.length < 3) continue;
    (groups[k] = groups[k] || []).push(t);
  }

  const out = [];
  for (const k of Object.keys(groups)) {
    const g = groups[k].sort((a, b) => a.ts - b.ts);
    if (g.length < 2) continue;

    const months = new Set(g.map((t) => new Date(t.ts).getFullYear() + '-' + new Date(t.ts).getMonth()));
    if (months.size < 2) continue;

    const amts = g.map((t) => t.amount);
    const med = median(amts);
    if (!med) continue;
    const stable = amts.every((a) => Math.abs(a - med) / med <= 0.15);
    if (!stable) continue;

    const gaps = [];
    for (let i = 1; i < g.length; i++) gaps.push(g[i].ts - g[i - 1].ts);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 20 * DAY || avgGap > 100 * DAY) continue; // roughly monthly/quarterly only

    const last = g[g.length - 1];
    const cadenceDays = Math.round(avgGap / DAY);
    out.push({
      payee: last.counterparty,
      category: last.category,
      amount: med,
      count: g.length,
      lastTs: last.ts,
      nextTs: last.ts + avgGap,
      cadenceDays,
      monthlyEstimate: med * (30 / cadenceDays),
    });
  }
  return out.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}

module.exports = { detectRecurring, normPayee };
