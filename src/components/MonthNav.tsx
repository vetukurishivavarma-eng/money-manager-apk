import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

export function MonthNav({
  label, atCurrent, onPrev, onNext,
}: { label: string; atCurrent: boolean; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 6 }}>
      <Pressable onPress={onPrev} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={C.brand} />
      </Pressable>
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, minWidth: 130, textAlign: 'center' }}>{label}</Text>
      <Pressable onPress={onNext} hitSlop={12} disabled={atCurrent}>
        <Ionicons name="chevron-forward" size={20} color={atCurrent ? C.line : C.brand} />
      </Pressable>
    </View>
  );
}
