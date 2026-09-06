import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { refreshSnapshot } from '../summary';
import { BudgetWidget } from './BudgetWidget';

/** Recompute the snapshot and push it to any placed home-screen widget. */
export async function pushWidgetUpdate() {
  const snapshot = await refreshSnapshot();
  try {
    await requestWidgetUpdate({
      widgetName: 'Budget',
      renderWidget: () => <BudgetWidget snapshot={snapshot} />,
      widgetNotFound: () => {},
    });
  } catch {
    // no widget placed / not Android — snapshot is still saved for the next add
  }
}
