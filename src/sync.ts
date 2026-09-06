import { scanSms } from './sms/scan';
import { runBudgetAlerts, alertLargeTxns } from './notify';
import { pushWidgetUpdate } from './widget/update';
import { setMeta } from './db';

let running = false;

/** One pass: import new SMS -> raise alerts -> refresh the widget. Safe to call often. */
export async function sync(opts: { full?: boolean } = {}): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const { added, newDebits } = await scanSms(opts);
    if (newDebits.length) await alertLargeTxns(newDebits);
    await runBudgetAlerts();
    await pushWidgetUpdate();
    setMeta('last_sync_ts', String(Date.now()));
    return added;
  } finally {
    running = false;
  }
}
