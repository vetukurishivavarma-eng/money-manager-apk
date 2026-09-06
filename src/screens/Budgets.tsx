import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, CATEGORIES, stateColor } from '../theme';
import { Card, Muted, ProgressBar } from '../components/ui';
import { useReload } from '../components/hooks';
import { allTxns, getBudgets, getMeta, setBudget, setMeta } from '../db';
import { categoryStatuses } from '../summary';
import { pushWidgetUpdate } from '../widget/update';
// @ts-ignore
import * as B from '../budget.js';
// @ts-ignore
import { formatINR } from '../format.js';

function BudgetRow({
  label, spent, value, state, onChange, onSuggest,
}: {
  label: string; spent: number; value: number; state?: string;
  onChange: (n: number) => void; onSuggest: () => number;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: C.ink, fontWeight: '700', flex: 1 }}>{label}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={() => onChange(parseFloat(text.replace(/,/g, '')) || 0)}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={C.sub}
          style={{
            width: 96, textAlign: 'right', borderWidth: 1, borderColor: C.line, borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 6, color: C.ink,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Muted style={{ fontSize: 11 }}>{formatINR(spent)} spent{value ? ` of ${formatINR(value)}` : ''}</Muted>
        <Pressable onPress={() => { const n = onSuggest(); setText(String(n)); onChange(n); }}>
          <Text style={{ fontSize: 11, color: C.brand, fontWeight: '700' }}>Suggest</Text>
        </Pressable>
      </View>
      {value > 0 && <View style={{ marginTop: 5 }}><ProgressBar pct={spent / value} state={state} height={5} /></View>}
    </View>
  );
}

export default function Budgets() {
  const [, force] = useState(0);
  const reload = () => force((x) => x + 1);
  useReload(reload);

  const txns = allTxns();
  const budgets = getBudgets();
  const cats = categoryStatuses();
  const statusOf = (c: string) => cats.find((x) => x.category === c);
  const now = Date.now();

  const explicitOverall = Number(getMeta('overall_budget') || 0);
  const sumCats = Object.values(budgets).reduce((s, v) => s + v, 0);
  const overallSpent = B.totalSpent(txns, B.monthKey(now));

  const setOverall = (n: number) => { setMeta('overall_budget', String(n)); pushWidgetUpdate(); reload(); };
  const setCat = (c: string, n: number) => { setBudget(c, n); pushWidgetUpdate(); reload(); };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 }}>Monthly budget</Text>
        <Muted style={{ marginBottom: 8 }}>
          Your overall cap for the month. Leave it blank to use the sum of category budgets ({formatINR(sumCats)}).
        </Muted>
        <BudgetRow
          label="Overall"
          spent={overallSpent}
          value={explicitOverall}
          state={statusOf('__') ? undefined : B.budgetStatus(overallSpent, explicitOverall || sumCats, new Date().getDate(), 30).state}
          onChange={setOverall}
          onSuggest={() => B.suggestBudget(txns, null, now, 3)}
        />
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 }}>Category budgets</Text>
        <Muted style={{ marginBottom: 6 }}>Tap “Suggest” to use your last 3-month average. You'll get a warning at 80% and again when you go over.</Muted>
        {CATEGORIES.filter((c) => c !== 'Income' && c !== 'Transfers').map((c) => {
          const st = statusOf(c);
          return (
            <BudgetRow
              key={c}
              label={c}
              spent={st?.spent || 0}
              value={budgets[c] || 0}
              state={st?.state}
              onChange={(n) => setCat(c, n)}
              onSuggest={() => B.suggestBudget(txns, c, now, 3)}
            />
          );
        })}
      </Card>
    </ScrollView>
  );
}
