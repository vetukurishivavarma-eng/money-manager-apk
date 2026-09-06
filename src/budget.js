// Pure budget math. Works on plain txn objects: { ts, amount, direction, category, excluded }.
const DAY = 86400000;

function monthKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function isSpend(t) {
  return t && t.direction === 'debit' && !t.excluded;
}

// ---- calendar-month helpers (kept for the parser test + simple call sites) ----
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

// ---- arbitrary-range helpers (used with payday periods) ----
function inRange(ts, from, to) {
  return ts >= from && ts < to;
}
function totalSpentRange(txns, from, to) {
  let s = 0;
  for (const t of txns) if (isSpend(t) && inRange(t.ts, from, to)) s += t.amount;
  return s;
}
function totalIncomeRange(txns, from, to) {
  let s = 0;
  for (const t of txns) if (t && t.direction === 'credit' && !t.excluded && inRange(t.ts, from, to)) s += t.amount;
  return s;
}
function spentByCategoryRange(txns, from, to) {
  const o = {};
  for (const t of txns) {
    if (!isSpend(t) || !inRange(t.ts, from, to)) continue;
    o[t.category] = (o[t.category] || 0) + t.amount;
  }
  return o;
}

// spent vs a cap, with a straight-line pace projection.
// dayOfPeriod = days elapsed (>=1), periodDays = length of the period.
function budgetStatus(spent, budget, dayOfPeriod, periodDays) {
  const d = Math.max(1, dayOfPeriod);
  const dim = Math.max(d, periodDays || 30);
  if (!budget || budget <= 0) {
    return { state: 'none', spent, budget: 0, projected: spent, pct: 0, remaining: 0, safePerDay: 0, daysLeft: Math.max(1, dim - d) };
  }
  const projected = (spent / d) * dim;
  const daysLeft = Math.max(1, dim - dayOfPeriod);
  const remaining = budget - spent;
  const safePerDay = Math.max(0, remaining / daysLeft);
  let state = 'ok';
  if (spent > budget) state = 'over';
  else if (projected > budget * 1.05) state = 'warn';
  return { state, spent, budget, projected, pct: spent / budget, remaining, safePerDay, daysLeft };
}

// average of the last N complete calendar months, rounded up to 100.
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
  return Math.ceil(sum / months / 100) * 100;
}

/**
 * Unspent (or overspent) budget carried into the LAST period of `periods`.
 * `periods` = oldest..current [{from,to}]. Surplus is capped at one period's
 * base so it can't stockpile forever; a deficit rolls in full (you owe it back).
 */
function rolloverFor(txns, category, base, periods) {
  if (!base || periods.length < 2) return 0;
  let carry = 0;
  for (let i = 0; i < periods.length - 1; i++) {
    const p = periods[i];
    const spent = category
      ? spentByCategoryRange(txns, p.from, p.to)[category] || 0
      : totalSpentRange(txns, p.from, p.to);
    carry += base - spent;
    if (carry > base) carry = base;
  }
  return Math.round(carry);
}

module.exports = {
  DAY, monthKey, isSpend,
  totalSpent, totalIncome, spentByCategory,
  totalSpentRange, totalIncomeRange, spentByCategoryRange,
  budgetStatus, suggestBudget, rolloverFor,
};
