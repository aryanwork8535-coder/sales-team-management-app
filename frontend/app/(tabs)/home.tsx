import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { useAuth } from '@/src/AuthContext';
import { theme, fmtINR } from '@/src/theme';

function KpiCard({ label, value, icon, tone }: { label: string; value: string; icon: any; tone: 'brand' | 'success' | 'warning' | 'info' }) {
  const bgMap: any = {
    brand: theme.colors.brandSecondary,
    success: '#DCF5E7',
    warning: '#FDECD3',
    info: '#D1F0F7',
  };
  const fgMap: any = {
    brand: theme.colors.brand,
    success: theme.colors.success,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };
  return (
    <View testID={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`} style={[styles.kpi, { backgroundColor: bgMap[tone] }]}>
      <View style={[styles.kpiIcon, { backgroundColor: fgMap[tone] + '22' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={fgMap[tone]} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: fgMap[tone] }]}>{value}</Text>
    </View>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const greetingHour = new Date().getHours();
  const greet = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const achievementPct = data ? Math.min(100, Math.round((data.today_sales / (data.today_target || 1)) * 100)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <LinearGradient colors={[theme.colors.brand, '#0B4530']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greet}>{greet},</Text>
            <Text testID="home-user-name" style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userRole}>{user?.role?.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <Pressable testID="logout-btn" onPress={logout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={20} color="#fff" />
          </Pressable>
        </View>

        {data && (
          <View style={styles.targetBar}>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>Today's Target</Text>
              <Text style={styles.targetValue}>{fmtINR(data.today_target)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${achievementPct}%` }]} />
            </View>
            <View style={styles.targetRow}>
              <Text style={styles.progressText}>{fmtINR(data.today_sales)} achieved</Text>
              <Text style={styles.progressText}>{achievementPct}%</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Today's Performance</Text>
            <View style={styles.kpiGrid}>
              <KpiCard label="Sales" value={fmtINR(data?.today_sales)} icon="cash-multiple" tone="brand" />
              <KpiCard label="Orders" value={String(data?.today_orders ?? 0)} icon="clipboard-check-outline" tone="success" />
              <KpiCard label="Visits" value={String(data?.today_visits ?? 0)} icon="map-marker-check" tone="info" />
              <KpiCard label="New Retailers" value={String(data?.new_retailers ?? 0)} icon="store-plus-outline" tone="warning" />
              <KpiCard label="Collection" value={fmtINR(data?.today_collection)} icon="hand-coin-outline" tone="success" />
              <KpiCard label="Target Left" value={fmtINR(Math.max(0, (data?.today_target || 0) - (data?.today_sales || 0)))} icon="target" tone="brand" />
            </View>

            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              <Pressable testID="action-new-visit" style={styles.actionBtn} onPress={() => router.push('/(tabs)/beat')}>
                <MaterialCommunityIcons name="map-marker-plus" size={22} color={theme.colors.brand} />
                <Text style={styles.actionText}>New Visit</Text>
              </Pressable>
              <Pressable testID="action-new-order" style={styles.actionBtn} onPress={() => router.push('/(tabs)/retailers')}>
                <MaterialCommunityIcons name="cart-plus" size={22} color={theme.colors.brand} />
                <Text style={styles.actionText}>New Order</Text>
              </Pressable>
              <Pressable testID="action-add-retailer" style={styles.actionBtn} onPress={() => router.push('/retailer/add')}>
                <MaterialCommunityIcons name="store-plus-outline" size={22} color={theme.colors.brand} />
                <Text style={styles.actionText}>Add Retailer</Text>
              </Pressable>
            </View>

            <View style={styles.beatHeader}>
              <Text style={styles.sectionTitle}>Today's Beat</Text>
              <Text style={styles.beatDay}>{data?.beat?.day} • {data?.beat?.territory || '—'}</Text>
            </View>

            {(data?.beat?.retailers || []).length === 0 ? (
              <View style={styles.emptyBeat}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={theme.colors.muted} />
                <Text style={styles.emptyText}>No beat plan for today</Text>
              </View>
            ) : (
              (data.beat.retailers as any[]).map((r) => (
                <Pressable
                  key={r.id}
                  testID={`beat-retailer-${r.id}`}
                  style={styles.beatCard}
                  onPress={() => router.push(`/retailer/${r.id}`)}
                >
                  <View style={styles.beatIcon}>
                    <MaterialCommunityIcons name="storefront-outline" size={22} color={theme.colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.beatShop} numberOfLines={1}>{r.shop_name}</Text>
                    <Text style={styles.beatAddr} numberOfLines={1}>{r.address}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: r.status === 'Visited' ? '#DCF5E7' : '#FDECD3' }]}>
                    <Text style={[styles.badgeText, { color: r.status === 'Visited' ? theme.colors.success : theme.colors.warning }]}>{r.status}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  userName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  userRole: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 4 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  targetBar: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  targetValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginVertical: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginTop: 16, marginBottom: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', padding: 14, borderRadius: 16 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiLabel: { fontSize: 11, color: theme.colors.onSurfaceSecondary, fontWeight: '600' },
  kpiValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: theme.colors.brandTertiary, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border },
  actionText: { color: theme.colors.brand, fontSize: 12, fontWeight: '600' },
  beatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  beatDay: { fontSize: 12, color: theme.colors.muted, marginTop: 16 },
  beatCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  beatIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  beatShop: { fontSize: 15, fontWeight: '600', color: theme.colors.onSurface },
  beatAddr: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  emptyBeat: { padding: 32, alignItems: 'center' },
  emptyText: { color: theme.colors.muted, marginTop: 8 },
});
