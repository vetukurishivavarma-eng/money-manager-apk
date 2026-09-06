import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import dayjs from 'dayjs';
import { C, CATEGORY_ICON } from '../theme';
import { Card, Muted } from '../components/ui';
import { MonthNav } from '../components/MonthNav';
import { useMonthCursor, useReload } from '../components/hooks';
import { allTxns } from '../db';
// @ts-ignore
import * as B from '../budget.js';
// @ts-ignore
import { detectRecurring } from '../recurring.js';
// @ts-ignore
import { formatINR, formatCompactINR } from '../format.js';
import type { Txn } from '../types';

const spend = (t: Txn) => t.direction === 'debit' && !t.excluded;

function MiniBars({ data }: { data: { label: string; value: number; hi?: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 8 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: C.sub, marginBottom: 2 }}>{formatCompactINR(d.value)}</Text>
          <View style={{ width: '70%', height: Math.max(3, (d.value / max) * 84), backgroundColor: d.hi ? C.brand : C.brandSoft, borderRadius: 4 }} />
          <Text style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function Insights() {
  const m = useMonthCursor();
  const [rows, setRows] = useState<Txn[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);
  useReload(() => setRows(allTxns()));

  const mk = dayjs(m.ref).format('YYYY-MM');
  const monthTxns = rows.filter((t) => spend(t) && dayjs(t.ts).format('YYYY-MM') === mk);

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = dayjs(m.ref).subtract(i, 'month');
      const key = d.format('YYYY-MM');
      const v = rows.filter((t) => spend(t) && dayjs(t.ts).format('YYYY-MM') === key).reduce((s, t) => s + t.amount, 0);
      out.push({ label: d.format('MMM'), value: v, hi: i === 0 });
    }
    return out;
  }, [rows, m.ref]);

  const byCat = useMemo(() => {
    const o: Record<string, number> = {};
    for (const t of monthTxns) o[t.category] = (o[t.category] || 0) + t.amount;
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  }, [monthTxns]);
  const catTotal = byCat.reduce((s, [, v]) => s + v, 0);

  const subFor = (cat: string) => {
    const o: Record<string, number> = {};
    for (const t of monthTxns.filter((t) => t.category === cat)) {
      o[t.subcategory || 'Uncategorised'] = (o[t.subcategory || 'Uncategorised'] || 0) + t.amount;
    }
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  };

  const prevMk = dayjs(m.ref).subtract(1, 'month').format('YYYY-MM');
  const merchants = useMemo(() => {
    const cur: Record<string, number> = {};
    const prev: Record<string, number> = {};
    for (const t of rows) {
      if (!spend(t) || !t.counterparty) continue;
      const k = dayjs(t.ts).format('YYYY-MM');
      if (k === mk) cur[t.counterparty] = (cur[t.counterparty] || 0) + t.amount;
      else if (k === prevMk) prev[t.counterparty] = (prev[t.counterparty] || 0) + t.amount;
    }
    return Object.entries(cur)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, v]) => {
        const p = prev[name] || 0;
        const delta = p > 0 ? Math.round(((v - p) / p) * 100) : null;
        return { name, v, delta };
      });
  }, [rows, mk, prevMk]);

  const subs = useMemo(() => detectRecurring(rows), [rows]);
  const subsMonthly = subs.reduce((s: number, r: any) => s + r.monthlyEstimate, 0);

  const biggest = monthTxns.slice().sort((a, b) => b.amount - a.amount)[0];
  const days = m.atCurrent ? dayjs().date() : dayjs(m.ref).daysInMonth();
  const avgDay = monthTxns.reduce((s, t) => s + t.amount, 0) / Math.max(1, days);

  const weekday = useMemo(() => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sums = new Array(7).fill(0);
    for (const t of monthTxns) sums[dayjs(t.ts).day()] += t.amount;
    return names.map((label, i) => ({ label, value: sums[i], hi: sums[i] === Math.max(...sums) && sums[i] > 0 }));
  }, [monthTxns]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <MonthNav label={m.label} atCurrent={m.atCurrent} onPrev={m.prev} onNext={m.next} />

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink }}>Spending — last 6 months</Text>
        <MiniBars data={trend} />
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 2 }}>By category</Text>
        <Muted style={{ marginBottom: 4 }}>{formatINR(catTotal)} this month · tap to see sub-categories</Muted>
        {byCat.length === 0 && <Muted style={{ marginTop: 8 }}>No spending this month.</Muted>}
        {byCat.map(([cat, v]) => (
          <View key={cat}>
            <Pressable
              onPress={() => setOpenCat(openCat === cat ? null : cat)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}
            >
              <View style={{ width: 26, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: C.sub }}>{Math.round((v / catTotal) * 100)}%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.ink, fontWeight: '600' }}>{cat}</Text>
                  <Text style={{ color: C.ink, fontWeight: '700' }}>{formatINR(v)}</Text>
                </View>
                <View style={{ height: 5, backgroundColor: C.line, borderRadius: 3, marginTop: 4 }}>
                  <View style={{ height: 5, width: `${(v / catTotal) * 100}%`, backgroundColor: C.brand, borderRadius: 3 }} />
                </View>
              </View>
            </Pressable>
            {openCat === cat && (
              <View style={{ paddingLeft: 34, paddingBottom: 6 }}>
                {subFor(cat).map(([sub, sv]) => (
                  <View key={sub} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Muted>{sub}</Muted>
                    <Muted>{formatINR(sv)}</Muted>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 6 }}>Subscriptions & recurring</Text>
        {subs.length === 0 && <Muted>None detected yet — needs 2+ months of history.</Muted>}
        {subs.map((r: any, i: number) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View>
              <Text style={{ color: C.ink, fontWeight: '600' }}>{r.payee}</Text>
              <Muted style={{ fontSize: 11 }}>every ~{r.cadenceDays}d · next {dayjs(r.nextTs).format('D MMM')}</Muted>
            </View>
            <Text style={{ color: C.ink, fontWeight: '700' }}>{formatINR(r.amount)}</Text>
          </View>
        ))}
        {subs.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginTop: 6, paddingTop: 8 }}>
            <Text style={{ color: C.brand, fontWeight: '800' }}>≈ {formatINR(subsMonthly)} / month locked in</Text>
          </View>
        )}
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 6 }}>Top merchants</Text>
        {merchants.map(({ name, v, delta }) => (
          <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
            <Muted>{name}</Muted>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {delta !== null && Math.abs(delta) >= 10 && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: delta > 0 ? C.over : C.ok }}>
                  {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}%
                </Text>
              )}
              <Text style={{ color: C.ink, fontWeight: '700' }}>{formatINR(v)}</Text>
            </View>
          </View>
        ))}
        {merchants.length === 0 && <Muted>—</Muted>}
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Muted>Avg / day</Muted>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{formatINR(avgDay)}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Biggest expense</Muted>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{biggest ? formatINR(biggest.amount) : '—'}</Text>
          {biggest ? <Muted style={{ fontSize: 11 }} numberOfLines={1}>{biggest.counterparty || biggest.category}</Muted> : null}
        </Card>
      </View>

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink }}>Which day you spend most</Text>
        <MiniBars data={weekday} />
      </Card>
    </ScrollView>
  );
}
