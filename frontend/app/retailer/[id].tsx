import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { api, isNetworkError } from '@/src/api';
import { enqueue, localId } from '@/src/offline';
import { theme, fmtINR } from '@/src/theme';

const COVER = 'https://images.pexels.com/photos/19566900/pexels-photo-19566900.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

export default function RetailerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.retailer(id as string);
      setData(d);
      const visits = await api.visits(id as string);
      const open = (visits as any[]).find(v => !v.end_time);
      setActiveVisit(open || null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startVisit = async () => {
    setBusy(true);
    try {
      let lat: number | null = null, lng: number | null = null, acc: number | null = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude; lng = pos.coords.longitude; acc = pos.coords.accuracy;
        } catch {}
      }
      const payload = { retailer_id: id, latitude: lat, longitude: lng, gps_accuracy: acc, client_id: localId(), client_time: new Date().toISOString() };
      try {
        const v = await api.startVisit(payload);
        setActiveVisit(v);
        Alert.alert('Visit Started', lat ? 'GPS verified' : 'GPS unavailable — recorded without location');
      } catch (e: any) {
        if (isNetworkError(e)) {
          await enqueue('/visits/start', payload, `Visit start — ${data?.shop_name}`);
          setActiveVisit({ id: payload.client_id, start_time: payload.client_time, offline: true });
          Alert.alert('Saved Offline', 'No network — visit started on device and will sync automatically.');
        } else {
          Alert.alert('Error', e.message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const completeVisit = async (result: string) => {
    if (!activeVisit) return;
    setBusy(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {}
      let reason: string | undefined;
      if (result === 'NO_ORDER') reason = 'Stock Available';
      const payload = { visit_id: activeVisit.id, latitude: lat, longitude: lng, result, no_order_reason: reason, client_time: new Date().toISOString() };
      try {
        if (activeVisit.offline) {
          // start is still queued — queue the completion too, backend will process in order
          await enqueue('/visits/complete', payload, `Visit complete — ${data?.shop_name}`);
          Alert.alert('Saved Offline', 'Visit completion saved on device and will sync automatically.');
        } else {
          await api.completeVisit(payload);
          Alert.alert('Visit Complete', 'Visit recorded successfully');
        }
        setActiveVisit(null);
        load();
      } catch (e: any) {
        if (isNetworkError(e)) {
          await enqueue('/visits/complete', payload, `Visit complete — ${data?.shop_name}`);
          setActiveVisit(null);
          Alert.alert('Saved Offline', 'No network — visit completion saved on device and will sync automatically.');
        } else {
          Alert.alert('Error', e.message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrap}>
          <Image source={{ uri: COVER }} style={styles.cover} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={styles.scrim} />
          <Pressable testID="back-btn" style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.coverContent}>
            <View style={[styles.classBadge, { backgroundColor: data.classification === 'A' ? theme.colors.success : data.classification === 'B' ? theme.colors.warning : theme.colors.info }]}>
              <Text style={styles.classText}>Class {data.classification}</Text>
            </View>
            <Text style={styles.shopTitle}>{data.shop_name}</Text>
            <Text style={styles.shopOwner}>{data.owner_name} • {data.retailer_type}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={[styles.statValue, { color: theme.colors.warning }]}>{fmtINR(data.stats.outstanding)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>{fmtINR(data.stats.current_month_sales)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Sales</Text>
              <Text style={styles.statValue}>{fmtINR(data.stats.total_sales)}</Text>
            </View>
          </View>

          {activeVisit ? (
            <View style={styles.visitLive}>
              <MaterialCommunityIcons name="access-point" size={22} color={theme.colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.visitLiveText}>Visit In Progress</Text>
                <Text style={styles.visitTime}>Started {new Date(activeVisit.start_time).toLocaleTimeString('en-IN')}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.section}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {!activeVisit ? (
              <Pressable testID="start-visit-btn" style={styles.actionPrimary} disabled={busy} onPress={startVisit}>
                <MaterialCommunityIcons name="map-marker-plus" size={22} color="#fff" />
                <Text style={styles.actionPrimaryText}>START VISIT</Text>
              </Pressable>
            ) : (
              <Pressable testID="complete-visit-btn" style={[styles.actionPrimary, { backgroundColor: theme.colors.success }]} disabled={busy} onPress={() => completeVisit('OTHER')}>
                <MaterialCommunityIcons name="check-circle-outline" size={22} color="#fff" />
                <Text style={styles.actionPrimaryText}>COMPLETE VISIT</Text>
              </Pressable>
            )}
            <View style={styles.actionRow}>
              <Pressable testID="place-order-btn" style={styles.action} onPress={() => router.push(`/order/new?retailer_id=${id}`)}>
                <MaterialCommunityIcons name="cart-plus" size={20} color={theme.colors.brand} />
                <Text style={styles.actionText}>Place Order</Text>
              </Pressable>
              <Pressable testID="collect-payment-btn" style={styles.action} onPress={() => router.push(`/collection/new?retailer_id=${id}`)}>
                <MaterialCommunityIcons name="hand-coin-outline" size={20} color={theme.colors.brand} />
                <Text style={styles.actionText}>Collect</Text>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable testID="call-btn" style={styles.action} onPress={() => Linking.openURL(`tel:${data.mobile}`)}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={theme.colors.brand} />
                <Text style={styles.actionText}>Call</Text>
              </Pressable>
              <Pressable
                testID="navigate-btn"
                style={styles.action}
                onPress={() => data.latitude && Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`)}
              >
                <MaterialCommunityIcons name="navigation-variant-outline" size={20} color={theme.colors.brand} />
                <Text style={styles.actionText}>Navigate</Text>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable testID="log-complaint-btn" style={styles.action} onPress={() => router.push(`/complaint/new?retailer_id=${id}`)}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.brand} />
                <Text style={styles.actionText}>Log Complaint</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.section}>Contact</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="phone-outline" label="Mobile" value={data.mobile} />
            <InfoRow icon="map-marker-outline" label="Address" value={`${data.address}, ${data.area}, ${data.city}`} />
            <InfoRow icon="identifier" label="Code" value={data.retailer_code} />
          </View>

          <Text style={styles.section}>Recent Orders</Text>
          {(data.recent_orders || []).length === 0 ? (
            <Text style={styles.emptyText}>No orders yet</Text>
          ) : (
            (data.recent_orders as any[]).map((o) => (
              <View key={o.id} style={styles.orderRow}>
                <View>
                  <Text style={styles.orderNo}>{o.order_no}</Text>
                  <Text style={styles.orderDate}>{new Date(o.created_at).toLocaleDateString('en-IN')} • {o.items.length} items</Text>
                </View>
                <Text style={styles.orderAmt}>{fmtINR(o.net_value)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.colors.muted} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrap: { height: 220 },
  cover: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
  backBtn: { position: 'absolute', left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  coverContent: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  classBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 6 },
  classText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  shopTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  shopOwner: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  body: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  statLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 4 },
  visitLive: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#DCF5E7', marginTop: 12 },
  visitLiveText: { fontSize: 13, fontWeight: '700', color: theme.colors.success },
  visitTime: { fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 20, marginBottom: 10 },
  actionGrid: { gap: 10 },
  actionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 14, padding: 16, minHeight: 56 },
  actionPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandTertiary, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  actionText: { color: theme.colors.brand, fontSize: 13, fontWeight: '600' },
  infoCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 8 },
  infoRow: { flexDirection: 'row', padding: 10 },
  infoLabel: { fontSize: 11, color: theme.colors.muted },
  infoValue: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600', marginTop: 2 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  orderNo: { fontSize: 13, fontWeight: '700', color: theme.colors.brand },
  orderDate: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  orderAmt: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  emptyText: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', padding: 12 },
});
