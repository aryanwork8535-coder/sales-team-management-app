import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/AuthContext';
import { theme } from '@/src/theme';

const items = [
  { key: 'collections', label: 'Collections', icon: 'hand-coin-outline' as const, route: '/collections' },
  { key: 'complaints', label: 'Complaints', icon: 'alert-circle-outline' as const, route: '/complaints' },
  { key: 'expenses', label: 'Expenses', icon: 'wallet-outline' as const, route: '/expenses' },
  { key: 'attendance', label: 'Attendance', icon: 'calendar-check-outline' as const, route: '/attendance' },
  { key: 'performance', label: 'Performance', icon: 'chart-bar' as const, route: null },
];

export default function More() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-circle" size={48} color={theme.colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.role}>{user?.role?.replace('_', ' ').toUpperCase()}</Text>
            <Text style={styles.empId}>ID: {user?.employee_id}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Modules</Text>
        {items.map((it) => (
          <Pressable
            key={it.key}
            testID={`more-${it.key}`}
            style={styles.row}
            onPress={() => (it.route ? router.push(it.route as any) : alert(`${it.label} module coming soon`))}
          >
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name={it.icon} size={22} color={theme.colors.brand} />
            </View>
            <Text style={styles.rowLabel}>{it.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.muted} />
          </Pressable>
        ))}

        <Pressable testID="logout-more" style={[styles.row, { marginTop: 16 }]} onPress={logout}>
          <View style={[styles.rowIcon, { backgroundColor: '#FEE2E2' }]}>
            <MaterialCommunityIcons name="logout" size={22} color={theme.colors.error} />
          </View>
          <Text style={[styles.rowLabel, { color: theme.colors.error }]}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.onSurface },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: theme.colors.brandTertiary, borderRadius: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.onSurface },
  role: { fontSize: 11, fontWeight: '600', color: theme.colors.brand, letterSpacing: 0.5, marginTop: 2 },
  empId: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.muted, letterSpacing: 0.5, marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.onSurface },
});
