import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, AdminModal, Field, SelectChips, PrimaryBtn, GhostBtn } from '@/src/adminUi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AdminBeats() {
  const [beats, setBeats] = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [spId, setSpId] = useState('');
  const [day, setDay] = useState('Monday');
  const [territory, setTerritory] = useState('');
  const [routeName, setRouteName] = useState('');
  const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]);
  const [retailerSearch, setRetailerSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, u, t, r] = await Promise.all([api.adminBeats(), api.adminUsers(), api.adminTerritories(), api.retailers()]);
      setBeats(b || []);
      setSalespersons((u || []).filter((x: any) => x.role === 'salesperson'));
      setTerritories(t || []);
      setRetailers(r || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const confirmThen = (msg: string, fn: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(msg)) fn(); }
    else Alert.alert('Confirm', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', onPress: fn }]);
  };

  const openAdd = () => {
    setEditing(null); setSpId(salespersons[0]?.id || ''); setDay('Monday'); setTerritory('');
    setRouteName(''); setSelectedRetailers([]); setRetailerSearch(''); setModal(true);
  };

  const openEdit = (b: any) => {
    setEditing(b); setSpId(b.salesperson_id); setDay(b.day); setTerritory(b.territory || '');
    setRouteName(b.route_name || ''); setSelectedRetailers(b.retailer_ids || []); setRetailerSearch(''); setModal(true);
  };

  const toggleRetailer = (id: string) => {
    setSelectedRetailers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!spId) { notify('Missing field', 'Select a salesperson'); return; }
    if (selectedRetailers.length === 0) { notify('Missing field', 'Select at least one retailer for the beat'); return; }
    setBusy(true);
    try {
      const payload = { salesperson_id: spId, day, territory, route_name: routeName.trim(), retailer_ids: selectedRetailers };
      if (editing) await api.adminUpdateBeat(editing.id, payload);
      else await api.adminCreateBeat(payload);
      setModal(false);
      notify('Success', editing ? 'Beat updated' : 'Beat created');
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = (b: any) => {
    confirmThen(`${b.active !== false ? 'Deactivate' : 'Activate'} ${b.salesperson_name}'s ${b.day} beat?`, async () => {
      try {
        await api.adminUpdateBeat(b.id, { active: b.active === false });
        notify('Success', 'Beat status updated');
        load();
      } catch (e: any) {
        notify('Error', e.message);
      }
    });
  };

  const filteredRetailers = retailerSearch
    ? retailers.filter((r) => r.shop_name.toLowerCase().includes(retailerSearch.toLowerCase()))
    : retailers;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.pageTitle}>Beat Plans</Text>
          <Text style={styles.pageSub}>{beats.length} beats across the team</Text>
        </View>
        <PrimaryBtn testID="add-beat-btn" label="+ Create Beat" onPress={openAdd} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={1.6}>Salesperson</Th>
            <Th>Day</Th>
            <Th flex={1.3}>Territory</Th>
            <Th flex={1.3}>Route</Th>
            <Th>Retailers</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </TRow>
          {beats.map((b) => (
            <TRow key={b.id}>
              <Td flex={1.6} bold>{b.salesperson_name} ({b.employee_id})</Td>
              <Td>{b.day}</Td>
              <Td flex={1.3}>{b.territory || '—'}</Td>
              <Td flex={1.3}>{b.route_name || '—'}</Td>
              <Td>{b.retailer_count}</Td>
              <View style={{ flex: 1 }}><StatusChip status={b.active !== false ? 'Active' : 'Inactive'} /></View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <Pressable testID={`edit-beat-${b.employee_id}-${b.day}`} style={styles.iconAction} onPress={() => openEdit(b)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
                <Pressable testID={`toggle-beat-${b.employee_id}-${b.day}`} style={styles.iconAction} onPress={() => toggleActive(b)}>
                  <MaterialCommunityIcons name={b.active !== false ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.colors.warning} />
                </Pressable>
              </View>
            </TRow>
          ))}
          {beats.length === 0 ? <Text style={styles.empty}>No beats yet</Text> : null}
        </Card>
      )}

      <AdminModal visible={modal} title={editing ? 'Edit Beat' : 'Create Beat'} onClose={() => setModal(false)}>
        <Text style={styles.selLabel}>Salesperson</Text>
        <View style={styles.selWrap}>
          {salespersons.map((s) => (
            <Pressable key={s.id} testID={`beat-sp-${s.employee_id}`} style={[styles.selChip, spId === s.id && styles.selChipActive]} onPress={() => setSpId(s.id)}>
              <Text style={[styles.selText, spId === s.id && { color: '#fff' }]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <SelectChips label="Day" options={DAYS} value={day} onChange={setDay} />
        <SelectChips label="Territory" options={territories.filter((t) => t.active).map((t) => t.name)} value={territory} onChange={setTerritory} />
        <Field testID="beat-route" label="Route Name" value={routeName} onChangeText={setRouteName} placeholder="e.g. Rajaram Rd → Rankala loop" />

        <Text style={styles.selLabel}>Retailers ({selectedRetailers.length} selected)</Text>
        <TextInput
          testID="beat-retailer-search"
          value={retailerSearch}
          onChangeText={setRetailerSearch}
          placeholder="Search retailers..."
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
        />
        <View style={styles.retailerList}>
          {filteredRetailers.slice(0, 40).map((r) => {
            const sel = selectedRetailers.includes(r.id);
            return (
              <Pressable key={r.id} testID={`beat-ret-${r.retailer_code}`} style={styles.retailerRow} onPress={() => toggleRetailer(r.id)}>
                <MaterialCommunityIcons name={sel ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={sel ? theme.colors.brand : theme.colors.muted} />
                <Text style={styles.retailerName} numberOfLines={1}>{r.shop_name}</Text>
                <Text style={styles.retailerArea}>{r.area}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setModal(false)} />
          <PrimaryBtn testID="save-beat-btn" label={editing ? 'Save Changes' : 'Create Beat'} busy={busy} onPress={save} />
        </View>
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  iconAction: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  selLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, marginBottom: 6 },
  selWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  selChip: { paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff' },
  selChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  selText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  searchInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, height: 38, fontSize: 13, color: theme.colors.onSurface, backgroundColor: '#fff', marginBottom: 8 },
  retailerList: { maxHeight: 220, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, overflow: 'hidden', marginBottom: 14 },
  retailerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  retailerName: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  retailerArea: { fontSize: 11, color: theme.colors.muted },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
