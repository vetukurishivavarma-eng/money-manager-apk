import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { C, CATEGORIES } from '../theme';
import { Card, Muted, ProgressBar, PickerSheet } from '../components/ui';
import { useReload } from '../components/hooks';
import {
  allTxns, getBudgets, getFlag, getMeta, getMetaNum, setBudget, setMeta,
} from '../db';
import { categoryStatuses, computeSnapshot, expectedIncome } from '../summary';
import { pushWidgetUpdate } from '../widget/update';
// @ts-ignore
import * as B from '../budget.js';
// @ts-ignore
import { formatINR } from '../format.js';

function BudgetRow({
  label, spent, value, rolled, state, onChange, onSuggest,
}: {
  label: string; spent: number; value: number; rolled?: number; state?: string;
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
          style={{ width: 96, textAlign: 'right', borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, color: C.ink }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Muted style={{ fontSize: 11 }}>
          {formatINR(spent)} spent{value ? ` of ${formatINR(value + (rolled || 0))}` : ''}
          {rolled ? ` · ${rolled > 0 ? '+' : ''}${formatINR(rolled)} rolled` : ''}
        </Muted>
        <Pressable onPress={() => { const n = onSuggest(); setText(String(n)); onChange(n); }}>
          <Text style={{ fontSize: 11, color: C.brand, fontWeight: '700' }}>Suggest</Text>
        </Pressable>
      </View>
      {value > 0 && <View style={{ marginTop: 5 }}><ProgressBar pct={spent / (value + (rolled || 0))} state={state} height={5} /></View>}
    </View>
  );
}

export default function Budgets() {
  const [, force] = useState(0);
  const reload = () => force((x) => x + 1);
  useReload(reload);
  const [pickDay, setPickDay] = useState(false);

  const txns = allTxns();
  const budgets = getBudgets();
  const cats = categoryStatuses();
  const statusOf = (c: string) => cats.find((x) => x.category === c);
  const now = Date.now();

  const snap = computeSnapshot().snapshot;
  const explicitOverall = getMetaNum('overall_budget', 0);
  const sumCats = Object.values(budgets).reduce((s, v) => s + v, 0);
  const rollover = getFlag('rollover');
  const cycleDay = Math.min(28, Math.max(1, Math.round(getMetaNum('cycle_start_day', 1))));

  const income = expectedIncome();
  const leftToAllocate = income - sumCats;

  const setOverall = (n: number) => { setMeta('overall_budget', String(n)); pushWidgetUpdate(); reload(); };
  const setCat = (c: string, n: number) => { setBudget(c, n); pushWidgetUpdate(); reload(); };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontWeight: '700' }}>Roll unspent budget over</Text>
            <Muted style={{ fontSize: 11 }}>Money you don't spend in a category is added to next cycle (and overspend is deducted).</Muted>
          </View>
          <Switch value={rollover} onValueChange={(v) => { setMeta('rollover', v ? '1' : '0'); pushWidgetUpdate(); reload(); }} trackColor={{ true: C.brand }} />
        </View>
        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 8 }} />
        <Pressable onPress={() => setPickDay(true)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontWeight: '700' }}>Cycle starts on day {cycleDay}</Text>
            <Muted style={{ fontSize: 11 }}>Set this to your salary date to budget payday-to-payday.</Muted>
          </View>
          <Text style={{ color: C.brand, fontWeight: '700' }}>Change ›</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 }}>Monthly budget</Text>
        <Muted style={{ marginBottom: 8 }}>
          Overall cap for the cycle. Blank = sum of category budgets ({formatINR(sumCats)}).
        </Muted>
        <BudgetRow
          label="Overall"
          spent={snap.spent}
          value={explicitOverall}
          rolled={explicitOverall ? snap.rollover : 0}
          state={snap.state}
          onChange={setOverall}
          onSuggest={() => B.suggestBudget(txns, null, now, 3)}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Muted>Expected income ≈ {formatINR(income)}</Muted>
          <Text style={{ fontWeight: '700', color: leftToAllocate < 0 ? C.over : C.ok }}>
            {leftToAllocate >= 0 ? `${formatINR(leftToAllocate)} unallocated` : `${formatINR(-leftToAllocate)} over income`}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 }}>Category budgets</Text>
        <Muted style={{ marginBottom: 6 }}>Tap "Suggest" for your 3-month average. Warning at 80% and again when you go over.</Muted>
        {CATEGORIES.filter((c) => c !== 'Income' && c !== 'Transfers').map((c) => {
          const st = statusOf(c);
          return (
            <BudgetRow
              key={c}
              label={c}
              spent={st?.spent || 0}
              value={budgets[c] || 0}
              rolled={budgets[c] ? st?.rollover : 0}
              state={st?.state}
              onChange={(n) => setCat(c, n)}
              onSuggest={() => B.suggestBudget(txns, c, now, 3)}
            />
          );
        })}
      </Card>

      <PickerSheet
        visible={pickDay}
        title="Cycle start day"
        options={Array.from({ length: 28 }, (_, i) => String(i + 1))}
        onSelect={(v) => { setMeta('cycle_start_day', v); pushWidgetUpdate(); reload(); }}
        onClose={() => setPickDay(false)}
      />
    </ScrollView>
  );
}
