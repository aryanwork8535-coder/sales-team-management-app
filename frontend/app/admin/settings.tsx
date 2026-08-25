import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, Field, PrimaryBtn } from '@/src/adminUi';

function ListEditor({ title, items, onChange, testPrefix }: { title: string; items: string[]; onChange: (v: string[]) => void; testPrefix: string }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) { setInput(''); return; }
    onChange([...items, v]);
    setInput('');
  };
  return (
    <Card title={title}>
      <View style={s.chipWrap}>
        {items.map((it) => (
          <View key={it} style={s.chip}>
            <Text style={s.chipText}>{it}</Text>
            <Pressable testID={`${testPrefix}-remove-${it}`} onPress={() => onChange(items.filter((x) => x !== it))} style={s.chipX}>
              <MaterialCommunityIcons name="close" size={14} color={theme.colors.error} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={s.addRow}>
        <TextInput
          testID={`${testPrefix}-input`}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={add}
          placeholder="Add new..."
          placeholderTextColor={theme.colors.muted}
          style={s.addInput}
        />
        <Pressable testID={`${testPrefix}-add`} style={s.addBtn} onPress={add}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </Pressable>
      </View>
    </Card>
  );
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<any>({ name: '', address: '', gstin: '', phone: '', email: '' });
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [noOrderReasons, setNoOrderReasons] = useState<string[]>([]);
  const [complaintTypes, setComplaintTypes] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const s = await api.settings();
      setCompany({ name: '', address: '', gstin: '', phone: '', email: '', ...(s.company || {}) });
      setProductCategories(s.product_categories || []);
      setNoOrderReasons(s.no_order_reasons || []);
      setComplaintTypes(s.complaint_types || []);
      setExpenseCategories(s.expense_categories || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const save = async () => {
    if (productCategories.length === 0 || noOrderReasons.length === 0 || complaintTypes.length === 0 || expenseCategories.length === 0) {
      notify('Validation', 'Each list must have at least one entry');
      return;
    }
    setBusy(true);
    try {
      await api.adminUpdateSettings({
        company,
        product_categories: productCategories,
        no_order_reasons: noOrderReasons,
        complaint_types: complaintTypes,
        expense_categories: expenseCategories,
      });
      notify('Success', 'Settings saved — mobile app picks these up immediately');
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const setC = (k: string) => (v: string) => setCompany((c: any) => ({ ...c, [k]: v }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
      <View style={s.headRow}>
        <View>
          <Text style={s.pageTitle}>Settings</Text>
          <Text style={s.pageSub}>Company details & master lists used across the app</Text>
        </View>
        <PrimaryBtn testID="save-settings-btn" label="Save All Settings" busy={busy} onPress={save} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <>
          <Card title="Company Details">
            <View style={s.formRow}>
              <View style={{ flex: 1 }}><Field testID="company-name" label="Company Name" value={company.name} onChangeText={setC('name')} placeholder="FieldForce Pro" /></View>
              <View style={{ flex: 1 }}><Field testID="company-gstin" label="GSTIN" value={company.gstin} onChangeText={setC('gstin')} placeholder="27ABCDE1234F1Z5" /></View>
            </View>
            <Field testID="company-address" label="Address" value={company.address} onChangeText={setC('address')} placeholder="Registered office address" />
            <View style={s.formRow}>
              <View style={{ flex: 1 }}><Field testID="company-phone" label="Phone" value={company.phone} onChangeText={setC('phone')} placeholder="0231-2345678" /></View>
              <View style={{ flex: 1 }}><Field testID="company-email" label="Email" value={company.email} onChangeText={setC('email')} placeholder="info@company.com" /></View>
            </View>
          </Card>

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <ListEditor title="Product Categories" items={productCategories} onChange={setProductCategories} testPrefix="pcat" />
              <ListEditor title="No-Order Reasons" items={noOrderReasons} onChange={setNoOrderReasons} testPrefix="noreason" />
            </View>
            <View style={{ flex: 1 }}>
              <ListEditor title="Complaint Types" items={complaintTypes} onChange={setComplaintTypes} testPrefix="ctype" />
              <ListEditor title="Expense Categories" items={expenseCategories} onChange={setExpenseCategories} testPrefix="ecat" />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  formRow: { flexDirection: 'row', gap: 12 },
  twoCol: { flexDirection: 'row', gap: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 6, height: 32, borderRadius: 999, backgroundColor: theme.colors.brandTertiary, borderWidth: 1, borderColor: theme.colors.border },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  chipX: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, height: 40, fontSize: 13, color: theme.colors.onSurface, backgroundColor: '#fff' },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
});
