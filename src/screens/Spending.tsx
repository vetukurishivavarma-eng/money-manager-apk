import React, { useMemo, useState } from 'react';
import {
  FlatList, Pressable, SectionList, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { C, CATEGORIES, CATEGORY_ICON } from '../theme';
import { Amount, Chip, Empty, Muted } from '../components/ui';
import { useReload } from '../components/hooks';
import { allTxns } from '../db';
// @ts-ignore
import { formatINR } from '../format.js';
import type { Txn } from '../types';

type FilterKind = 'all' | 'review' | 'debit' | 'credit';

export default function Spending({ navigation, route }: any) {
  const [rows, setRows] = useState<Txn[]>([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<FilterKind>(route.params?.filter === 'review' ? 'review' : 'all');
  const [cat, setCat] = useState<string | null>(route.params?.category ?? null);

  useReload(() => setRows(allTxns()));

  React.useEffect(() => {
    if (route.params?.filter === 'review') setKind('review');
    if (route.params?.category !== undefined) setCat(route.params.category);
  }, [route.params?.filter, route.params?.category]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (kind === 'review' && !t.needs_review) return false;
      if (kind === 'debit' && t.direction !== 'debit') return false;
      if (kind === 'credit' && t.direction !== 'credit') return false;
      if (cat && t.category !== cat) return false;
      if (needle) {
        const hay = `${t.counterparty || ''} ${t.category} ${t.subcategory || ''} ${t.note || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, kind, cat]);

  const sections = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of filtered) {
      const k = dayjs(t.ts).format('YYYY-MM-DD');
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return [...map.entries()].map(([k, data]) => ({
      title: dayjs(k).format('ddd, D MMM YYYY'),
      total: data.reduce((s, t) => s + (t.direction === 'debit' ? t.amount : -t.amount), 0),
      data,
    }));
  }, [filtered]);

  const total = filtered.reduce((s, t) => s + (t.direction === 'debit' && !t.excluded ? t.amount : 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10 }}>
          <Ionicons name="search" size={16} color={C.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search merchant, note, category"
            placeholderTextColor={C.sub}
            style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: C.ink }}
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', 'review', 'debit', 'credit'] as FilterKind[]}
          keyExtractor={(x) => x}
          renderItem={({ item }) => (
            <Chip
              label={item === 'all' ? 'All' : item === 'review' ? 'Needs category' : item === 'debit' ? 'Spends' : 'Income'}
              active={kind === item}
              onPress={() => setKind(item)}
            />
          )}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['__none__', ...CATEGORIES]}
          keyExtractor={(x) => x}
          renderItem={({ item }) =>
            item === '__none__' ? (
              <Chip label="Any category" active={!cat} onPress={() => setCat(null)} />
            ) : (
              <Chip label={item} active={cat === item} onPress={() => setCat(item)} />
            )
          }
        />

        <Muted>{filtered.length} transactions · {formatINR(total)} spent</Muted>
      </View>

      {sections.length === 0 ? (
        <Empty icon="receipt-outline" text="No transactions match. Pull to refresh on the Home tab to sync SMS." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => String(t.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
              <Muted style={{ fontWeight: '700' }}>{section.title}</Muted>
              <Muted>{formatINR(section.total)}</Muted>
            </View>
          )}
          renderItem={({ item: t }) => (
            <Pressable
              onPress={() => navigation.navigate('TxnDetail', { id: t.id })}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: C.card, marginHorizontal: 12, marginVertical: 3,
                padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line,
                opacity: t.excluded ? 0.5 : 1,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={(CATEGORY_ICON[t.category] || 'ellipse') as any} size={16} color={C.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: '600' }} numberOfLines={1}>
                  {t.counterparty || (t.direction === 'credit' ? 'Credit received' : 'Payment')}
                </Text>
                <Muted style={{ fontSize: 11 }} numberOfLines={1}>
                  {t.category}{t.subcategory ? ` · ${t.subcategory}` : ''}{t.excluded ? ' · excluded' : ''}
                  {t.needs_review ? '  ·  needs category' : ''}
                </Muted>
              </View>
              <Amount value={t.amount} direction={t.direction} size={14} />
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => navigation.navigate('AddTxn')}
        style={{
          position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28,
          backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', elevation: 4,
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}
