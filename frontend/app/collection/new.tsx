import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';

const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

export default function NewCollection() {
  const { retailer_id } = useLocalSearchParams<{ retailer_id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [retailer, setRetailer] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [ref, setRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.retailer(retailer_id as string);
        setRetailer(r);
      } finally { setLoading(false); }
    })();
  }, [retailer_id]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount'); return; }
    setBusy(true);
    try {
      await api.createCollection({
        retailer_id: retailer_id as string,
        amount: amt, mode, reference_no: ref, remarks,
      });
      Alert.alert('Payment Recorded', `${fmtINR(amt)} received via ${mode}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-collection" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Collect Payment</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{retailer?.shop_name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.outCard}>
          <Text style={styles.outLabel}>Outstanding Balance</Text>
          <Text testID="outstanding-value" style={styles.outValue}>{fmtINR(retailer?.stats?.outstanding || 0)}</Text>
        </View>

        <Text style={styles.label}>Amount Received (₹)</Text>
        <TextInput
          testID="amount-input"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.colors.muted}
          style={styles.amtInput}
        />

        <Text style={styles.label}>Payment Mode</Text>
        <View style={styles.chips}>
          {MODES.map(m => (
            <Pressable
              key={m}
              testID={`mode-${m}`}
              style={[styles.chip, mode === m && styles.chipActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        {(mode === 'UPI' || mode === 'Bank Transfer' || mode === 'Cheque') && (
          <>
            <Text style={styles.label}>Reference No.</Text>
            <TextInput
              testID="ref-input"
              value={ref}
              onChangeText={setRef}
              placeholder="Transaction / Cheque No."
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </>
        )}

        <Text style={styles.label}>Remarks (Optional)</Text>
        <TextInput
          testID="remarks-input"
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Add notes..."
          placeholderTextColor={theme.colors.muted}
          multiline
          style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
        />

        <Pressable testID="submit-collection" style={styles.submit} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>RECORD PAYMENT</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  outCard: { padding: 20, borderRadius: 16, backgroundColor: theme.colors.brand, alignItems: 'center' },
  outLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  outValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.muted, marginTop: 20, marginBottom: 8 },
  amtInput: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 16, height: 64, fontSize: 24, fontWeight: '700', color: theme.colors.onSurface },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, minHeight: 52, fontSize: 15, color: theme.colors.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary, flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  submit: { backgroundColor: theme.colors.brand, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
});
