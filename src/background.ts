import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { sync } from './sync';

export const BG_TASK = 'money-tracker-bg-sync';

TaskManager.defineTask(BG_TASK, async () => {
  try {
    const n = await sync();
    return n > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(BG_TASK, {
      minimumInterval: 60 * 30, // 30 min; Android decides the real cadence
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // ignore – foreground sync still runs
  }
}
