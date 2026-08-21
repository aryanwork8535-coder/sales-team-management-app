import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';
import { StatusChip } from '@/src/adminUi';

const CATEGORY_ICONS: Record<string, any> = {
  Travel: 'bus', Fuel: 'gas-station', Food: 'food', Lodging: 'bed', Other: 'receipt',
};

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.expenses();
      setItems(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-expenses" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Expenses</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.empty}>No expenses submitted yet.{'\n'}Tap + to add your first expense.</Text>}
          renderItem={({ item }) => (
            <View testID={`expense-${item.id}`} style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={CATEGORY_ICONS[item.category] || 'receipt'} size={22} color={theme.colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cat}>{item.category}</Text>
                <Text style={styles.date}>{new Date(item.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                {item.remarks ? <Text style={styles.remarks} numberOfLines={1}>{item.remarks}</Text> : null}
                {item.review_comment ? <Text style={styles.reviewNote} numberOfLines={1}>Note: {item.review_comment}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.amount}>{fmtINR(item.amount)}</Text>
                <StatusChip status={item.status} />
                {item.bill_photo ? <MaterialCommunityIcons name="paperclip" size={14} color={theme.colors.muted} /> : null}
              </View>
            </View>
          )}
        />
      )}

      <Pressable testID="add-expense-fab" style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={() => router.push('/expense/new')}>
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
  row: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  cat: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  date: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  remarks: { fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  reviewNote: { fontSize: 11, color: theme.colors.warning, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
