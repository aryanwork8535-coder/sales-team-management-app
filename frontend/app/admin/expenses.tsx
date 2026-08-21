import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, FilterChips, PrimaryBtn, AdminModal } from '@/src/adminUi';
import { AuthImage } from '@/src/AuthImage';

const FILTERS = ['Pending', 'Approved', 'Rejected', 'All'];

export default function AdminExpenses() {
  const [filter, setFilter] = useState('Pending');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const d = await api.expenses(f === 'All' ? undefined : f);
      setItems(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const review = async (id: string, status: 'Approved' | 'Rejected') => {
    setBusyId(id);
    try {
      await api.reviewExpense(id, { status, comment: '' });
      load(filter);
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const total = items.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Expense Approvals</Text>
      <Text style={styles.pageSub}>{items.length} expenses • {fmtINR(total)}</Text>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={1.4}>Salesperson</Th>
            <Th>Date</Th>
            <Th>Category</Th>
            <Th>Amount</Th>
            <Th flex={1.6}>Remarks</Th>
            <Th>Bill</Th>
            <Th>Status</Th>
            <Th flex={1.4}>Actions</Th>
          </TRow>
          {items.map((e) => (
            <TRow key={e.id}>
              <Td flex={1.4} bold>{e.salesperson_name}</Td>
              <Td>{e.expense_date}</Td>
              <Td>{e.category}</Td>
              <Td bold>{fmtINR(e.amount)}</Td>
              <Td flex={1.6}>{e.remarks || '—'}</Td>
              <View style={{ flex: 1 }}>
                {e.bill_photo ? (
                  <Pressable testID={`view-bill-${e.id}`} onPress={() => setPhotoView(e.bill_photo)}>
                    <AuthImage path={e.bill_photo} style={styles.thumb} />
                  </Pressable>
                ) : (
                  <Text style={styles.noBill}>—</Text>
                )}
              </View>
              <View style={{ flex: 1 }}><StatusChip status={e.status} /></View>
              <View style={{ flex: 1.4, flexDirection: 'row', gap: 6 }}>
                {e.status === 'Pending' ? (
                  <>
                    <PrimaryBtn testID={`approve-${e.id}`} label="Approve" tone="success" small busy={busyId === e.id} onPress={() => review(e.id, 'Approved')} />
                    <PrimaryBtn testID={`reject-${e.id}`} label="Reject" tone="danger" small busy={busyId === e.id} onPress={() => review(e.id, 'Rejected')} />
                  </>
                ) : (
                  <Text style={styles.reviewedBy}>{e.reviewed_by || ''}</Text>
                )}
              </View>
            </TRow>
          ))}
          {items.length === 0 ? <Text style={styles.empty}>No {filter.toLowerCase() === 'all' ? '' : filter.toLowerCase() + ' '}expenses</Text> : null}
        </Card>
      )}

      <AdminModal visible={!!photoView} title="Bill Photo" onClose={() => setPhotoView(null)}>
        {photoView ? <AuthImage path={photoView} style={styles.fullPhoto} /> : null}
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, marginBottom: 16 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  noBill: { fontSize: 13, color: theme.colors.muted },
  reviewedBy: { fontSize: 11, color: theme.colors.muted },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  fullPhoto: { width: '100%', height: 420, borderRadius: 12 },
});
