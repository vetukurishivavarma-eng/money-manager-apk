import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, CATEGORIES, TAXONOMY } from '../theme';
import { Button, Card, Field, Muted, PickerSheet } from '../components/ui';
import { insertManual } from '../db';
import { pushWidgetUpdate } from '../widget/update';

export default function AddTxn({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [category, setCategory] = useState('Cash/ATM');
  const [subcategory, setSub] = useState<string | null>('Cash Spend');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [pick, setPick] = useState<null | 'cat' | 'sub'>(null);

  const amt = parseFloat(amount.replace(/,/g, ''));
  const valid = amt > 0;

  const submit = () => {
    if (!valid) return;
    insertManual({ amount: amt, direction, category, subcategory, counterparty: payee || null, note: note || null });
    pushWidgetUpdate();
    navigation.goBack();
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['debit', 'credit'] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => setDirection(d)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: direction === d ? C.brand : C.card, borderWidth: 1, borderColor: direction === d ? C.brand : C.line,
              }}
            >
              <Text style={{ color: direction === d ? '#fff' : C.sub, fontWeight: '700' }}>
                {d === 'debit' ? 'Spent' : 'Received'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
        <Field label="Paid to / from" value={payee} onChangeText={setPayee} placeholder="e.g. Auto, Maid, Ravi" />

        <Pressable onPress={() => setPick('cat')} style={rowBtn}>
          <Muted>Category</Muted>
          <Text style={{ color: C.ink, fontWeight: '700' }}>{category} ›</Text>
        </Pressable>
        <Pressable onPress={() => setPick('sub')} style={rowBtn}>
          <Muted>Sub-category</Muted>
          <Text style={{ color: subcategory ? C.ink : C.sub, fontWeight: '700' }}>{subcategory || 'Add'} ›</Text>
        </Pressable>

        <Field label="Note" value={note} onChangeText={setNote} placeholder="optional" />
      </Card>

      <Button title="Add transaction" icon="checkmark" onPress={submit} />
      {!valid && amount.length > 0 && <Muted style={{ marginTop: 8, color: C.over }}>Enter an amount greater than 0.</Muted>}

      <PickerSheet
        visible={pick === 'cat'}
        title="Category"
        options={[...CATEGORIES]}
        onSelect={(c) => { setCategory(c); setSub(null); }}
        onClose={() => setPick(null)}
      />
      <PickerSheet
        visible={pick === 'sub'}
        title={`${category} — sub-category`}
        options={TAXONOMY[category] || []}
        allowCustom
        onSelect={setSub}
        onClose={() => setPick(null)}
      />
    </ScrollView>
  );
}

const rowBtn = {
  flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
  paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line,
};
