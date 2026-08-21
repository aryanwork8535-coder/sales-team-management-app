import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

export default function Beat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retailers: any[] = data?.beat?.retailers || [];
  const pending = retailers.filter(r => r.status === 'Pending').length;
  const visited = retailers.filter(r => r.status === 'Visited').length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Today's Beat</Text>
        <Text style={styles.subtitle}>{data?.beat?.day} • {data?.beat?.territory || 'No territory'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{retailers.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.success }]}>{visited}</Text>
            <Text style={styles.statLabel}>Visited</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.warning }]}>{pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={retailers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={theme.colors.muted} />
              <Text style={styles.emptyText}>No retailers assigned today.</Text>
              <Text style={styles.emptyTextSub}>Enjoy your rest!</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Pressable
              testID={`beat-item-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/retailer/${item.id}`)}
            >
              <View style={styles.seqBox}>
                <Text style={styles.seqText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{item.shop_name}</Text>
                <View style={styles.addrRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: item.status === 'Visited' ? '#DCF5E7' : '#FDECD3' }]}>
                <Text style={[styles.badgeText, { color: item.status === 'Visited' ? theme.colors.success : theme.colors.warning }]}>{item.status}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.onSurface },
  subtitle: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statBox: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: theme.colors.brand },
  statLabel: { fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 2, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  seqBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  seqText: { color: '#fff', fontWeight: '700' },
  shopName: { fontSize: 15, fontWeight: '600', color: theme.colors.onSurface },
  addrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 },
  addr: { fontSize: 12, color: theme.colors.muted, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: theme.colors.onSurface, marginTop: 12, fontWeight: '600' },
  emptyTextSub: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
});
