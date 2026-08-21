import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';

export default function Retailers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (query?: string) => {
    try {
      const d = await api.retailers(query);
      setList(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSearch = (text: string) => {
    setQ(text);
    load(text);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Retailers</Text>
          <Pressable testID="add-retailer-btn" style={styles.addBtn} onPress={() => router.push('/retailer/add')}>
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.muted} />
          <TextInput
            testID="retailer-search-input"
            value={q}
            onChangeText={onSearch}
            placeholder="Search retailer, mobile or owner"
            placeholderTextColor={theme.colors.muted}
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(q); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No retailers found</Text>}
          renderItem={({ item }) => (
            <Pressable
              testID={`retailer-row-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/retailer/${item.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.classification || 'C'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shop} numberOfLines={1}>{item.shop_name}</Text>
                <Text style={styles.owner} numberOfLines={1}>{item.owner_name} • {item.retailer_type}</Text>
                <View style={styles.rowLine}>
                  <MaterialCommunityIcons name="phone-outline" size={12} color={theme.colors.muted} />
                  <Text style={styles.small}>{item.mobile}</Text>
                  <MaterialCommunityIcons name="map-marker-outline" size={12} color={theme.colors.muted} style={{ marginLeft: 8 }} />
                  <Text style={styles.small} numberOfLines={1}>{item.area}</Text>
                </View>
              </View>
              {item.outstanding > 0 && (
                <View style={styles.outBox}>
                  <Text style={styles.outLabel}>Due</Text>
                  <Text style={styles.outValue}>{fmtINR(item.outstanding)}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.onSurface },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 12, borderRadius: 12, marginTop: 14, minHeight: 48, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.onSurface, height: 48 },
  card: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.brand, fontWeight: '800', fontSize: 16 },
  shop: { fontSize: 15, fontWeight: '600', color: theme.colors.onSurface },
  owner: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  rowLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  small: { fontSize: 11, color: theme.colors.muted },
  outBox: { alignItems: 'flex-end' },
  outLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  outValue: { fontSize: 13, fontWeight: '700', color: theme.colors.warning, marginTop: 2 },
  empty: { textAlign: 'center', color: theme.colors.muted, marginTop: 40 },
});
