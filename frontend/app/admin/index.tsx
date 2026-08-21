import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { Kpi, Card, TRow, Th, Td, FilterChips, StatusChip } from '@/src/adminUi';

const RANGES: Record<string, string> = { Today: 'today', '7 Days': '7d', '30 Days': '30d', 'All Time': 'all' };

export default function AdminDashboard() {
  const [rangeLabel, setRangeLabel] = useState('30 Days');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (label: string) => {
    setLoading(true);
    try {
      const d = await api.adminOverview(RANGES[label]);
      setData(d);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(rangeLabel); }, [rangeLabel, load]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.pageTitle}>Dashboard</Text>
          <Text style={styles.pageSub}>Sales performance overview</Text>
        </View>
      </View>

      <FilterChips options={Object.keys(RANGES)} value={rangeLabel} onChange={setRangeLabel} />

      {loading || !data ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <Kpi label="Total Sales" value={fmtINR(data.total_sales)} icon="currency-inr" color={theme.colors.brand} />
            <Kpi label="Orders" value={String(data.total_orders)} icon="clipboard-list-outline" color={theme.colors.info} />
            <Kpi label="Collections" value={fmtINR(data.total_collection)} icon="hand-coin-outline" color={theme.colors.success} />
            <Kpi label="Visits" value={String(data.total_visits)} icon="map-marker-path" color={theme.colors.warning} />
            <Kpi label="Outstanding" value={fmtINR(data.total_outstanding)} icon="alert-decagram-outline" color={theme.colors.error} />
            <Kpi label="Active Retailers" value={String(data.active_retailers)} icon="store-outline" color={theme.colors.brand} />
            <Kpi label="Pending Expenses" value={String(data.pending_expenses)} icon="wallet-outline" color={theme.colors.warning} />
            <Kpi label="Open Complaints" value={String(data.open_complaints)} icon="alert-circle-outline" color={theme.colors.error} />
          </View>

          <Card title="Salesperson Performance">
            <TRow header>
              <Th flex={2}>Salesperson</Th>
              <Th flex={1.2}>Territory</Th>
              <Th>Sales</Th>
              <Th>Orders</Th>
              <Th>Visits</Th>
              <Th>Collection</Th>
            </TRow>
            {data.salesperson_summary.map((s: any) => (
              <TRow key={s.id}>
                <Td flex={2} bold>{s.name} ({s.employee_id})</Td>
                <Td flex={1.2}>{s.territory}</Td>
                <Td bold>{fmtINR(s.sales)}</Td>
                <Td>{s.orders}</Td>
                <Td>{s.visits}</Td>
                <Td>{fmtINR(s.collection)}</Td>
              </TRow>
            ))}
          </Card>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Card title="Brand-wise Sales">
                {data.brand_summary.length === 0 ? (
                  <Text style={styles.empty}>No sales in this period</Text>
                ) : (
                  <>
                    <TRow header>
                      <Th flex={2}>Brand</Th>
                      <Th>Qty</Th>
                      <Th>Value</Th>
                    </TRow>
                    {data.brand_summary.map((b: any) => (
                      <TRow key={b.brand}>
                        <Td flex={2} bold>{b.brand}</Td>
                        <Td>{b.qty}</Td>
                        <Td bold>{fmtINR(b.value)}</Td>
                      </TRow>
                    ))}
                  </>
                )}
              </Card>
            </View>
            <View style={{ flex: 1.4 }}>
              <Card title="Recent Orders">
                {data.recent_orders.length === 0 ? (
                  <Text style={styles.empty}>No orders in this period</Text>
                ) : (
                  <>
                    <TRow header>
                      <Th flex={1.4}>Order</Th>
                      <Th flex={1.6}>Retailer</Th>
                      <Th>Value</Th>
                      <Th>Status</Th>
                    </TRow>
                    {data.recent_orders.map((o: any) => (
                      <TRow key={o.id}>
                        <Td flex={1.4}>{o.order_no}</Td>
                        <Td flex={1.6}>{o.retailer_name}</Td>
                        <Td bold>{fmtINR(o.net_value)}</Td>
                        <View style={{ flex: 1 }}><StatusChip status={o.status} /></View>
                      </TRow>
                    ))}
                  </>
                )}
              </Card>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  twoCol: { flexDirection: 'row', gap: 16 },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
});
