import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import { Button, Card, Field, Muted } from '../components/ui';
import { useReload } from '../components/hooks';
import {
  db, distinctAccounts, getIgnoredAccounts, getMeta, getRules, deleteRule,
  setMeta, toggleIgnoredAccount, wipeAll,
} from '../db';
import { hasSmsPermission, requestSmsPermission } from '../sms/scan';
import { ensureNotifPermission } from '../notify';
import { sync } from '../sync';
import { exportCsv, backupJson, restoreJson } from '../backup';
// @ts-ignore
import { formatINR } from '../format.js';

function Line({ children, onPress }: any) {
  const Cmp: any = onPress ? Pressable : View;
  return (
    <Cmp onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      {children}
    </Cmp>
  );
}

export default function Settings() {
  const [, force] = useState(0);
  const reload = () => force((x) => x + 1);
  useReload(reload);
  const [busy, setBusy] = useState(false);

  const [perm, setPerm] = useState(false);
  React.useEffect(() => { hasSmsPermission().then(setPerm); }, []);

  const rules = getRules();
  const accounts = distinctAccounts();
  const ignored = new Set(getIgnoredAccounts());
  const [threshold, setThreshold] = useState(String(getMeta('large_txn_threshold') || '5000'));

  const run = async (fn: () => Promise<any>, done?: string) => {
    setBusy(true);
    try { await fn(); if (done) Alert.alert('Done', done); }
    catch (e: any) { Alert.alert('Something went wrong', String(e?.message || e)); }
    finally { setBusy(false); reload(); }
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Card>
        <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 4 }}>SMS sync</Text>
        <Line>
          <Muted>Read transaction SMS</Muted>
          <Text style={{ color: perm ? C.ok : C.over, fontWeight: '700' }}>{perm ? 'Allowed' : 'Off'}</Text>
        </Line>
        {!perm && (
          <Button title="Grant SMS permission" onPress={() => run(async () => { const g = await requestSmsPermission(); setPerm(g); if (g) await sync({ full: true }); })} />
        )}
        <View style={{ height: 8 }} />
        <Button title="Scan for new transactions" kind="ghost" onPress={() => run(() => sync(), 'Synced.')} />
        <View style={{ height: 8 }} />
        <Button title="Full re-scan (last 6 months)" kind="ghost" onPress={() => run(() => sync({ full: true }), 'Re-scanned.')} />
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 4 }}>Alerts</Text>
        <Button title="Enable notifications" kind="ghost" onPress={() => run(ensureNotifPermission)} />
        <View style={{ height: 12 }} />
        <Field
          label="Large-payment alert above (₹)"
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
        />
        <Button title="Save threshold" kind="ghost" onPress={() => { setMeta('large_txn_threshold', String(parseInt(threshold) || 5000)); Alert.alert('Saved'); }} />
      </Card>

      {accounts.length > 0 && (
        <Card>
          <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 2 }}>Accounts</Text>
          <Muted style={{ marginBottom: 6 }}>Turn one off to stop counting its transactions (e.g. a shared or business account).</Muted>
          {accounts.map((a) => (
            <Line key={a}>
              <Muted>A/c {a}</Muted>
              <Switch
                value={!ignored.has(a)}
                onValueChange={(on) => { toggleIgnoredAccount(a, !on); reload(); }}
                trackColor={{ true: C.brand }}
              />
            </Line>
          ))}
        </Card>
      )}

      {rules.length > 0 && (
        <Card>
          <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 6 }}>Learned category rules</Text>
          {rules.map((r) => (
            <Line key={r.pattern}>
              <Muted style={{ flex: 1 }}>“{r.pattern}” → {r.category}</Muted>
              <Pressable onPress={() => { deleteRule(r.pattern); reload(); }} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={C.over} />
              </Pressable>
            </Line>
          ))}
        </Card>
      )}

      <Card>
        <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 6 }}>Data</Text>
        <Button title="Export CSV" kind="ghost" icon="download-outline" onPress={() => run(exportCsv)} />
        <View style={{ height: 8 }} />
        <Button title="Backup (JSON)" kind="ghost" icon="save-outline" onPress={() => run(backupJson)} />
        <View style={{ height: 8 }} />
        <Button title="Restore from backup" kind="ghost" icon="folder-open-outline" onPress={() => run(async () => { const n = await restoreJson(); Alert.alert('Restored', `${n} transactions added.`); })} />
        <View style={{ height: 8 }} />
        <Button
          title="Erase all data"
          kind="danger"
          onPress={() =>
            Alert.alert('Erase everything?', 'All transactions, budgets and rules on this phone will be deleted.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => { wipeAll(); reload(); } },
            ])
          }
        />
      </Card>

      <Muted style={{ textAlign: 'center', fontSize: 11 }}>
        Money Tracker · all data stays on this device · v1.0.0
      </Muted>

      {busy && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0003', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      )}
    </ScrollView>
  );
}
