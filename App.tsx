import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';

import { C } from './src/theme';
import { initDb, getMeta, getFlag } from './src/db';
import { sync } from './src/sync';
import Onboarding from './src/screens/Onboarding';
import Dashboard from './src/screens/Dashboard';
import Spending from './src/screens/Spending';
import Budgets from './src/screens/Budgets';
import Insights from './src/screens/Insights';
import Settings from './src/screens/Settings';
import TxnDetail from './src/screens/TxnDetail';
import AddTxn from './src/screens/AddTxn';
import Upcoming from './src/screens/Upcoming';
import Goals from './src/screens/Goals';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS: Record<string, string> = { Home: 'home', Spending: 'list', Budget: 'wallet', Insights: 'stats-chart' };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: C.ink },
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.sub,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
        tabBarIcon: ({ color, size }) => <Ionicons name={(ICONS[route.name] || 'ellipse') as any} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={Dashboard} options={{ headerShown: false }} />
      <Tab.Screen name="Spending" component={Spending} />
      <Tab.Screen name="Budget" component={Budgets} />
      <Tab.Screen name="Insights" component={Insights} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, primary: C.brand, card: C.bg, text: C.ink, border: C.line },
};

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [failed, setFailed] = useState(false);
  const tryAuth = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Money Tracker' });
    if (r.success) onUnlock();
    else setFailed(true);
  };
  useEffect(() => { tryAuth(); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Ionicons name="lock-closed" size={44} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Money Tracker is locked</Text>
      {failed && (
        <Pressable onPress={tryAuth} style={{ borderWidth: 1, borderColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function App() {
  useMemo(() => initDb(), []);
  const [onboarded, setOnboarded] = useState(() => getMeta('onboarded') === '1');
  const [locked, setLocked] = useState(() => getFlag('app_lock'));
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // block screenshots / screen recording of balances when the app lock is on
    if (getFlag('app_lock')) ScreenCapture.preventScreenCaptureAsync().catch(() => {});
  }, [onboarded, locked]);

  useEffect(() => {
    if (!onboarded) return;
    sync();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        sync();
        if (getFlag('app_lock')) setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [onboarded]);

  if (!onboarded) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Onboarding onDone={() => { setOnboarded(true); setLocked(getFlag('app_lock')); }} />
      </SafeAreaProvider>
    );
  }

  if (locked) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LockScreen onUnlock={() => setLocked(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerShadowVisible: false,
            headerTintColor: C.brand,
            headerTitleStyle: { color: C.ink },
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="TxnDetail" component={TxnDetail} options={{ title: 'Transaction' }} />
          <Stack.Screen name="AddTxn" component={AddTxn} options={{ title: 'Add transaction', presentation: 'modal' }} />
          <Stack.Screen name="Upcoming" component={Upcoming} options={{ title: 'Coming up' }} />
          <Stack.Screen name="Goals" component={Goals} options={{ title: 'Savings goals' }} />
          <Stack.Screen name="Settings" component={Settings} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
