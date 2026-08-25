import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, AdminModal, Field, PrimaryBtn, GhostBtn } from '@/src/adminUi';

export default function AdminTerritories() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.adminTerritories();
      setItems(d || []);
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

  const openAdd = () => { setEditing(null); setName(''); setDistrict(''); setModal(true); };
  const openEdit = (t: any) => { setEditing(t); setName(t.name); setDistrict(t.district || ''); setModal(true); };

  const save = async () => {
    if (!name.trim()) { notify('Missing field', 'Territory name is required'); return; }
    setBusy(true);
    try {
      if (editing) await api.adminUpdateTerritory(editing.id, { name: name.trim(), district: district.trim() });
      else await api.adminCreateTerritory({ name: name.trim(), district: district.trim() });
      setModal(false);
      notify('Success', editing ? 'Territory updated' : 'Territory created');
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = (t: any) => {
    confirmThen(`${t.active ? 'Deactivate' : 'Activate'} territory ${t.name}?`, async () => {
      try {
        await api.adminUpdateTerritory(t.id, { active: !t.active });
        notify('Success', `${t.name} ${t.active ? 'deactivated' : 'activated'}`);
        load();
      } catch (e: any) {
        notify('Error', e.message);
      }
    });
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.pageTitle}>Territories</Text>
          <Text style={styles.pageSub}>{items.length} territories with assignments</Text>
        </View>
        <PrimaryBtn testID="add-territory-btn" label="+ Add Territory" onPress={openAdd} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={1.6}>Territory</Th>
            <Th flex={1.2}>District</Th>
            <Th>Salespersons</Th>
            <Th>Retailers</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </TRow>
          {items.map((t) => (
            <TRow key={t.id}>
              <Td flex={1.6} bold>{t.name}</Td>
              <Td flex={1.2}>{t.district || '—'}</Td>
              <Td>{t.salesperson_count}</Td>
              <Td>{t.retailer_count}</Td>
              <View style={{ flex: 1 }}><StatusChip status={t.active ? 'Active' : 'Inactive'} /></View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <Pressable testID={`edit-territory-${t.name}`} style={styles.iconAction} onPress={() => openEdit(t)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
                <Pressable testID={`toggle-territory-${t.name}`} style={styles.iconAction} onPress={() => toggleActive(t)}>
                  <MaterialCommunityIcons name={t.active ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.colors.warning} />
                </Pressable>
              </View>
            </TRow>
          ))}
          {items.length === 0 ? <Text style={styles.empty}>No territories yet</Text> : null}
        </Card>
      )}

      <AdminModal visible={modal} title={editing ? `Edit ${editing.name}` : 'Add Territory'} onClose={() => setModal(false)}>
        <Field testID="territory-name" label="Territory Name *" value={name} onChangeText={setName} placeholder="Kolhapur City" />
        <Field testID="territory-district" label="District" value={district} onChangeText={setDistrict} placeholder="Kolhapur" />
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setModal(false)} />
          <PrimaryBtn testID="save-territory-btn" label={editing ? 'Save Changes' : 'Create Territory'} busy={busy} onPress={save} />
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
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
