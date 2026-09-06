import * as Notifications from 'expo-notifications';
import { computeSnapshot } from './summary';
import { getMeta, setMeta } from './db';
// @ts-ignore
import { formatINR } from './format.js';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotifPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function fire(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}

/**
 * Check the current month against budgets and raise at most one notification per
 * (scope, threshold, month). Thresholds: 80% (heads-up) and 100% (over).
 */
export async function runBudgetAlerts() {
  const { snapshot, categories } = computeSnapshot();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  const seen = new Set((getMeta('alerts_' + snapshot.month) || '').split('|').filter(Boolean));
  const mark = (k: string) => seen.add(k);

  const check = (scope: string, label: string, spent: number, budget: number, state: string, projected: number) => {
    if (!budget) return;
    const pct = spent / budget;
    if (state === 'over' && !seen.has(scope + ':over')) {
      fire(`${label} budget exceeded`, `Spent ${formatINR(spent)} of ${formatINR(budget)}. You're ${formatINR(spent - budget)} over.`);
      mark(scope + ':over');
    } else if (pct >= 0.8 && pct < 1 && !seen.has(scope + ':80')) {
      fire(`${label} budget almost gone`, `${Math.round(pct * 100)}% used — ${formatINR(budget - spent)} left this month.`);
      mark(scope + ':80');
    } else if (state === 'warn' && !seen.has(scope + ':pace')) {
      fire(`${label} spending is fast`, `At this pace you'll hit ${formatINR(projected)} — over your ${formatINR(budget)} budget.`);
      mark(scope + ':pace');
    }
  };

  check('overall', 'Monthly', snapshot.spent, snapshot.budget, snapshot.state, snapshot.projected);
  for (const c of categories) {
    check('cat:' + c.category, c.category, c.spent, c.budget, c.state, c.projected);
  }

  setMeta('alerts_' + snapshot.month, [...seen].join('|'));
}

/** Large single-transaction alert, called right after a scan finds new debits. */
export async function alertLargeTxns(newDebits: { amount: number; counterparty: string | null }[]) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const threshold = Number(getMeta('large_txn_threshold') || 5000);
  for (const t of newDebits) {
    if (t.amount >= threshold) {
      await fire('Large payment', `${formatINR(t.amount)}${t.counterparty ? ' to ' + t.counterparty : ''} was just debited.`);
    }
  }
}
