import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { SNAPSHOT_KEY } from '../keys';
import { BudgetWidget } from './BudgetWidget';
import type { BudgetSnapshot } from '../types';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'Budget') return;

  let snap: BudgetSnapshot | null = null;
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    snap = raw ? (JSON.parse(raw) as BudgetSnapshot) : null;
  } catch {
    snap = null;
  }

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      props.renderWidget(<BudgetWidget snapshot={snap} />);
      break;
    default:
      break;
  }
}
