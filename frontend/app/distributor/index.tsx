import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, RefreshControl, Platform } from 'react-native';
import { useFocusEffect, Redirect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { useAuth } from '@/src/AuthContext';
import { theme, fmtINR } from '@/src/theme';
import { StatusChip } from '@/src/adminUi';

export default function DistributorHome() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, logout } = useAuth();
  const [tab, setTab] = useState<'orders' | 'claims'>('orders');
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, o, c] = await Promise.all([api.distributorDashboard(), api.orders(), api.schemeClaims()]);
      setStats(s);
      setOrders(o || []);
      setClaims(c || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (user?.role === 'distributor') load();
  }, [load, user]));

  if (!authLoading && user && user.role !== 'distributor') {
    return <Redirect href={user.role === 'salesperson' ? '/(tabs)/home' : '/admin'} />;
  }
  if (!authLoading && !user) {
    return <Redirect href="/" />;
  }

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const moveOrder = async (o: any) => {
    const next = o.status === 'Submitted' ? 'Dispatched' : 'Delivered';
    setBusyId(o.id);
    try {
      await api.updateOrderStatus(o.id, next);
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const fulfil = async (c: any) => {
    setBusyId(c.id);
    try {
      await api.fulfilClaim(c.id);
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const renderOrder = ({ item }: any) => (
    <View testID={`dist-order-${item.id}`} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.order_no}</Text>
          <Text style={styles.cardMeta}>{item.retailer_name} • {new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
          <Text style={styles.cardMeta}>{item.items?.length || 0} items • by {item.salesperson_name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={styles.amount}>{fmtINR(item.net_value)}</Text>
          <StatusChip status={item.status} />
        </View>
      </View>
      {(item.status === 'Submitted' || item.status === 'Dispatched') && (
        <Pressable
          testID={`move-order-${item.id}`}
          style={[styles.actionBtn, item.status === 'Dispatched' && { backgroundColor: theme.colors.success }]}
          disabled={busyId === item.id}
          onPress={() => moveOrder(item)}
        >
          {busyId === item.id ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <MaterialCommunityIcons name={item.status === 'Submitted' ? 'truck-fast-outline' : 'check-circle-outline'} size={18} color="#fff" />
              <Text style={styles.actionText}>{item.status === 'Submitted' ? 'MARK DISPATCHED' : 'MARK DELIVERED'}</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );

  const renderClaim = ({ item }: any) => (
    <View testID={`claim-${item.id}`} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.giftRow}>
            <MaterialCommunityIcons name="gift-outline" size={16} color={theme.colors.warning} />
            <Text style={styles.giftText}>{item.article}</Text>
          </View>
          <Text style={styles.cardTitle}>{item.retailer_name}</Text>
          <Text style={styles.cardMeta}>{item.scheme_name} • {item.brand} × {item.qty}</Text>
          <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
        </View>
        <StatusChip status={item.status} />
      </View>
      {item.status === 'Pending' && (
        <Pressable testID={`fulfil-claim-${item.id}`} style={[styles.actionBtn, { backgroundColor: theme.colors.success }]} disabled={busyId === item.id} onPress={() => fulfil(item)}>
          {busyId === item.id ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <MaterialCommunityIcons name="gift-open-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>MARK FULFILLED</Text>
            </>
          )}
        </Pressable>
      )}
      {item.fulfilled_by ? <Text style={styles.fulfilledBy}>Fulfilled by {item.fulfilled_by}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <LinearGradient colors={[theme.colors.brand, '#0B4530']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greet}>Distributor</Text>
            <Text testID="dist-name" style={styles.userName}>{user?.name || ''}</Text>
          </View>
          <Pressable testID="dist-logout" onPress={logout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{stats?.pending_orders ?? '—'}</Text>
            <Text style={styles.kpiLabel}>Pending Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{stats?.dispatched_orders ?? '—'}</Text>
            <Text style={styles.kpiLabel}>Dispatched</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{stats?.pending_claims ?? '—'}</Text>
            <Text style={styles.kpiLabel}>Claims Due</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.segment}>
        <Pressable testID="tab-orders" style={[styles.segBtn, tab === 'orders' && styles.segBtnActive]} onPress={() => setTab('orders')}>
          <Text style={[styles.segText, tab === 'orders' && styles.segTextActive]}>Orders ({orders.length})</Text>
        </Pressable>
        <Pressable testID="tab-claims" style={[styles.segBtn, tab === 'claims' && styles.segBtnActive]} onPress={() => setTab('claims')}>
          <Text style={[styles.segText, tab === 'claims' && styles.segTextActive]}>Scheme Claims ({claims.length})</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={tab === 'orders' ? orders : claims}
          keyExtractor={(i) => i.id}
          renderItem={tab === 'orders' ? renderOrder : renderClaim}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>{tab === 'orders' ? 'No orders routed to you yet' : 'No scheme claims yet'}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  kpiBox: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12 },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 2 },
  segment: { flexDirection: 'row', margin: 16, marginBottom: 0, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  segBtnActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 13, fontWeight: '600', color: theme.colors.muted },
  segTextActive: { color: theme.colors.brand, fontWeight: '700' },
  card: { padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  cardMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 10, minHeight: 44, marginTop: 12 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  giftText: { fontSize: 13, fontWeight: '800', color: theme.colors.warning },
  fulfilledBy: { fontSize: 11, color: theme.colors.success, fontWeight: '600', marginTop: 8 },
  empty: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', padding: 32 },
});
