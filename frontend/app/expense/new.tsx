import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { takePhoto, pickFromGallery } from '@/src/photoPicker';
import { uploadImage } from '@/src/upload';

const DEFAULT_CATEGORIES = ['Travel', 'Fuel', 'Food', 'Lodging', 'Other'];

export default function NewExpense() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings().then((s: any) => {
      if (s?.expense_categories?.length) {
        setCategories(s.expense_categories);
        setCategory((c) => (s.expense_categories.includes(c) ? c : s.expense_categories[0]));
      }
    }).catch(() => {});
  }, []);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid expense amount'); return; }
    setBusy(true);
    try {
      let bill_photo: string | null = null;
      if (photoUri) bill_photo = await uploadImage(photoUri);
      await api.createExpense({ category, amount: amt, remarks, bill_photo });
      Alert.alert('Expense Submitted', 'Sent to your manager for approval', [
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
        <Pressable testID="back-new-expense" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>New Expense</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Pressable key={c} testID={`category-${c}`} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput
          testID="expense-amount-input"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.colors.muted}
          style={styles.amountInput}
        />

        <Text style={styles.label}>Remarks</Text>
        <TextInput
          testID="expense-remarks-input"
          value={remarks}
          onChangeText={setRemarks}
          placeholder="e.g. Bus fare Kolhapur to Kagal"
          placeholderTextColor={theme.colors.muted}
          multiline
          style={styles.remarksInput}
        />

        <Text style={styles.label}>Bill Photo</Text>
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

        <Pressable testID="submit-expense-btn" style={styles.submitBtn} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>SUBMIT EXPENSE</Text>}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, height: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  chipTextActive: { color: '#fff' },
  amountInput: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, height: 60, fontSize: 24, fontWeight: '700', color: theme.colors.onSurface },
  remarksInput: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, minHeight: 80, fontSize: 14, color: theme.colors.onSurface, textAlignVertical: 'top' },
  photoBtns: { flexDirection: 'row', gap: 10 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: theme.colors.brandTertiary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, minHeight: 52 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.brand },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: theme.colors.brand, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
