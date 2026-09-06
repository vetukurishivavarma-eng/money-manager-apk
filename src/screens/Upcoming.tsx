import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { C, CATEGORY_ICON } from '../theme';
import { Card, Empty, Muted } from '../components/ui';
import { useReload } from '../components/hooks';
import { allTxns } from '../db';
// @ts-ignore
import { detectRecurring } from '../recurring.js';
// @ts-ignore
import { formatINR } from '../format.js';

export default function Upcoming() {
  const [rows, setRows] = useState<any[]>([]);
  useReload(() => setRows(detectRecurring(allTxns())));

  const groups = useMemo(() => {
    const now = dayjs();
    const horizon = now.add(45, 'day');
    const items = rows
      .map((r) => ({ ...r, due: dayjs(r.nextTs) }))
      .filter((r) => r.due.isAfter(now.subtract(4, 'day')) && r.due.isBefore(horizon))
      .sort((a, b) => a.due.valueOf() - b.due.valueOf());

    const bucket = (d: dayjs.Dayjs) => {
      const days = d.diff(now, 'day');
      if (days < 0) return 'Overdue';
      if (days <= 7) return 'This week';
      if (days <= 14) return 'Next week';
      return 'Later this month';
    };
    const map = new Map<string, any[]>();
    for (const it of items) {
      const k = bucket(it.due);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return [...map.entries()];
  }, [rows]);

  const total30 = useMemo(() => {
    const now = dayjs();
    return rows
      .filter((r) => dayjs(r.nextTs).isBefore(now.add(30, 'day')) && dayjs(r.nextTs).isAfter(now.subtract(4, 'day')))
      .reduce((s, r) => s + r.amount, 0);
  }, [rows]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      <Card style={{ backgroundColor: C.brand }}>
        <Text style={{ color: '#CDE7DC', fontSize: 13 }}>Due in the next 30 days</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{formatINR(total30)}</Text>
        <Text style={{ color: '#CDE7DC', fontSize: 12 }}>Detected from your recurring payments — keep this aside.</Text>
      </Card>

      {groups.length === 0 ? (
        <Empty icon="calendar-outline" text="No recurring payments detected yet. Needs 2+ months of history." />
      ) : (
        groups.map(([label, items]) => (
          <Card key={label}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontWeight: '800', color: C.ink }}>{label}</Text>
              <Muted>{formatINR(items.reduce((s: number, i: any) => s + i.amount, 0))}</Muted>
            </View>
            {items.map((it: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={(CATEGORY_ICON[it.category] || 'ellipse') as any} size={15} color={C.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontWeight: '600' }} numberOfLines={1}>{it.payee}</Text>
                  <Muted style={{ fontSize: 11 }}>{it.due.format('ddd, D MMM')} · every ~{it.cadenceDays}d</Muted>
                </View>
                <Text style={{ color: C.ink, fontWeight: '700' }}>{formatINR(it.amount)}</Text>
              </View>
            ))}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
