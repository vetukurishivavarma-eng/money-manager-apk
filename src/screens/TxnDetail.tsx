import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { C, CATEGORIES, TAXONOMY } from '../theme';
import { Amount, Button, Card, Field, Muted, PickerSheet } from '../components/ui';
import {
  deleteTxn, getTxn, setRule, applyRuleToPast, updateTxn,
} from '../db';
import { pushWidgetUpdate } from '../widget/update';
import type { Txn } from '../types';

export default function TxnDetail({ navigation, route }: any) {
  const id: number = route.params.id;
  const [t, setT] = useState<Txn | null>(() => getTxn(id) ?? null);
  const [pick, setPick] = useState<null | 'cat' | 'sub'>(null);
  const [note, setNote] = useState(t?.note ?? '');
  const [remember, setRemember] = useState(false);

  if (!t) {
    return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Muted>Transaction not gone.</Muted></View>;
  }

  const save = (f: Partial<Txn>) => {
    const next = { ...t, ...f } as Txn;
    // any manual category assignment clears the review flag
    if (f.category !== undefined) next.needs_review = 0;
    updateTxn(id, { ...f, needs_review: next.needs_review });
    setT(next);
    pushWidgetUpdate();
  };

  const chooseCategory = (c: string) => {
    save({ category: c, subcategory: null });
    if (remember && t.counterparty) {
      setRule(t.counterparty.toLowerCase(), c);
      applyRuleToPast(t.counterparty.toLowerCase(), c);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Muted>{t.direction === 'credit' ? 'Received' : 'Paid'}</Muted>
        <Amount value={t.amount} direction={t.direction} size={30} />
        <Text style={{ color: C.ink, fontWeight: '700', marginTop: 6 }}>
          {t.counterparty || '—'}
        </Text>
        <Muted style={{ marginTop: 2 }}>
          {dayjs(t.ts).format('ddd, D MMM YYYY · h:mm A')}
          {t.channel ? ` · ${t.channel}` : ''}{t.account ? ` · A/c ${t.account}` : ''}
        </Muted>
        {t.needs_review ? (
          <View style={{ marginTop: 8, backgroundColor: C.brandSoft, borderRadius: 8, padding: 8 }}>
            <Text style={{ color: C.brand, fontSize: 12, fontWeight: '700' }}>Pick a category so this counts in the right budget.</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <Pressable onPress={() => setPick('cat')} style={row}>
          <Muted>Category</Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: C.ink, fontWeight: '700' }}>{t.category}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.sub} />
          </View>
        </Pressable>
        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 10 }} />
        <Pressable onPress={() => setPick('sub')} style={row}>
          <Muted>Sub-category</Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: t.subcategory ? C.ink : C.sub, fontWeight: '700' }}>{t.subcategory || 'Add'}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.sub} />
          </View>
        </Pressable>

        {t.counterparty ? (
          <View style={[row, { marginTop: 12 }]}>
            <Muted style={{ flex: 1 }}>Always use this category for “{t.counterparty}”</Muted>
            <Switch value={remember} onValueChange={setRemember} trackColor={{ true: C.brand }} />
          </View>
        ) : null}
      </Card>

      <Card>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. team lunch, split with Ravi" />
        <Button title="Save note" kind="ghost" onPress={() => save({ note })} />
        <View style={{ height: 10 }} />
        <View style={row}>
          <Muted style={{ flex: 1 }}>Exclude from spending (transfer, refund, reimbursed)</Muted>
          <Switch
            value={!!t.excluded}
            onValueChange={(v) => save({ excluded: v ? 1 : 0 })}
            trackColor={{ true: C.brand }}
          />
        </View>
      </Card>

      {t.raw ? (
        <Card>
          <Muted style={{ marginBottom: 4 }}>Original SMS</Muted>
          <Text style={{ color: C.sub, fontSize: 12 }}>{t.raw}</Text>
        </Card>
      ) : null}

      <Button
        title="Delete transaction"
        kind="danger"
        onPress={() =>
          Alert.alert('Delete this transaction?', 'It will come back on the next SMS scan unless it was added manually.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { deleteTxn(id); pushWidgetUpdate(); navigation.goBack(); } },
          ])
        }
      />

      <PickerSheet
        visible={pick === 'cat'}
        title="Category"
        options={[...CATEGORIES]}
        onSelect={chooseCategory}
        onClose={() => setPick(null)}
      />
      <PickerSheet
        visible={pick === 'sub'}
        title={`${t.category} — sub-category`}
        options={TAXONOMY[t.category] || []}
        allowCustom
        onSelect={(v) => save({ subcategory: v })}
        onClose={() => setPick(null)}
      />
    </ScrollView>
  );
}

const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const };
