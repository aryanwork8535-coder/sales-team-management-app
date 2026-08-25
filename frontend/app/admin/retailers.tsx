import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, FilterChips, AdminModal, Field, SelectChips, PrimaryBtn, GhostBtn } from '@/src/adminUi';

const STATUS_FILTERS = ['All', 'Active', 'Inactive'];
const EMPTY_FORM: any = {
  shop_name: '', owner_name: '', mobile: '', address: '', area: '', city: '', pincode: '',
  retailer_type: 'Kirana', potential: 'Medium', classification: 'C', territory: '',
  outstanding: '', salesperson_id: '', distributor_id: '', status: 'Active',
};

export default function AdminRetailers() {
  const [retailers, setRetailers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query?: string) => {
    try {
      const [r, u, t] = await Promise.all([api.retailers(query), api.adminUsers(), api.adminTerritories()]);
      setRetailers(r || []);
      setUsers(u || []);
      setTerritories(t || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => load(q || undefined), 400);
    return () => clearTimeout(timer);
  }, [q, load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const salespersons = users.filter((u) => u.role === 'salesperson');
  const distributors = users.filter((u) => u.role === 'distributor');
  const userName = (id?: string) => users.find((u) => u.id === id)?.name || '—';

  const filtered = retailers.filter((r) => statusFilter === 'All' || r.status === statusFilter);

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      shop_name: r.shop_name || '', owner_name: r.owner_name || '', mobile: r.mobile || '',
      address: r.address || '', area: r.area || '', city: r.city || '', pincode: r.pincode || '',
      retailer_type: r.retailer_type || 'Kirana', potential: r.potential || 'Medium',
      classification: r.classification || 'C', territory: r.territory || '',
      outstanding: String(r.outstanding ?? ''), salesperson_id: r.salesperson_id || '',
      distributor_id: r.distributor_id || '', status: r.status || 'Active',
    });
  };

  const save = async () => {
    if (!form.shop_name.trim() || !form.mobile.trim()) { notify('Missing fields', 'Shop name and mobile are required'); return; }
    setBusy(true);
    try {
      const payload: any = {
        shop_name: form.shop_name.trim(), owner_name: form.owner_name.trim(), mobile: form.mobile.trim(),
        address: form.address.trim(), area: form.area.trim(), city: form.city.trim(), pincode: form.pincode.trim(),
        retailer_type: form.retailer_type, potential: form.potential, classification: form.classification,
        territory: form.territory || null, status: form.status,
        salesperson_id: form.salesperson_id || null, distributor_id: form.distributor_id || null,
      };
      if (form.outstanding !== '') payload.outstanding = parseFloat(form.outstanding) || 0;
      // strip nulls that the API treats as "no change" anyway
      Object.keys(payload).forEach((k) => payload[k] === null && delete payload[k]);
      await api.adminUpdateRetailer(editing.id, payload);
      setEditing(null);
      notify('Success', 'Retailer updated');
      load(q || undefined);
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Retailers</Text>
      <Text style={styles.pageSub}>{filtered.length} of {retailers.length} retailers</Text>

      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
          <TextInput
            testID="retailer-admin-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search shop, owner or mobile..."
            placeholderTextColor={theme.colors.muted}
            style={styles.searchInput}
          />
        </View>
        <FilterChips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th>Code</Th>
            <Th flex={1.8}>Shop</Th>
            <Th flex={1.3}>Owner</Th>
            <Th flex={1.1}>Mobile</Th>
            <Th flex={1.1}>Area</Th>
            <Th flex={1.3}>Salesperson</Th>
            <Th>Outstanding</Th>
            <Th>Status</Th>
            <Th flex={0.6}>Edit</Th>
          </TRow>
          {filtered.map((r) => (
            <TRow key={r.id}>
              <Td>{r.retailer_code}</Td>
              <Td flex={1.8} bold>{r.shop_name}</Td>
              <Td flex={1.3}>{r.owner_name}</Td>
              <Td flex={1.1}>{r.mobile}</Td>
              <Td flex={1.1}>{r.area}</Td>
              <Td flex={1.3}>{userName(r.salesperson_id)}</Td>
              <Td bold>{fmtINR(r.outstanding || 0)}</Td>
              <View style={{ flex: 1 }}><StatusChip status={r.status || 'Active'} /></View>
              <View style={{ flex: 0.6 }}>
                <Pressable testID={`edit-retailer-${r.retailer_code}`} style={styles.iconAction} onPress={() => openEdit(r)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
              </View>
            </TRow>
          ))}
          {filtered.length === 0 ? <Text style={styles.empty}>No retailers match</Text> : null}
        </Card>
      )}

      <AdminModal visible={!!editing} title={`Edit ${editing?.shop_name || ''}`} onClose={() => setEditing(null)}>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="ret-shop" label="Shop Name *" value={form.shop_name} onChangeText={set('shop_name')} /></View>
          <View style={{ flex: 1 }}><Field testID="ret-owner" label="Owner Name" value={form.owner_name} onChangeText={set('owner_name')} /></View>
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="ret-mobile" label="Mobile *" value={form.mobile} onChangeText={set('mobile')} keyboardType="phone-pad" /></View>
          <View style={{ flex: 1 }}><Field testID="ret-outstanding" label="Outstanding (₹)" value={form.outstanding} onChangeText={set('outstanding')} keyboardType="numeric" /></View>
        </View>
        <Field testID="ret-address" label="Address" value={form.address} onChangeText={set('address')} />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="ret-area" label="Area" value={form.area} onChangeText={set('area')} /></View>
          <View style={{ flex: 1 }}><Field testID="ret-city" label="City" value={form.city} onChangeText={set('city')} /></View>
          <View style={{ flex: 1 }}><Field testID="ret-pincode" label="Pincode" value={form.pincode} onChangeText={set('pincode')} keyboardType="numeric" /></View>
        </View>
        <SelectChips label="Classification" options={['A', 'B', 'C']} value={form.classification} onChange={set('classification')} />
        <SelectChips label="Potential" options={['High', 'Medium', 'Low']} value={form.potential} onChange={set('potential')} />
        <SelectChips label="Territory" options={territories.filter((t) => t.active).map((t) => t.name)} value={form.territory} onChange={set('territory')} />
        <Text style={styles.selLabel}>Salesperson</Text>
        <View style={styles.selWrap}>
          {salespersons.map((s) => (
            <Pressable key={s.id} testID={`ret-sp-${s.employee_id}`} style={[styles.selChip, form.salesperson_id === s.id && styles.selChipActive]} onPress={() => set('salesperson_id')(s.id)}>
              <Text style={[styles.selText, form.salesperson_id === s.id && { color: '#fff' }]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.selLabel}>Distributor</Text>
        <View style={styles.selWrap}>
          {distributors.map((s) => (
            <Pressable key={s.id} testID={`ret-dist-${s.employee_id}`} style={[styles.selChip, form.distributor_id === s.id && styles.selChipActive]} onPress={() => set('distributor_id')(s.id)}>
              <Text style={[styles.selText, form.distributor_id === s.id && { color: '#fff' }]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <SelectChips label="Status" options={['Active', 'Inactive']} value={form.status} onChange={set('status')} />
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setEditing(null)} />
          <PrimaryBtn testID="save-retailer-btn" label="Save Changes" busy={busy} onPress={save} />
        </View>
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, marginBottom: 14 },
  toolbar: { gap: 12, marginBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, height: 42, maxWidth: 420 },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface },
  iconAction: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  formRow: { flexDirection: 'row', gap: 12 },
  selLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, marginBottom: 6 },
  selWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  selChip: { paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff' },
  selChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  selText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
