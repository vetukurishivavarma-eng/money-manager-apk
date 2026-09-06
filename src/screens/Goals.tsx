import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { C } from '../theme';
import { Button, Card, Empty, Field, Muted, ProgressBar } from '../components/ui';
import { useReload } from '../components/hooks';
import { addGoal, contributeGoal, deleteGoal, getGoals, Goal } from '../db';
// @ts-ignore
import { formatINR } from '../format.js';

function AddForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [months, setMonths] = useState('');
  const t = parseFloat(target.replace(/,/g, ''));
  return (
    <Card>
      <Field label="Goal" value={name} onChangeText={setName} placeholder="e.g. Goa trip, Emergency fund" />
      <Field label="Target (₹)" value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="50000" />
      <Field label="In how many months? (optional)" value={months} onChangeText={setMonths} keyboardType="numeric" placeholder="6" />
      <Button
        title="Create goal"
        onPress={() => {
          if (!name.trim() || !(t > 0)) return;
          const m = parseInt(months);
          addGoal(name.trim(), t, m > 0 ? dayjs().add(m, 'month').valueOf() : null);
          onDone();
        }}
      />
    </Card>
  );
}

function GoalCard({ g, onChange }: { g: Goal; onChange: () => void }) {
  const pct = g.target > 0 ? g.saved / g.target : 0;
  const perMonth =
    g.deadline && g.deadline > Date.now()
      ? (g.target - g.saved) / Math.max(1, dayjs(g.deadline).diff(dayjs(), 'month'))
      : 0;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16 }}>{g.name}</Text>
        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert('Delete goal?', g.name, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => { deleteGoal(g.id); onChange(); } },
            ])
          }
        >
          <Ionicons name="trash-outline" size={18} color={C.sub} />
        </Pressable>
      </View>
      <Text style={{ color: C.ink, fontWeight: '700', marginVertical: 4 }}>
        {formatINR(g.saved)} <Muted>of {formatINR(g.target)} ({Math.round(pct * 100)}%)</Muted>
      </Text>
      <ProgressBar pct={pct} state={pct >= 1 ? 'ok' : undefined} />
      {g.deadline ? (
        <Muted style={{ fontSize: 11, marginTop: 6 }}>
          by {dayjs(g.deadline).format('MMM YYYY')}
          {perMonth > 0 ? ` · save ${formatINR(perMonth)}/month` : pct >= 1 ? ' · done 🎉' : ''}
        </Muted>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {[500, 1000, 5000].map((v) => (
          <Pressable
            key={v}
            onPress={() => { contributeGoal(g.id, v); onChange(); }}
            style={{ flex: 1, borderWidth: 1, borderColor: C.brand, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}
          >
            <Text style={{ color: C.brand, fontWeight: '700' }}>+{formatINR(v)}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => { contributeGoal(g.id, -500); onChange(); }}
          style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' }}
        >
          <Text style={{ color: C.sub, fontWeight: '700' }}>−500</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function Goals() {
  const [, force] = useState(0);
  const reload = () => force((x) => x + 1);
  useReload(reload);
  const [adding, setAdding] = useState(false);
  const goals = getGoals();

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      {goals.length === 0 && !adding && (
        <Empty icon="flag-outline" text="No goals yet. Set a savings target and chip away at it." />
      )}
      {goals.map((g) => <GoalCard key={g.id} g={g} onChange={reload} />)}

      {adding ? (
        <AddForm onDone={() => { setAdding(false); reload(); }} />
      ) : (
        <Button title="New goal" icon="add" onPress={() => setAdding(true)} />
      )}
    </ScrollView>
  );
}
