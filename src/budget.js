// Pure budget math. Works on plain txn objects: { ts, amount, direction, category, excluded }.
const DAY = 86400000;

function monthKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function isSpend(t) {
  return t && t.direction === 'debit' && !t.excluded;
}

function totalSpent(txns, mKey) {
  let s = 0;
  for (const t of txns) {
    if (!isSpend(t)) continue;
    if (mKey && monthKey(t.ts) !== mKey) continue;
    s += t.amount;
  }
  return s;
}

function totalIncome(txns, mKey) {
  let s = 0;
  for (const t of txns) {
    if (!t || t.direction !== 'credit' || t.excluded) continue;
    if (mKey && monthKey(t.ts) !== mKey) continue;
    s += t.amount;
  }
  return s;
}

function spentByCategory(txns, mKey) {
  const o = {};
  for (const t of txns) {
    if (!isSpend(t)) continue;
    if (mKey && monthKey(t.ts) !== mKey) continue;
    o[t.category] = (o[t.category] || 0) + t.amount;
  }
  return o;
}

// spent vs a monthly cap, with a straight-line pace projection.
// dayOfMonth = elapsed days (today's date), daysInMonth = length of the month.
function budgetStatus(spent, budget, dayOfMonth, daysInMonth) {
  const d = Math.max(1, dayOfMonth);
  const dim = Math.max(d, daysInMonth || 30);
  if (!budget || budget <= 0) {
    return { state: 'none', spent, budget: 0, projected: spent, pct: 0, remaining: 0, safePerDay: 0 };
  }
  const projected = (spent / d) * dim;
  const daysLeft = Math.max(1, dim - dayOfMonth);
  const remaining = budget - spent;
  const safePerDay = Math.max(0, remaining / daysLeft);
  let state = 'ok';
  if (spent > budget) state = 'over';
  else if (projected > budget * 1.05) state = 'warn';
  return { state, spent, budget, projected, pct: spent / budget, remaining, safePerDay };
}

// suggest a monthly budget from history: average of the last N complete months, rounded up to 100.
function suggestBudget(txns, category, nowTs, months = 3) {
  const now = new Date(nowTs);
  const keys = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  let sum = 0;
  for (const t of txns) {
    if (!isSpend(t)) continue;
    if (category && t.category !== category) continue;
    if (keys.includes(monthKey(t.ts))) sum += t.amount;
  }
  const avg = sum / months;
  return Math.ceil(avg / 100) * 100;
}

module.exports = {
  DAY, monthKey, isSpend, totalSpent, totalIncome, spentByCategory, budgetStatus, suggestBudget,
};
