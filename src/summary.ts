import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
// @ts-ignore - pure JS
import * as B from './budget.js';
import { allTxns, getBudgets, getMeta } from './db';
import type { BudgetSnapshot, Txn } from './types';
import { SNAPSHOT_KEY } from './keys';

export { SNAPSHOT_KEY };

export interface CategoryStatus {
  category: string;
  spent: number;
  budget: number;
  state: 'none' | 'ok' | 'warn' | 'over';
  pct: number;
  safePerDay: number;
  projected: number;
}

export function monthContext(ref: Date = new Date()) {
  const start = dayjs(ref).startOf('month');
  return {
    key: start.format('YYYY-MM'),
    label: start.format('MMMM YYYY'),
    from: start.valueOf(),
    to: start.add(1, 'month').valueOf(),
    dayOfMonth: dayjs(ref).date(),
    daysInMonth: start.daysInMonth(),
    isCurrent: start.isSame(dayjs().startOf('month')),
  };
}

export function computeSnapshot(ref: Date = new Date()): {
  snapshot: BudgetSnapshot;
  categories: CategoryStatus[];
} {
  const m = monthContext(ref);
  const txns = allTxns();
  const budgets = getBudgets();

  const spent: number = B.totalSpent(txns, m.key);
  const income: number = B.totalIncome(txns, m.key);
  const byCat = B.spentByCategory(txns, m.key) as Record<string, number>;

  const overallBudget = Number(getMeta('overall_budget') || 0)
    || Object.entries(budgets).reduce((s, [, v]) => s + v, 0);

  const day = m.isCurrent ? m.dayOfMonth : m.daysInMonth;
  const overall = B.budgetStatus(spent, overallBudget, day, m.daysInMonth);

  const categories: CategoryStatus[] = Object.keys({ ...byCat, ...budgets })
    .map((category): CategoryStatus => {
      const s = B.budgetStatus(byCat[category] || 0, budgets[category] || 0, day, m.daysInMonth);
      return {
        category, spent: byCat[category] || 0, budget: budgets[category] || 0,
        state: s.state as CategoryStatus['state'], pct: s.pct, safePerDay: s.safePerDay, projected: s.projected,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const top = categories.filter((c) => c.spent > 0)[0];

  const snapshot: BudgetSnapshot = {
    month: m.label,
    spent,
    budget: overallBudget,
    income,
    state: overall.state as BudgetSnapshot['state'],
    safePerDay: overall.safePerDay,
    projected: overall.projected,
    updatedAt: Date.now(),
    topCategory: top ? { name: top.category, spent: top.spent } : null,
  };

  return { snapshot, categories };
}

/** Recompute and persist the snapshot the home-screen widget reads. */
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

export function categoryStatuses(ref?: Date) {
  return computeSnapshot(ref).categories;
}

export type { Txn };
