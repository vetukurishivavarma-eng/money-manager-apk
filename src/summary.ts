import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
// @ts-ignore - pure JS
import * as B from './budget.js';
import { allTxns, getBudgets, getFlag, getMeta, getMetaNum } from './db';
import { periodFor, recentPeriods, todayStart, Period } from './period';
import type { BudgetSnapshot, Txn } from './types';
import { SNAPSHOT_KEY } from './keys';

export { SNAPSHOT_KEY };

export interface CategoryStatus {
  category: string;
  spent: number;
  budget: number; // effective
  baseBudget: number;
  rollover: number;
  state: 'none' | 'ok' | 'warn' | 'over';
  pct: number;
  safePerDay: number;
  projected: number;
}

const ROLL_PERIODS = 6;

export function periodContext(ref: Date | number = new Date()): Period {
  return periodFor(ref);
}

function effectiveBudget(txns: Txn[], category: string | null, base: number, periods: Period[]) {
  if (!getFlag('rollover')) return { budget: base, rollover: 0 };
  const roll = B.rolloverFor(txns, category, base, periods) as number;
  return { budget: Math.max(0, base + roll), rollover: roll };
}

export function computeSnapshot(ref: Date | number = new Date()): {
  snapshot: BudgetSnapshot;
  categories: CategoryStatus[];
  period: Period;
} {
  const p = periodFor(ref);
  const periods = recentPeriods(ROLL_PERIODS, ref);
  const txns = allTxns();
  const budgets = getBudgets();

  const spent = B.totalSpentRange(txns, p.from, p.to) as number;
  const income = B.totalIncomeRange(txns, p.from, p.to) as number;
  const byCat = B.spentByCategoryRange(txns, p.from, p.to) as Record<string, number>;

  const ds = todayStart();
  const todaySpent = p.isCurrent ? (B.totalSpentRange(txns, ds, ds + B.DAY) as number) : 0;

  const baseOverall =
    getMetaNum('overall_budget', 0) ||
    Object.entries(budgets).reduce((s, [, v]) => s + v, 0);
  const eb = effectiveBudget(txns, null, baseOverall, periods);
  const overall = B.budgetStatus(spent, eb.budget, p.dayIndex, p.lengthDays);

  const categories: CategoryStatus[] = Object.keys({ ...byCat, ...budgets })
    .map((category): CategoryStatus => {
      const base = budgets[category] || 0;
      const ce = effectiveBudget(txns, category, base, periods);
      const s = B.budgetStatus(byCat[category] || 0, ce.budget, p.dayIndex, p.lengthDays);
      return {
        category,
        spent: byCat[category] || 0,
        budget: ce.budget,
        baseBudget: base,
        rollover: ce.rollover,
        state: s.state as CategoryStatus['state'],
        pct: s.pct,
        safePerDay: s.safePerDay,
        projected: s.projected,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const top = categories.find((c) => c.spent > 0) || null;
  const safeToday = Math.max(0, overall.safePerDay - todaySpent);

  const snapshot: BudgetSnapshot = {
    month: p.label,
    spent,
    budget: eb.budget,
    baseBudget: baseOverall,
    rollover: eb.rollover,
    income,
    todaySpent,
    state: overall.state as BudgetSnapshot['state'],
    safePerDay: overall.safePerDay,
    safeToday,
    projected: overall.projected,
    daysLeft: overall.daysLeft,
    updatedAt: Date.now(),
    topCategory: top ? { name: top.category, spent: top.spent } : null,
  };

  return { snapshot, categories, period: p };
}

/** Expected monthly income = 3-month average of credited income. */
export function expectedIncome(): number {
  const explicit = getMetaNum('expected_income', 0);
  if (explicit > 0) return explicit;
  const txns = allTxns();
  const ps = recentPeriods(4).slice(0, 3); // last 3 complete periods
  const avg = ps.reduce((s, p) => s + (B.totalIncomeRange(txns, p.from, p.to) as number), 0) / 3;
  return Math.round(avg);
}

export async function refreshSnapshot(): Promise<BudgetSnapshot> {
  const { snapshot } = computeSnapshot();
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function readSnapshot(): Promise<BudgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as BudgetSnapshot) : null;
  } catch {
    return null;
  }
}

export function categoryStatuses(ref?: Date | number) {
  return computeSnapshot(ref).categories;
}

export type { Txn };
