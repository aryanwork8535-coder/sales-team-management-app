import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, StatusChip, AdminModal, Field, SelectChips, PrimaryBtn, GhostBtn } from '@/src/adminUi';

type Slab = { min_qty: string; article: string };

export default function AdminSchemes() {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [territory, setTerritory] = useState('All');
  const [distId, setDistId] = useState('All');
  const [slabs, setSlabs] = useState<Slab[]>([{ min_qty: '', article: '' }]);

  const load = useCallback(async () => {
    try {
      const [s, b, t, u] = await Promise.all([api.adminSchemes(), api.adminBrands(), api.adminTerritories(), api.adminUsers()]);
      setSchemes(s || []);
      setBrands((b || []).filter((x: any) => x.active));
      setTerritories((t || []).filter((x: any) => x.active));
      setDistributors((u || []).filter((x: any) => x.role === 'distributor'));
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

  const distName = (id?: string) => distributors.find((d) => d.id === id)?.name;

  const openAdd = () => {
    setEditing(null); setName(''); setBrand(brands[0]?.name || ''); setStartDate(''); setEndDate('');
    setTerritory('All'); setDistId('All'); setSlabs([{ min_qty: '', article: '' }]); setModal(true);
  };

  const openEdit = (s: any) => {
    setEditing(s); setName(s.name); setBrand(s.brand);
    setStartDate(s.start_date || ''); setEndDate(s.end_date || '');
    setTerritory(s.territory || 'All'); setDistId(s.distributor_id || 'All');
    setSlabs((s.slabs || []).map((x: any) => ({ min_qty: String(x.min_qty), article: x.article })));
    setModal(true);
  };

  const save = async () => {
    if (!name.trim() || !brand) { notify('Missing fields', 'Scheme name and brand are required'); return; }
    const parsedSlabs = slabs
      .filter((s) => s.min_qty.trim() && s.article.trim())
      .map((s) => ({ min_qty: parseInt(s.min_qty, 10) || 0, article: s.article.trim() }));
    if (parsedSlabs.length === 0) { notify('Missing fields', 'Add at least one slab (min qty + gift)'); return; }
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(), brand, slabs: parsedSlabs,
        start_date: startDate.trim() || null, end_date: endDate.trim() || null,
        territory: territory === 'All' ? null : territory,
        distributor_id: distId === 'All' ? null : distId,
      };
      if (editing) await api.adminUpdateScheme(editing.id, payload);
      else await api.adminCreateScheme(payload);
      setModal(false);
      notify('Success', editing ? 'Scheme updated — order booking picks it up immediately' : 'Scheme created — orders now auto-apply it');
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = (s: any) => {
    confirmThen(`${s.active ? 'Deactivate' : 'Activate'} scheme "${s.name}"?`, async () => {
      try {
        await api.adminUpdateScheme(s.id, { active: !s.active });
        notify('Success', 'Scheme status updated');
        load();
      } catch (e: any) {
        notify('Error', e.message);
      }
    });
  };

  const setSlab = (i: number, k: keyof Slab, v: string) => {
    setSlabs((prev) => prev.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.pageTitle}>Schemes</Text>
          <Text style={styles.pageSub}>{schemes.length} schemes • auto-applied on eligible orders</Text>
        </View>
        <PrimaryBtn testID="add-scheme-btn" label="+ Create Scheme" onPress={openAdd} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : schemes.length === 0 ? (
        <Card><Text style={styles.empty}>No schemes yet</Text></Card>
      ) : (
        schemes.map((s) => (
          <Card key={s.id}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.schemeName}>{s.name}</Text>
                <Text style={styles.schemeMeta}>
                  {s.brand} • {s.start_date || 'no start'} → {s.end_date || 'no end'}
                  {s.territory ? ` • ${s.territory}` : ' • All territories'}
                  {s.distributor_id ? ` • ${distName(s.distributor_id) || 'Distributor'}` : ''}
                </Text>
              </View>
              <StatusChip status={s.active ? 'Active' : 'Inactive'} />
              <Pressable testID={`edit-scheme-${s.id}`} style={styles.iconAction} onPress={() => openEdit(s)}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
              </Pressable>
              <Pressable testID={`toggle-scheme-${s.id}`} style={styles.iconAction} onPress={() => toggleActive(s)}>
                <MaterialCommunityIcons name={s.active ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.colors.warning} />
              </Pressable>
            </View>
            <View style={styles.slabRow}>
              {(s.slabs || []).map((sl: any, i: number) => (
                <View key={i} style={styles.slabChip}>
                  <MaterialCommunityIcons name="gift-outline" size={13} color={theme.colors.warning} />
                  <Text style={styles.slabText}>{sl.min_qty}+ → {sl.article}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))
      )}

      <AdminModal visible={modal} title={editing ? `Edit ${editing.name}` : 'Create Scheme'} onClose={() => setModal(false)}>
        <Field testID="scheme-name" label="Scheme Name *" value={name} onChangeText={setName} placeholder="DHAMAL Monsoon Dhamaka" />
        <SelectChips label="Brand *" options={brands.map((b) => b.name)} value={brand} onChange={setBrand} />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="scheme-start" label="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-09-01" /></View>
          <View style={{ flex: 1 }}><Field testID="scheme-end" label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="2026-12-31" /></View>
        </View>
        <SelectChips label="Territory" options={['All', ...territories.map((t) => t.name)]} value={territory} onChange={setTerritory} />
        <Text style={styles.selLabel}>Distributor</Text>
        <View style={styles.selWrap}>
          {[{ id: 'All', name: 'All' }, ...distributors].map((d) => (
            <Pressable key={d.id} testID={`scheme-dist-${d.id}`} style={[styles.selChip, distId === d.id && styles.selChipActive]} onPress={() => setDistId(d.id)}>
              <Text style={[styles.selText, distId === d.id && { color: '#fff' }]}>{d.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.selLabel}>Slabs (minimum qty → gift article)</Text>
        {slabs.map((sl, i) => (
          <View key={i} style={styles.slabEditRow}>
            <TextInput
              testID={`slab-qty-${i}`}
              value={sl.min_qty}
              onChangeText={(v) => setSlab(i, 'min_qty', v)}
              placeholder="Qty"
              keyboardType="numeric"
              placeholderTextColor={theme.colors.muted}
              style={[styles.slabInput, { width: 70 }]}
            />
            <TextInput
              testID={`slab-article-${i}`}
              value={sl.article}
              onChangeText={(v) => setSlab(i, 'article', v)}
              placeholder="Gift article e.g. Steel Tumbler Set"
              placeholderTextColor={theme.colors.muted}
              style={[styles.slabInput, { flex: 1 }]}
            />
            <Pressable testID={`slab-remove-${i}`} style={styles.slabRemove} onPress={() => setSlabs((p) => p.filter((_, idx) => idx !== i))}>
              <MaterialCommunityIcons name="close" size={16} color={theme.colors.error} />
            </Pressable>
          </View>
        ))}
        <Pressable testID="add-slab-btn" style={styles.addSlabBtn} onPress={() => setSlabs((p) => [...p, { min_qty: '', article: '' }])}>
          <MaterialCommunityIcons name="plus" size={16} color={theme.colors.brand} />
          <Text style={styles.addSlabText}>Add Slab</Text>
        </Pressable>

        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setModal(false)} />
          <PrimaryBtn testID="save-scheme-btn" label={editing ? 'Save Changes' : 'Create Scheme'} busy={busy} onPress={save} />
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
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  schemeName: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  schemeMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  iconAction: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  slabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 999, backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#F3DFB6' },
  slabText: { fontSize: 11, fontWeight: '600', color: '#8a6d1d' },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  formRow: { flexDirection: 'row', gap: 12 },
  selLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, marginBottom: 6 },
  selWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  selChip: { paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff' },
  selChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  selText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  slabEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  slabInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, height: 40, fontSize: 13, color: theme.colors.onSurface, backgroundColor: '#fff' },
  slabRemove: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  addSlabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, height: 34, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.brandTertiary, marginBottom: 14 },
  addSlabText: { fontSize: 12, fontWeight: '700', color: theme.colors.brand },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
