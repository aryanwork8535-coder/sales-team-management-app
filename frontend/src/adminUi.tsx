import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from './theme';

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: '#FDECD3', fg: '#D97706' },
  Approved: { bg: '#DCF5E7', fg: '#0D824B' },
  Rejected: { bg: '#FEE2E2', fg: '#DC2626' },
  Open: { bg: '#FEE2E2', fg: '#DC2626' },
  'In Progress': { bg: '#FDECD3', fg: '#D97706' },
  Resolved: { bg: '#DCF5E7', fg: '#0D824B' },
  Submitted: { bg: '#D1F0F7', fg: '#0891B2' },
  Active: { bg: '#DCF5E7', fg: '#0D824B' },
  Inactive: { bg: '#EEF2F0', fg: '#6E7671' },
};

export function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Inactive;
  return (
    <View style={[s.chip, { backgroundColor: c.bg }]}>
      <Text style={[s.chipText, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

export function Kpi({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={s.kpi}>
      <View style={[s.kpiIcon, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.card}>
      {title ? (
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Th({ children, flex = 1 }: { children: React.ReactNode; flex?: number }) {
  return <Text style={[s.th, { flex }]}>{children}</Text>;
}

export function Td({ children, flex = 1, bold }: { children: React.ReactNode; flex?: number; bold?: boolean }) {
  return (
    <Text style={[s.td, { flex }, bold && { fontWeight: '700' }]} numberOfLines={2}>
      {children}
    </Text>
  );
}

export function TRow({ children, header }: { children: React.ReactNode; header?: boolean }) {
  return <View style={[s.trow, header && s.trowHead]}>{children}</View>;
}

export function FilterChips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.filterRow}>
      {options.map((o) => (
        <Pressable key={o} testID={`filter-${o}`} style={[s.fchip, value === o && s.fchipActive]} onPress={() => onChange(o)}>
          <Text style={[s.fchipText, value === o && s.fchipTextActive]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, testID }: any) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={s.fieldInput}
      />
    </View>
  );
}

export function SelectChips({ label, options, value, onChange }: { label?: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Pressable key={o} testID={`select-${o}`} style={[s.fchip, value === o && s.fchipActive]} onPress={() => onChange(o)}>
            <Text style={[s.fchipText, value === o && s.fchipTextActive]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function PrimaryBtn({ label, onPress, busy, tone = 'brand', small, testID }: any) {
  const bg = tone === 'danger' ? theme.colors.error : tone === 'success' ? theme.colors.success : theme.colors.brand;
  return (
    <Pressable
      testID={testID}
      style={[s.btn, small && s.btnSmall, { backgroundColor: bg }, busy && { opacity: 0.7 }]}
      disabled={busy}
      onPress={onPress}
    >
      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[s.btnText, small && { fontSize: 12 }]}>{label}</Text>}
    </Pressable>
  );
}

export function GhostBtn({ label, onPress, small, testID }: any) {
  return (
    <Pressable testID={testID} style={[s.ghostBtn, small && s.btnSmall]} onPress={onPress}>
      <Text style={s.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

export function AdminModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{title}</Text>
            <Pressable testID="modal-close" onPress={onClose} style={s.modalClose}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: 20 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '700' },
  kpi: { flexGrow: 1, flexBasis: 170, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  kpiIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: theme.colors.onSurface },
  kpiLabel: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, gap: 8 },
  trowHead: { borderBottomWidth: 1, borderBottomColor: theme.colors.borderStrong, paddingVertical: 8 },
  th: { fontSize: 11, fontWeight: '700', color: theme.colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: 13, color: theme.colors.onSurface },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  fchip: { paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff' },
  fchipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  fchipText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  fchipTextActive: { color: '#fff' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, color: theme.colors.onSurface, backgroundColor: '#fff' },
  btn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnSmall: { height: 34, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ghostBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: '#fff' },
  ghostBtnText: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 560, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
