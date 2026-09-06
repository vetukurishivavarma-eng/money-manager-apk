import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { C, CATEGORY_ICON, stateColor } from '../theme';
import { Amount, Card, Muted, ProgressBar } from '../components/ui';
import { MonthNav } from '../components/MonthNav';
import { useMonthCursor, useReload } from '../components/hooks';
import { computeSnapshot, categoryStatuses } from '../summary';
import { allTxns, reviewCount } from '../db';
// @ts-ignore
import { detectRecurring } from '../recurring.js';
// @ts-ignore
import { formatINR } from '../format.js';
import { sync } from '../sync';
import type { Txn } from '../types';

export default function Dashboard({ navigation }: any) {
  const m = useMonthCursor();
  const [snap, setSnap] = useState(() => computeSnapshot(m.ref).snapshot);
  const [cats, setCats] = useState(() => categoryStatuses(m.ref));
  const [recent, setRecent] = useState<Txn[]>([]);
  const [reviews, setReviews] = useState(0);
  const [subs, setSubs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setSnap(computeSnapshot(m.ref).snapshot);
    setCats(categoryStatuses(m.ref));
    const all = allTxns();
    setRecent(all.slice(0, 6));
    setReviews(reviewCount());
    const now = Date.now();
    setSubs(detectRecurring(all).filter((r: any) => r.nextTs > now - 3 * 864e5).slice(0, 4));
  };
  useReload(load);
  React.useEffect(load, [m.ref]);

  const onRefresh = async () => {
    setRefreshing(true);
    await sync();
    load();
    setRefreshing(false);
  };

  const net = snap.income - snap.spent;
  const topCats = cats.filter((c) => c.spent > 0).slice(0, 6);
  const maxSpent = topCats[0]?.spent || 1;

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.brand }}>Money Tracker</Text>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color={C.sub} />
        </Pressable>
      </View>

      <MonthNav label={m.label} atCurrent={m.atCurrent} onPrev={m.prev} onNext={m.next} />

      {/* summary */}
      <Card>
        <Muted>Spent this month</Muted>
        <Text style={{ fontSize: 34, fontWeight: '900', color: C.ink, marginVertical: 2 }}>{formatINR(snap.spent)}</Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 4 }}>
          <View>
            <Muted>Income</Muted>
            <Text style={{ color: C.credit, fontWeight: '700' }}>{formatINR(snap.income)}</Text>
          </View>
          <View>
            <Muted>Net</Muted>
            <Text style={{ color: net >= 0 ? C.credit : C.debit, fontWeight: '700' }}>
              {net >= 0 ? '+' : '-'}{formatINR(Math.abs(net))}
            </Text>
          </View>
        </View>

        {snap.budget > 0 && (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Muted>Budget {formatINR(snap.budget)}</Muted>
              <Text style={{ fontSize: 12, fontWeight: '700', color: stateColor(snap.state) }}>
                {snap.state === 'over'
                  ? `${formatINR(snap.spent - snap.budget)} over`
                  : snap.state === 'warn'
                    ? `On track for ${formatINR(snap.projected)}`
                    : `${formatINR(snap.budget - snap.spent)} left`}
              </Text>
            </View>
            <ProgressBar pct={snap.spent / snap.budget} state={snap.state} />
            {m.atCurrent && snap.state !== 'over' && (
              <Muted style={{ marginTop: 6 }}>Safe to spend {formatINR(snap.safePerDay)}/day for the rest of the month</Muted>
            )}
          </View>
        )}
        {snap.budget === 0 && (
          <Pressable onPress={() => navigation.navigate('Budget')} style={{ marginTop: 12 }}>
            <Text style={{ color: C.brand, fontWeight: '700' }}>+ Set a monthly budget</Text>
          </Pressable>
        )}
      </Card>

      {reviews > 0 && (
        <Pressable onPress={() => navigation.navigate('Spending', { filter: 'review' })}>
          <Card style={{ backgroundColor: C.brandSoft, borderColor: C.brand }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="pricetags" size={18} color={C.brand} />
              <Text style={{ flex: 1, color: C.brand, fontWeight: '700' }}>
                {reviews} transaction{reviews > 1 ? 's need' : ' needs'} a category
              </Text>
              <Ionicons name="chevron-forward" size={18} color={C.brand} />
            </View>
          </Card>
        </Pressable>
      )}

      {/* where the money goes */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>Where it's going</Text>
          <Pressable onPress={() => navigation.navigate('Insights')}>
            <Muted>Insights ›</Muted>
          </Pressable>
        </View>
        {topCats.length === 0 && <Muted style={{ marginTop: 10 }}>No spending recorded yet.</Muted>}
        {topCats.map((c) => (
          <Pressable
            key={c.category}
            onPress={() => navigation.navigate('Spending', { category: c.category })}
            style={{ marginTop: 12 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={(CATEGORY_ICON[c.category] || 'ellipse') as any} size={14} color={C.sub} />
                <Text style={{ color: C.ink, fontWeight: '600' }}>{c.category}</Text>
              </View>
              <Text style={{ color: C.ink, fontWeight: '700' }}>{formatINR(c.spent)}</Text>
            </View>
            <ProgressBar
              pct={c.budget > 0 ? c.spent / c.budget : c.spent / maxSpent}
              state={c.budget > 0 ? c.state : undefined}
              height={6}
            />
            {c.budget > 0 && (
              <Muted style={{ fontSize: 11, marginTop: 3 }}>
                of {formatINR(c.budget)} budget{c.state === 'over' ? ' — over' : c.state === 'warn' ? ' — spending fast' : ''}
              </Muted>
            )}
          </Pressable>
        ))}
      </Card>

      {/* upcoming subscriptions */}
      {subs.length > 0 && (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 }}>Upcoming recurring payments</Text>
          {subs.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <View>
                <Text style={{ color: C.ink, fontWeight: '600' }}>{r.payee}</Text>
                <Muted style={{ fontSize: 11 }}>~{dayjs(r.nextTs).format('D MMM')} · {r.category}</Muted>
              </View>
              <Text style={{ color: C.ink, fontWeight: '700' }}>{formatINR(r.amount)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* recent */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>Recent</Text>
          <Pressable onPress={() => navigation.navigate('Spending')}><Muted>All ›</Muted></Pressable>
        </View>
        {recent.length === 0 && <Muted style={{ marginTop: 8 }}>Nothing yet. Pull down to sync your SMS.</Muted>}
        {recent.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => navigation.navigate('TxnDetail', { id: t.id })}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '600' }} numberOfLines={1}>
                {t.counterparty || (t.direction === 'credit' ? 'Credit' : 'Payment')}
              </Text>
              <Muted style={{ fontSize: 11 }}>
                {dayjs(t.ts).format('D MMM')} · {t.category}{t.needs_review ? ' · tap to categorise' : ''}
              </Muted>
            </View>
            <Amount value={t.amount} direction={t.direction} size={14} />
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}
