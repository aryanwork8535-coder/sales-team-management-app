import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { takePhoto, pickFromGallery } from '@/src/photoPicker';
import { uploadImage } from '@/src/upload';

const CATEGORIES = ['Damaged Product', 'Scheme Not Received', 'Billing Issue', 'Delivery Delay', 'Quality Issue', 'Other'];

export default function NewComplaint() {
  const { retailer_id } = useLocalSearchParams<{ retailer_id?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [retailers, setRetailers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.retailers();
        setRetailers(list || []);
        if (retailer_id) {
          const r = (list || []).find((x: any) => x.id === retailer_id);
          if (r) setSelected(r);
        }
      } catch {}
    })();
  }, [retailer_id]);

  const filtered = search
    ? retailers.filter((r) => r.shop_name.toLowerCase().includes(search.toLowerCase()))
    : retailers.slice(0, 8);

  const submit = async () => {
    if (!selected) { Alert.alert('Select retailer', 'Choose the retailer this complaint is about'); return; }
    if (description.trim().length < 5) { Alert.alert('Description needed', 'Describe the complaint briefly'); return; }
    setBusy(true);
    try {
      let photo_path: string | null = null;
      if (photoUri) photo_path = await uploadImage(photoUri);
      await api.createComplaint({ retailer_id: selected.id, category, description: description.trim(), photo_path });
      Alert.alert('Complaint Logged', 'Sent to admin for resolution', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-new-complaint" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Log Complaint</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Retailer</Text>
        {selected ? (
          <View style={styles.selectedRow}>
            <MaterialCommunityIcons name="store" size={20} color={theme.colors.brand} />
            <Text style={styles.selectedName}>{selected.shop_name}</Text>
            <Pressable testID="change-retailer" onPress={() => setSelected(null)}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              testID="retailer-search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Search retailer..."
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
            />
            {filtered.map((r) => (
              <Pressable key={r.id} testID={`pick-retailer-${r.id}`} style={styles.pickRow} onPress={() => setSelected(r)}>
                <MaterialCommunityIcons name="store-outline" size={18} color={theme.colors.muted} />
                <Text style={styles.pickName} numberOfLines={1}>{r.shop_name}</Text>
                <Text style={styles.pickArea}>{r.area}</Text>
              </Pressable>
            ))}
          </>
        )}

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`complaint-cat-${c}`} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          testID="complaint-description-input"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue..."
          placeholderTextColor={theme.colors.muted}
          multiline
          style={styles.descInput}
        />

        <Text style={styles.label}>Photo (optional)</Text>
        {photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            <Pressable testID="remove-photo" style={styles.removePhoto} onPress={() => setPhotoUri(null)}>
              <MaterialCommunityIcons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoBtns}>
            <Pressable testID="camera-btn" style={styles.photoBtn} onPress={async () => { const u = await takePhoto(); if (u) setPhotoUri(u); }}>
              <MaterialCommunityIcons name="camera-outline" size={22} color={theme.colors.brand} />
              <Text style={styles.photoBtnText}>Camera</Text>
            </Pressable>
            <Pressable testID="gallery-btn" style={styles.photoBtn} onPress={async () => { const u = await pickFromGallery(); if (u) setPhotoUri(u); }}>
              <MaterialCommunityIcons name="image-outline" size={22} color={theme.colors.brand} />
              <Text style={styles.photoBtnText}>Gallery</Text>
            </Pressable>
          </View>
        )}

        <Pressable testID="submit-complaint-btn" style={styles.submitBtn} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>SUBMIT COMPLAINT</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.muted, marginTop: 18, marginBottom: 8 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: theme.colors.brandTertiary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  selectedName: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  changeText: { fontSize: 13, fontWeight: '600', color: theme.colors.brand },
  searchInput: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 14, color: theme.colors.onSurface, marginBottom: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6, minHeight: 48 },
  pickName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  pickArea: { fontSize: 11, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  chipTextActive: { color: '#fff' },
  descInput: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, minHeight: 100, fontSize: 14, color: theme.colors.onSurface, textAlignVertical: 'top' },
  photoBtns: { flexDirection: 'row', gap: 10 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: theme.colors.brandTertiary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, minHeight: 52 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.brand },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: theme.colors.brand, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
