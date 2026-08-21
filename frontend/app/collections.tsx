import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';

const MODE_ICONS: Record<string, any> = {
  Cash: 'cash', UPI: 'qrcode-scan', 'Bank Transfer': 'bank', Cheque: 'checkbook', Other: 'currency-inr',
};

export default function Collections() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.collections();
      setItems(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = items.reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-collections" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Collections</Text>
          <Text style={styles.subtitle}>{items.length} receipts • {fmtINR(total)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>No collections recorded yet</Text>}
          renderItem={({ item }) => (
            <View testID={`collection-${item.id}`} style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={MODE_ICONS[item.mode] || 'currency-inr'} size={22} color={theme.colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shop} numberOfLines={1}>{item.retailer_name}</Text>
                <Text style={styles.meta}>{item.mode}{item.reference_no ? ` • ${item.reference_no}` : ''}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.amount}>{fmtINR(item.amount)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  empty: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', padding: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#DCF5E7', alignItems: 'center', justifyContent: 'center' },
  shop: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  meta: { fontSize: 11, color: theme.colors.brand, fontWeight: '600', marginTop: 2 },
  date: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: theme.colors.success },
});
