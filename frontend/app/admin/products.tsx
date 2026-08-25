import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, AdminModal, Field, SelectChips, PrimaryBtn, GhostBtn } from '@/src/adminUi';
import { AuthImage } from '@/src/AuthImage';
import { pickFromGallery } from '@/src/photoPicker';
import { uploadImage } from '@/src/upload';

const EMPTY_FORM = { brand: '', name: '', category: '', pack_size: '', sku_code: '', mrp: '', distributor_rate: '', retailer_rate: '', salesperson_rate: '', gst: '18' };

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [image, setImage] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, b, s] = await Promise.all([api.adminProducts(), api.adminBrands(), api.settings()]);
      setProducts(d || []);
      setBrands((b || []).filter((x: any) => x.active).map((x: any) => x.name));
      setCategories(s?.product_categories || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, brand: brands[0] || '', category: categories[0] || '' });
    setImage(null);
    setImageUri(null);
    setModal(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      brand: p.brand, name: p.name, category: p.category || '', pack_size: p.pack_size || '',
      sku_code: p.sku_code || '', mrp: String(p.mrp), distributor_rate: String(p.distributor_rate),
      retailer_rate: String(p.retailer_rate), salesperson_rate: String(p.salesperson_rate),
      gst: String(p.gst ?? 18),
    });
    setImage(p.image || null);
    setImageUri(null);
    setModal(true);
  };

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const save = async () => {
    if (!form.brand.trim() || !form.name.trim() || !form.sku_code.trim() || !form.mrp) {
      notify('Missing fields', 'Brand, Name, SKU code and MRP are required');
      return;
    }
    setBusy(true);
    try {
      let imagePath = image;
      if (imageUri) imagePath = await uploadImage(imageUri);
      const payload = {
        brand: form.brand.trim().toUpperCase(),
        name: form.name.trim(),
        category: form.category.trim(),
        pack_size: form.pack_size.trim(),
        sku_code: form.sku_code.trim().toUpperCase(),
        mrp: parseFloat(form.mrp) || 0,
        distributor_rate: parseFloat(form.distributor_rate) || 0,
        retailer_rate: parseFloat(form.retailer_rate) || 0,
        salesperson_rate: parseFloat(form.salesperson_rate) || 0,
        gst: parseFloat(form.gst) || 0,
        image: imagePath,
      };
      if (editing) await api.adminUpdateProduct(editing.id, payload);
      else await api.adminCreateProduct(payload);
      setModal(false);
      notify('Success', editing ? 'Product updated' : 'Product created');
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: any) => {
    try {
      await api.adminUpdateProduct(p.id, { active: !p.active });
      load();
    } catch (e: any) {
      notify('Error', e.message);
    }
  };

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.pageTitle}>Products</Text>
          <Text style={styles.pageSub}>{products.length} products across brands</Text>
        </View>
        <PrimaryBtn testID="add-product-btn" label="+ Add Product" onPress={openAdd} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={1.2}>Brand</Th>
            <Th flex={2}>Product</Th>
            <Th>Pack</Th>
            <Th flex={1.2}>SKU</Th>
            <Th>MRP</Th>
            <Th>Retailer ₹</Th>
            <Th>SP ₹</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </TRow>
          {products.map((p) => (
            <TRow key={p.id}>
              <Td flex={1.2} bold>{p.brand}</Td>
              <Td flex={2}>{p.name}</Td>
              <Td>{p.pack_size}</Td>
              <Td flex={1.2}>{p.sku_code}</Td>
              <Td>{fmtINR(p.mrp)}</Td>
              <Td>{fmtINR(p.retailer_rate)}</Td>
              <Td>{fmtINR(p.salesperson_rate)}</Td>
              <View style={{ flex: 1 }}><StatusChip status={p.active ? 'Active' : 'Inactive'} /></View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <Pressable testID={`edit-product-${p.id}`} style={styles.iconAction} onPress={() => openEdit(p)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
                <Pressable testID={`toggle-product-${p.id}`} style={styles.iconAction} onPress={() => toggleActive(p)}>
                  <MaterialCommunityIcons name={p.active ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.colors.warning} />
                </Pressable>
              </View>
            </TRow>
          ))}
        </Card>
      )}

      <AdminModal visible={modal} title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setModal(false)}>
        <SelectChips label="Brand *" options={brands} value={form.brand} onChange={set('brand')} />
        <SelectChips label="Category" options={categories} value={form.category} onChange={set('category')} />
        <Field testID="product-name" label="Product Name *" value={form.name} onChangeText={set('name')} placeholder="DHAMAL Detergent Powder" />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="product-pack" label="Pack Size" value={form.pack_size} onChangeText={set('pack_size')} placeholder="1kg" /></View>
          <View style={{ flex: 1 }}><Field testID="product-sku" label="SKU Code *" value={form.sku_code} onChangeText={set('sku_code')} placeholder="DHM-DP-1K" /></View>
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="product-mrp" label="MRP (₹) *" value={form.mrp} onChangeText={set('mrp')} keyboardType="numeric" placeholder="105" /></View>
          <View style={{ flex: 1 }}><Field testID="product-gst" label="GST %" value={form.gst} onChangeText={set('gst')} keyboardType="numeric" placeholder="18" /></View>
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="product-dist-rate" label="Distributor Rate" value={form.distributor_rate} onChangeText={set('distributor_rate')} keyboardType="numeric" placeholder="80" /></View>
          <View style={{ flex: 1 }}><Field testID="product-retailer-rate" label="Retailer Rate" value={form.retailer_rate} onChangeText={set('retailer_rate')} keyboardType="numeric" placeholder="88" /></View>
          <View style={{ flex: 1 }}><Field testID="product-sp-rate" label="Salesperson Rate" value={form.salesperson_rate} onChangeText={set('salesperson_rate')} keyboardType="numeric" placeholder="92" /></View>
        </View>
        <Text style={styles.imgLabel}>Product Image</Text>
        <View style={styles.imgRow}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.imgPreview} /> : image ? <AuthImage path={image} style={styles.imgPreview} /> : (
            <View style={[styles.imgPreview, styles.imgPh]}>
              <MaterialCommunityIcons name="image-outline" size={22} color={theme.colors.muted} />
            </View>
          )}
          <GhostBtn testID="pick-product-image" small label="Choose Image" onPress={async () => { const u = await pickFromGallery(); if (u) setImageUri(u); }} />
          {(image || imageUri) ? <GhostBtn small label="Remove" onPress={() => { setImage(null); setImageUri(null); }} /> : null}
        </View>
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setModal(false)} />
          <PrimaryBtn testID="save-product-btn" label={editing ? 'Save Changes' : 'Create Product'} busy={busy} onPress={save} />
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
  formRow: { flexDirection: 'row', gap: 12 },
  imgLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, marginBottom: 8 },
  imgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  imgPreview: { width: 56, height: 56, borderRadius: 10 },
  imgPh: { backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
