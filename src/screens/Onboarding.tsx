import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import { Button, Card, Muted } from '../components/ui';
import { requestSmsPermission } from '../sms/scan';
import { ensureNotifPermission } from '../notify';
import { registerBackgroundSync } from '../background';
import { sync } from '../sync';
import { setMeta } from '../db';

const POINTS = [
  ['sparkles', 'Automatic', 'Every bank SMS about a payment becomes a transaction — amount, merchant and date filled in for you.'],
  ['lock-closed', 'Private', 'SMS are read and parsed on your phone. Nothing is uploaded. There is no account and no server.'],
  ['pie-chart', 'Categorise later', 'Open a transaction whenever you like to set its category, sub-category and notes.'],
  ['notifications', 'Stay in budget', 'Set monthly limits and get a warning before you cross them. A home-screen widget shows where you stand.'],
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const sms = await requestSmsPermission();
    await ensureNotifPermission();
    setMeta('onboarded', '1');
    if (sms) {
      await registerBackgroundSync();
      await sync({ full: true });
    }
    setBusy(false);
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, backgroundColor: C.bg, flexGrow: 1 }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: C.brand }}>Money Tracker</Text>
      <Muted style={{ marginTop: 6, marginBottom: 24 }}>Know where your money goes — without typing every expense.</Muted>

      {POINTS.map(([icon, title, body]) => (
        <Card key={title as string}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Ionicons name={icon as any} size={22} color={C.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 3 }}>{title}</Text>
              <Muted>{body}</Muted>
            </View>
          </View>
        </Card>
      ))}

      <View style={{ height: 8 }} />
      {busy ? (
        <View style={{ alignItems: 'center', padding: 16 }}>
          <ActivityIndicator color={C.brand} />
          <Muted style={{ marginTop: 8 }}>Reading your transaction history…</Muted>
        </View>
      ) : (
        <>
          <Button title="Allow SMS access & continue" icon="chatbox-ellipses" onPress={start} />
          <View style={{ height: 8 }} />
          <Button title="Skip — I'll add expenses manually" kind="ghost" onPress={() => { setMeta('onboarded', '1'); onDone(); }} />
        </>
      )}
      <Muted style={{ marginTop: 16, fontSize: 11, textAlign: 'center' }}>
        Android only. The SMS permission is used solely to detect bank transaction messages on this device.
      </Muted>
    </ScrollView>
  );
}
