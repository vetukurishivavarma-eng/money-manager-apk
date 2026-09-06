// @ts-nocheck
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { BudgetSnapshot } from '../types';

const COL = {
  bg: '#0B3D2E',
  card: '#0F4A38',
  text: '#FFFFFF',
  sub: '#B9D3C8',
  track: '#1C5C48',
  ok: '#3FC77E',
  warn: '#F2B33D',
  over: '#F0685B',
};

function fmt(n: number) {
  const v = Math.round(Math.abs(n));
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'k';
  return '₹' + v;
}

export function BudgetWidget({ snapshot }: { snapshot: BudgetSnapshot | null }) {
  const s = snapshot;
  const hasBudget = !!s && s.budget > 0;
  const pct = hasBudget ? Math.min(1, s!.spent / s!.budget) : 0;
  const barColor = !s ? COL.sub : s.state === 'over' ? COL.over : s.state === 'warn' ? COL.warn : COL.ok;
  const BAR_W = 150;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: COL.bg,
        borderRadius: 20,
        padding: 14,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text={s ? s.month : 'Money Tracker'} style={{ fontSize: 12, color: COL.sub }} />
        <TextWidget text="●" style={{ fontSize: 12, color: barColor }} />
      </FlexWidget>

      {!s ? (
        <TextWidget text="Open the app to sync" style={{ fontSize: 14, color: COL.text }} />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <TextWidget
            text={hasBudget ? `${fmt(s.spent)} / ${fmt(s.budget)}` : `${fmt(s.spent)} spent`}
            style={{ fontSize: 20, fontWeight: 'bold', color: COL.text }}
          />
          {hasBudget && (
            <FlexWidget
              style={{ height: 8, width: BAR_W, backgroundColor: COL.track, borderRadius: 4, marginTop: 6, flexDirection: 'row' }}
            >
              <FlexWidget style={{ height: 8, width: Math.max(4, Math.round(BAR_W * pct)), backgroundColor: barColor, borderRadius: 4 }} />
            </FlexWidget>
          )}
        </FlexWidget>
      )}

      <TextWidget
        text={
          !s
            ? ''
            : hasBudget
              ? s.state === 'over'
                ? `${fmt(s.spent - s.budget)} over budget`
                : `Safe to spend ${fmt(s.safePerDay)}/day`
              : s.topCategory
                ? `Top: ${s.topCategory.name}`
                : 'No budget set'
        }
        style={{ fontSize: 12, color: COL.sub }}
      />
    </FlexWidget>
  );
}
