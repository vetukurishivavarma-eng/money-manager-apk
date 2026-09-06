import dayjs from 'dayjs';
import * as Notifications from 'expo-notifications';
import { allTxns, getFlag, getMeta, setMeta } from './db';
// @ts-ignore
import * as B from './budget.js';
// @ts-ignore
import { formatINR } from './format.js';

/** Fire a "here's your week" notification once, after each week closes. */
export async function maybeWeeklyReview() {
  if (!getFlag('weekly_review', true)) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  const thisWeekStart = dayjs().startOf('week');
  const lastStart = thisWeekStart.subtract(1, 'week');
  const key = lastStart.format('YYYY-MM-DD');

  const prevSent = getMeta('weekly_review_sent');
  if (prevSent === key) return;
  if (!prevSent) { setMeta('weekly_review_sent', key); return; } // skip the very first one

  const txns = allTxns();
  const from = lastStart.valueOf();
  const to = thisWeekStart.valueOf();
  const spent = B.totalSpentRange(txns, from, to) as number;
  const prev = B.totalSpentRange(txns, lastStart.subtract(1, 'week').valueOf(), from) as number;
  const byCat = B.spentByCategoryRange(txns, from, to) as Record<string, number>;
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  const delta = prev > 0 ? Math.round(((spent - prev) / prev) * 100) : 0;
  const trend = prev === 0 ? '' : delta > 4 ? ` — ${delta}% more than the week before` : delta < -4 ? ` — ${Math.abs(delta)}% less than the week before` : ' — about the same as the week before';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Last week: ${formatINR(spent)}`,
      body:
        (top ? `Most went to ${top[0]} (${formatINR(top[1])}).` : 'No spending recorded.') + trend,
    },
    trigger: null,
  });
  setMeta('weekly_review_sent', key);
}
