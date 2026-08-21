import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { StatusChip } from '@/src/adminUi';

export default function Complaints() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.complaints();
      setItems(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-complaints" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Complaints</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.empty}>No complaints logged yet.{'\n'}Tap + to log a retailer complaint.</Text>}
          renderItem={({ item }) => (
            <View testID={`complaint-${item.id}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shop}>{item.retailer_name}</Text>
                  <Text style={styles.meta}>{item.complaint_no} • {new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
                </View>
                <StatusChip status={item.status} />
              </View>
              <View style={styles.catRow}>
                <MaterialCommunityIcons name="tag-outline" size={14} color={theme.colors.brand} />
                <Text style={styles.cat}>{item.category}</Text>
                {item.photo_path ? <MaterialCommunityIcons name="paperclip" size={14} color={theme.colors.muted} /> : null}
              </View>
              <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              {item.resolution_note ? (
                <View style={styles.resolution}>
                  <MaterialCommunityIcons name="check-decagram" size={14} color={theme.colors.success} />
                  <Text style={styles.resolutionText}>{item.resolution_note}</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      <Pressable testID="add-complaint-fab" style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={() => router.push('/complaint/new')}>
        <MaterialCommunityIcons name="plus" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  empty: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', padding: 32, lineHeight: 20 },
  card: { padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  shop: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  meta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cat: { fontSize: 12, fontWeight: '600', color: theme.colors.brand },
  desc: { fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 6, lineHeight: 18 },
  resolution: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 8, backgroundColor: '#DCF5E7', borderRadius: 8 },
  resolutionText: { flex: 1, fontSize: 12, color: theme.colors.success, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
