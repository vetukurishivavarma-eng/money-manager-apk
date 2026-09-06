import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { refreshSnapshot } from '../summary';
import { BudgetWidget, SafeWidget } from './BudgetWidget';

/** Recompute the snapshot and push it to any placed home-screen widgets. */
export async function pushWidgetUpdate() {
  const snapshot = await refreshSnapshot();
  for (const [widgetName, Comp] of [['Budget', BudgetWidget], ['Safe', SafeWidget]] as const) {
    try {
      await requestWidgetUpdate({
        widgetName,
        renderWidget: () => <Comp snapshot={snapshot} />,
        widgetNotFound: () => {},
      });
    } catch {
      // no widget placed / not Android
    }
  }
}
