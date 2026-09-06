import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';

/** Run a loader every time the screen gains focus. */
export function useReload(load: () => void) {
  useFocusEffect(useCallback(() => { load(); }, [load]));
}

/** Month cursor with prev/next, capped at the current month. */
export function useMonthCursor() {
  const [ref, setRef] = useState(() => new Date());
  const atCurrent = dayjs(ref).isSame(dayjs(), 'month');
  return {
    ref,
    label: dayjs(ref).format('MMMM YYYY'),
    atCurrent,
    prev: () => setRef((r) => dayjs(r).subtract(1, 'month').toDate()),
    next: () => setRef((r) => (dayjs(r).isSame(dayjs(), 'month') ? r : dayjs(r).add(1, 'month').toDate())),
  };
}
