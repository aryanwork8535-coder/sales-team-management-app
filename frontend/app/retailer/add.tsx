import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

const RETAILER_TYPES = ['Kirana', 'General Store', 'Supermarket', 'Cleaning Material Store', 'Hardware', 'Other'];
const POTENTIALS = ['High', 'Medium', 'Low'];

export default function AddRetailer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [form, setForm] = useState<any>({
    shop_name: '', owner_name: '', mobile: '', address: '', area: '', city: '',
    retailer_type: 'Kirana', potential: 'Medium',
    latitude: null, longitude: null, remarks: '',
  });
  const [busy, setBusy] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('Pending');

  useEffect(() => { fetchGPS(); }, []);

  const fetchGPS = async () => {
    setGpsStatus('Fetching...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('Permission denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm((f: any) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      setGpsStatus('Captured');
    } catch {
      setGpsStatus('Unavailable');
    }
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.shop_name.trim() || !form.owner_name.trim() || !form.mobile.trim() || !form.address.trim()) {
      Alert.alert('Missing Info', 'Shop name, owner, mobile and address are required');
      return;
    }
    if (form.mobile.length < 10) {
      Alert.alert('Invalid Mobile', 'Enter a valid 10-digit mobile');
      return;
    }
    setBusy(true);
    try {
      const created = await api.createRetailer(form);
      Alert.alert('Success', `Retailer created (${created.retailer_code})`, [
        { text: 'OK', onPress: () => router.replace(`/retailer/${created.id}`) },
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
        <Pressable testID="back-add-retailer" onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Add Retailer</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="Shop Name *" testID="input-shop-name" value={form.shop_name} onChange={(v) => set('shop_name', v)} />
        <Field label="Owner Name *" testID="input-owner" value={form.owner_name} onChange={(v) => set('owner_name', v)} />
        <Field label="Mobile *" testID="input-mobile" value={form.mobile} onChange={(v) => set('mobile', v)} keyboardType="phone-pad" maxLength={10} />
        <Field label="Address *" testID="input-address" value={form.address} onChange={(v) => set('address', v)} multiline />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Area" testID="input-area" value={form.area} onChange={(v) => set('area', v)} /></View>
          <View style={{ flex: 1 }}><Field label="City" testID="input-city" value={form.city} onChange={(v) => set('city', v)} /></View>
        </View>

        <Text style={styles.label}>Retailer Type</Text>
        <View style={styles.chips}>
          {RETAILER_TYPES.map(t => (
            <Pressable
              key={t}
              testID={`type-${t}`}
              style={[styles.chip, form.retailer_type === t && styles.chipActive]}
              onPress={() => set('retailer_type', t)}
            >
              <Text style={[styles.chipText, form.retailer_type === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Potential</Text>
        <View style={styles.chips}>
          {POTENTIALS.map(p => (
            <Pressable
              key={p}
              testID={`potential-${p}`}
              style={[styles.chip, form.potential === p && styles.chipActive]}
              onPress={() => set('potential', p)}
            >
              <Text style={[styles.chipText, form.potential === p && styles.chipTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.gpsBox}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={theme.colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsLabel}>GPS Location</Text>
            <Text style={styles.gpsValue}>
              {form.latitude ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : gpsStatus}
            </Text>
          </View>
          <Pressable testID="gps-refresh" onPress={fetchGPS} style={styles.gpsBtn}>
            <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.brand} />
          </Pressable>
        </View>

        <Field label="Remarks (Optional)" testID="input-remarks" value={form.remarks} onChange={(v) => set('remarks', v)} multiline />

        <Pressable testID="submit-retailer" style={styles.submit} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>ADD RETAILER</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, testID, multiline, keyboardType, maxLength }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholderTextColor={theme.colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.muted, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, minHeight: 52, fontSize: 15, color: theme.colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary, flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  gpsBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: theme.colors.brandTertiary, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  gpsLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  gpsValue: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600', marginTop: 2 },
  gpsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  submit: { backgroundColor: theme.colors.brand, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
});
