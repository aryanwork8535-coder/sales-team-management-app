import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname, Redirect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/AuthContext';
import { theme } from '@/src/theme';

const NAV = [
  { label: 'Dashboard', icon: 'view-dashboard-outline' as const, route: '/admin' },
  { label: 'Orders', icon: 'clipboard-list-outline' as const, route: '/admin/orders' },
  { label: 'Products', icon: 'package-variant-closed' as const, route: '/admin/products' },
  { label: 'Users', icon: 'account-group-outline' as const, route: '/admin/users' },
  { label: 'Expenses', icon: 'wallet-outline' as const, route: '/admin/expenses' },
  { label: 'Complaints', icon: 'alert-circle-outline' as const, route: '/admin/complaints' },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/" />;
  if (user.role !== 'super_admin' && user.role !== 'sales_manager') return <Redirect href="/(tabs)/home" />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="shield-star" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.brandName}>FieldForce Pro</Text>
            <Text style={styles.brandSub}>Admin Panel</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
          {NAV.map((n) => {
            const active = pathname === n.route;
            return (
              <Pressable
                key={n.route}
                testID={`nav-${n.label.toLowerCase()}`}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(n.route as any)}
              >
                <MaterialCommunityIcons name={n.icon} size={20} color={active ? '#fff' : 'rgba(255,255,255,0.65)'} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{n.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.userBox}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={20} color={theme.colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            <Text style={styles.userRole}>{user.role.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <Pressable testID="admin-logout" onPress={logout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={18} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.surface },
  sidebar: { width: 232, backgroundColor: '#0B3D2B', paddingTop: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  logoBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, marginHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
  navLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  navLabelActive: { color: '#fff' },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 12, fontWeight: '700', color: '#fff' },
  userRole: { fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, marginTop: 1 },
  logoutBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
});
