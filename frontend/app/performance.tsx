import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';

const compact = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

function ProgressCard({ title, achieved, target }: { title: string; achieved: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
  return (
    <View style={styles.progCard}>
      <View style={styles.progHead}>
        <Text style={styles.progTitle}>{title}</Text>
        <Text style={styles.progPct}>{pct}%</Text>
      </View>
      <View style={styles.progTrack}>
        <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? theme.colors.success : theme.colors.brand }]} />
      </View>
      <View style={styles.progHead}>
        <Text style={styles.progSub}>{fmtINR(achieved)} achieved</Text>
        <Text style={styles.progSub}>Target {fmtINR(target)}</Text>
      </View>
    </View>
  );
}

export default function Performance() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.performance();
      setData(d);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maxTrend = data ? Math.max(1, ...data.trend.map((t: any) => t.sales)) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-performance" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Performance</Text>
      </View>

      {loading || !data ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <LinearGradient colors={[theme.colors.brand, '#0B4530']} style={styles.rankCard}>
            <View style={styles.medal}>
              <MaterialCommunityIcons name={data.rank === 1 ? 'trophy' : 'medal-outline'} size={30} color="#FFD65C" />
            </View>
            <Text testID="rank-value" style={styles.rankBig}>#{data.rank ?? '—'}</Text>
            <Text style={styles.rankSub}>of {data.total_salespersons} salespersons this month</Text>
          </LinearGradient>

          <Text style={styles.section}>This Month</Text>
          <ProgressCard title="Monthly Target" achieved={data.month_sales} target={data.monthly_target} />
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={theme.colors.info} />
              <Text style={styles.statValue}>{data.month_orders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="map-marker-check" size={18} color={theme.colors.warning} />
              <Text style={styles.statValue}>{data.month_visits}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="hand-coin-outline" size={18} color={theme.colors.success} />
              <Text style={styles.statValue}>{compact(data.month_collection)}</Text>
              <Text style={styles.statLabel}>Collection</Text>
            </View>
          </View>

          <Text style={styles.section}>Today</Text>
          <ProgressCard title="Daily Target" achieved={data.today_sales} target={data.daily_target} />

          <Text style={styles.section}>6-Month Trend</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              {data.trend.map((t: any) => {
                const h = Math.max(4, Math.round((t.sales / maxTrend) * 110));
                const isCurrent = t === data.trend[data.trend.length - 1];
                return (
                  <View key={t.month} style={styles.barCol}>
                    <Text style={styles.barValue}>{t.sales > 0 ? compact(t.sales) : ''}</Text>
                    <View style={[styles.bar, { height: h, backgroundColor: isCurrent ? theme.colors.brand : theme.colors.brandSecondary }]} />
                    <Text style={[styles.barLabel, isCurrent && { color: theme.colors.brand, fontWeight: '700' }]}>{t.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <Text style={styles.section}>Leaderboard</Text>
          <View style={styles.lbCard}>
            {data.leaderboard.map((l: any) => (
              <View key={l.rank} style={[styles.lbRow, l.is_me && styles.lbRowMe]}>
                <View style={[styles.lbRank, l.rank === 1 && { backgroundColor: '#FFF3D6' }]}>
                  <Text style={[styles.lbRankText, l.rank === 1 && { color: '#B8860B' }]}>{l.rank}</Text>
                </View>
                <Text style={[styles.lbName, l.is_me && { fontWeight: '800', color: theme.colors.brand }]} numberOfLines={1}>
                  {l.name}{l.is_me ? ' (You)' : ''}
                </Text>
                <Text style={styles.lbSales}>{fmtINR(l.sales)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  rankCard: { alignItems: 'center', padding: 24, borderRadius: 18 },
  medal: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  rankBig: { fontSize: 40, fontWeight: '800', color: '#fff' },
  rankSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 22, marginBottom: 10 },
  progCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  progHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  progPct: { fontSize: 16, fontWeight: '800', color: theme.colors.brand },
  progTrack: { height: 10, borderRadius: 5, backgroundColor: theme.colors.surfaceTertiary, marginVertical: 10, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 5 },
  progSub: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statBox: { flex: 1, alignItems: 'center', gap: 4, padding: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  statValue: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  statLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  chartCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: 26, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barValue: { fontSize: 9, fontWeight: '700', color: theme.colors.muted },
  barLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  lbCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 8 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10 },
  lbRowMe: { backgroundColor: theme.colors.brandTertiary },
  lbRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  lbRankText: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurfaceTertiary },
  lbName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  lbSales: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
});
