import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip } from '@/src/adminUi';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.orders();
      setOrders(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = orders.reduce((s, o) => s + (o.net_value || 0), 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Orders</Text>
      <Text style={styles.pageSub}>{orders.length} orders • {fmtINR(total)}</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th flex={1.3}>Order No</Th>
            <Th flex={1.1}>Date</Th>
            <Th flex={1.8}>Retailer</Th>
            <Th flex={1.4}>Salesperson</Th>
            <Th flex={0.7}>Items</Th>
            <Th>Value</Th>
            <Th>Status</Th>
          </TRow>
          {orders.map((o) => (
            <TRow key={o.id}>
              <Td flex={1.3} bold>{o.order_no}</Td>
              <Td flex={1.1}>{new Date(o.created_at).toLocaleDateString('en-IN')}</Td>
              <Td flex={1.8}>{o.retailer_name}</Td>
              <Td flex={1.4}>{o.salesperson_name}</Td>
              <Td flex={0.7}>{o.items?.length || 0}</Td>
              <Td bold>{fmtINR(o.net_value)}</Td>
              <View style={{ flex: 1 }}><StatusChip status={o.status} /></View>
            </TRow>
          ))}
          {orders.length === 0 ? <Text style={styles.empty}>No orders yet</Text> : null}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, marginBottom: 16 },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
});
