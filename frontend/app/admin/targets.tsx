import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { Card, TRow, Th, Td, FilterChips, AdminModal, Field, PrimaryBtn, GhostBtn } from '@/src/adminUi';

const TABS = ['Salespersons', 'Distributors', 'Territories'];
const TAB_ENTITY: Record<string, string> = { Salespersons: 'salesperson', Distributors: 'distributor', Territories: 'territory' };

export default function AdminTargets() {
  const [tab, setTab] = useState('Salespersons');
  const [data, setData] = useState<any>({ salespersons: [], distributors: [], territories: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.adminTargets();
      setData(d || { salespersons: [], distributors: [], territories: [] });
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const rows: any[] = tab === 'Salespersons' ? data.salespersons : tab === 'Distributors' ? data.distributors : data.territories;

  const openEdit = (r: any) => {
    setEditing(r);
    setDaily(String(r.daily_target || ''));
    setMonthly(String(r.monthly_target || ''));
  };

  const save = async () => {
    const d = parseFloat(daily) || 0;
    const m = parseFloat(monthly) || 0;
    const entityType = TAB_ENTITY[tab];
    const entityId = entityType === 'territory' ? editing.name : editing.id;
    setBusy(true);
    try {
      if (d !== editing.daily_target) await api.adminSetTarget({ entity_type: entityType, entity_id: entityId, period: 'daily', value: d });
      if (m !== editing.monthly_target) await api.adminSetTarget({ entity_type: entityType, entity_id: entityId, period: 'monthly', value: m });
      setEditing(null);
      notify('Success', 'Targets saved');
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Targets</Text>
      <Text style={styles.pageSub}>Daily & monthly sales targets for salespersons, distributors and territories</Text>

      <FilterChips options={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={1.8}>{tab === 'Territories' ? 'Territory' : 'Name'}</Th>
            <Th flex={1.3}>{tab === 'Territories' ? 'District' : 'Territory'}</Th>
            <Th>Daily Target</Th>
            <Th>Monthly Target</Th>
            <Th flex={0.6}>Edit</Th>
          </TRow>
          {rows.map((r) => (
            <TRow key={r.id}>
              <Td flex={1.8} bold>{tab === 'Territories' ? r.name : `${r.name} (${r.employee_id})`}</Td>
              <Td flex={1.3}>{tab === 'Territories' ? (r.district || '—') : (r.territory || '—')}</Td>
              <Td bold>{r.daily_target ? fmtINR(r.daily_target) : '—'}</Td>
              <Td bold>{r.monthly_target ? fmtINR(r.monthly_target) : '—'}</Td>
              <View style={{ flex: 0.6 }}>
                <Pressable testID={`edit-target-${r.employee_id || r.name}`} style={styles.iconAction} onPress={() => openEdit(r)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
              </View>
            </TRow>
          ))}
          {rows.length === 0 ? <Text style={styles.empty}>Nothing here yet</Text> : null}
        </Card>
      )}

      <AdminModal visible={!!editing} title={`Targets — ${editing?.name || ''}`} onClose={() => setEditing(null)}>
        <Field testID="daily-target-input" label="Daily Sales Target (₹)" value={daily} onChangeText={setDaily} keyboardType="numeric" placeholder="20000" />
        <Field testID="monthly-target-input" label="Monthly Sales Target (₹)" value={monthly} onChangeText={setMonthly} keyboardType="numeric" placeholder="500000" />
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setEditing(null)} />
          <PrimaryBtn testID="save-targets-btn" label="Save Targets" busy={busy} onPress={save} />
        </View>
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, marginBottom: 16 },
  iconAction: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
