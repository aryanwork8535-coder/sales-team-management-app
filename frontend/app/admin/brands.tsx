import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, AdminModal, Field, PrimaryBtn, GhostBtn } from '@/src/adminUi';
import { AuthImage } from '@/src/AuthImage';
import { pickFromGallery } from '@/src/photoPicker';
import { uploadImage } from '@/src/upload';

export default function AdminBrands() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.adminBrands();
      setBrands(d || []);
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

  const openAdd = () => { setEditing(null); setName(''); setLogo(null); setLogoUri(null); setModal(true); };
  const openEdit = (b: any) => { setEditing(b); setName(b.name); setLogo(b.logo || null); setLogoUri(null); setModal(true); };

  const save = async () => {
    if (!name.trim()) { notify('Missing field', 'Brand name is required'); return; }
    setBusy(true);
    try {
      let logoPath = logo;
      if (logoUri) logoPath = await uploadImage(logoUri);
      if (editing) await api.adminUpdateBrand(editing.id, { name: name.trim(), logo: logoPath });
      else await api.adminCreateBrand({ name: name.trim(), logo: logoPath });
      setModal(false);
      notify('Success', editing ? 'Brand updated' : 'Brand created');
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = (b: any) => {
    confirmThen(`${b.active ? 'Deactivate' : 'Activate'} brand ${b.name}?`, async () => {
      try {
        await api.adminUpdateBrand(b.id, { active: !b.active });
        notify('Success', `${b.name} ${b.active ? 'deactivated' : 'activated'}`);
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
          <Text style={styles.pageTitle}>Brands</Text>
          <Text style={styles.pageSub}>{brands.length} brands • master data</Text>
        </View>
        <PrimaryBtn testID="add-brand-btn" label="+ Add Brand" onPress={openAdd} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={0.6}>Logo</Th>
            <Th flex={2}>Brand Name</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </TRow>
          {brands.map((b) => (
            <TRow key={b.id}>
              <View style={{ flex: 0.6 }}>
                {b.logo ? <AuthImage path={b.logo} style={styles.logo} /> : (
                  <View style={[styles.logo, styles.logoPh]}>
                    <Text style={styles.logoLetter}>{b.name?.[0] || '?'}</Text>
                  </View>
                )}
              </View>
              <Td flex={2} bold>{b.name}</Td>
              <View style={{ flex: 1 }}><StatusChip status={b.active ? 'Active' : 'Inactive'} /></View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <Pressable testID={`edit-brand-${b.name}`} style={styles.iconAction} onPress={() => openEdit(b)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
                <Pressable testID={`toggle-brand-${b.name}`} style={styles.iconAction} onPress={() => toggleActive(b)}>
                  <MaterialCommunityIcons name={b.active ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.colors.warning} />
                </Pressable>
              </View>
            </TRow>
          ))}
          {brands.length === 0 ? <Text style={styles.empty}>No brands yet</Text> : null}
        </Card>
      )}

      <AdminModal visible={modal} title={editing ? `Edit ${editing.name}` : 'Add Brand'} onClose={() => setModal(false)}>
        <Field testID="brand-name" label="Brand Name *" value={name} onChangeText={setName} placeholder="DHAMAL" />
        <Text style={styles.fieldLabel}>Logo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {logoUri ? <Image source={{ uri: logoUri }} style={styles.logoPreview} /> : logo ? <AuthImage path={logo} style={styles.logoPreview} /> : (
            <View style={[styles.logoPreview, styles.logoPh]}>
              <MaterialCommunityIcons name="image-outline" size={22} color={theme.colors.muted} />
            </View>
          )}
          <GhostBtn testID="pick-logo-btn" small label="Choose Logo" onPress={async () => { const u = await pickFromGallery(); if (u) setLogoUri(u); }} />
          {(logo || logoUri) ? <GhostBtn small label="Remove" onPress={() => { setLogo(null); setLogoUri(null); }} /> : null}
        </View>
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setModal(false)} />
          <PrimaryBtn testID="save-brand-btn" label={editing ? 'Save Changes' : 'Create Brand'} busy={busy} onPress={save} />
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
  logo: { width: 36, height: 36, borderRadius: 8 },
  logoPh: { backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 15, fontWeight: '800', color: theme.colors.brand },
  logoPreview: { width: 56, height: 56, borderRadius: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, marginBottom: 8 },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
