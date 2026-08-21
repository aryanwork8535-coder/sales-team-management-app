import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.orders();
      setList(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>{list.length} total orders</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={48} color={theme.colors.muted} />
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySub}>Start booking orders from retailer profiles</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`order-row-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/retailer/${item.retailer_id}`)}
            >
              <View style={styles.icon}><MaterialCommunityIcons name="receipt-text-outline" size={22} color={theme.colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNo}>{item.order_no}</Text>
                <Text style={styles.retailerName} numberOfLines={1}>{item.retailer_name}</Text>
                <Text style={styles.itemsLine}>{item.items.length} items • {new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>{fmtINR(item.net_value)}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.onSurface },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  card: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  orderNo: { fontSize: 13, fontWeight: '700', color: theme.colors.brand },
  retailerName: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurface, marginTop: 2 },
  itemsLine: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  statusPill: { marginTop: 4, backgroundColor: '#DCF5E7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10, color: theme.colors.success, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: theme.colors.onSurface, marginTop: 12, fontWeight: '600' },
  emptySub: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
});
