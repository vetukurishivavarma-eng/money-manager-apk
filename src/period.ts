import dayjs from 'dayjs';
import { getMetaNum } from './db';

export interface Period {
  key: string;
  label: string;
  from: number;
  to: number;
  dayIndex: number; // 1-based days elapsed, today included
  lengthDays: number;
  isCurrent: boolean;
}

export function cycleStartDay(): number {
  return Math.min(28, Math.max(1, Math.round(getMetaNum('cycle_start_day', 1))));
}

/** The budget period that contains `ref`. With startDay=1 this is the calendar month. */
export function periodFor(ref: Date | number = Date.now(), startDay = cycleStartDay()): Period {
  const r = dayjs(ref);
  const start = (r.date() >= startDay ? r : r.subtract(1, 'month')).date(startDay).startOf('day');
  const end = start.add(1, 'month');
  const now = dayjs();
  const isCurrent = now.valueOf() >= start.valueOf() && now.valueOf() < end.valueOf();
  const lengthDays = end.diff(start, 'day');
  const dayIndex = isCurrent ? Math.min(lengthDays, now.diff(start, 'day') + 1) : lengthDays;
  return {
    key: start.format('YYYY-MM-DD'),
    label: startDay === 1
      ? start.format('MMMM YYYY')
      : `${start.format('D MMM')} – ${end.subtract(1, 'day').format('D MMM')}`,
    from: start.valueOf(),
    to: end.valueOf(),
    dayIndex,
    lengthDays,
    isCurrent,
  };
}

export function shiftPeriod(p: Period, dir: -1 | 1, startDay = cycleStartDay()): Period {
  const mid = dayjs(p.from).add(15, 'day').add(dir, 'month').toDate();
  return periodFor(mid, startDay);
}

/** `count` consecutive periods ending with the one containing `endRef` (oldest first). */
export function recentPeriods(count: number, endRef: Date | number = Date.now()): Period[] {
  let p = periodFor(endRef);
  const out: Period[] = [p];
  for (let i = 1; i < count; i++) {
    p = shiftPeriod(p, -1);
    out.unshift(p);
  }
  return out;
}

export function todayStart(): number {
  return dayjs().startOf('day').valueOf();
}
