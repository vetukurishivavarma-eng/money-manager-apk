import React, { ReactNode, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, stateColor } from '../theme';
// @ts-ignore
import { formatINR } from '../format.js';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function H({ children }: { children: ReactNode }) {
  return <Text style={s.h}>{children}</Text>;
}

export function Muted({
  children, style, numberOfLines,
}: { children: ReactNode; style?: any; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[s.muted, style]}>{children}</Text>;
}

export function Amount({ value, direction, size = 16 }: { value: number; direction?: string; size?: number }) {
  const color = direction === 'credit' ? C.credit : direction === 'debit' ? C.debit : C.ink;
  const prefix = direction === 'credit' ? '+' : direction === 'debit' ? '-' : '';
  return <Text style={{ color, fontSize: size, fontWeight: '700' }}>{prefix}{formatINR(value)}</Text>;
}

export function ProgressBar({ pct, state, height = 8 }: { pct: number; state?: string; height?: number }) {
  const w = Math.max(0, Math.min(1, pct)) * 100;
  return (
    <View style={{ height, backgroundColor: C.line, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ height, width: `${w}%`, backgroundColor: state ? stateColor(state) : C.brand, borderRadius: height / 2 }} />
    </View>
  );
}

export function Button({
  title, onPress, kind = 'primary', icon,
}: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: any }) {
  const bg = kind === 'primary' ? C.brand : kind === 'danger' ? C.over : 'transparent';
  const fg = kind === 'ghost' ? C.brand : '#fff';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: C.brand },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: fg, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label, value, onChangeText, keyboardType, placeholder,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'numeric'; placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Muted style={{ marginBottom: 4 }}>{label}</Muted>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.sub}
        style={s.input}
      />
    </View>
  );
}

export function PickerSheet({
  visible, title, options, onSelect, onClose, allowCustom,
}: {
  visible: boolean; title: string; options: string[];
  onSelect: (v: string) => void; onClose: () => void; allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <Text style={s.h}>{title}</Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {options.map((o) => (
            <Pressable key={o} style={s.opt} onPress={() => { onSelect(o); onClose(); }}>
              <Text style={{ fontSize: 15, color: C.ink }}>{o}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {allowCustom && (
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="Custom…"
              placeholderTextColor={C.sub}
              style={[s.input, { flex: 1 }]}
            />
            <Button title="Add" onPress={() => { if (custom.trim()) { onSelect(custom.trim()); setCustom(''); onClose(); } }} />
          </View>
        )}
      </View>
    </Modal>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: C.brand, borderColor: C.brand }]}
    >
      <Text style={{ color: active ? '#fff' : C.sub, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Ionicons name={icon} size={40} color={C.sub} />
      <Muted style={{ marginTop: 10, textAlign: 'center' }}>{text}</Muted>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 10 },
  muted: { color: C.sub, fontSize: 13 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, backgroundColor: C.card },
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34 },
  opt: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.line, marginRight: 8, marginBottom: 8 },
});
