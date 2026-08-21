import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, AdminModal, PrimaryBtn, GhostBtn } from '@/src/adminUi';

const CELL = 30;

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtT = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminAttendance() {
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const d = await api.adminAttendanceReport(m);
      setData(d);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const days = data ? Array.from({ length: data.days_in_month }, (_, i) => i + 1) : [];

  const openMap = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Attendance Report</Text>
      <Text style={styles.pageSub}>Day-wise field team attendance with GPS punches</Text>

      <View style={styles.monthNav}>
        <Pressable testID="prev-month" style={styles.monthBtn} onPress={() => setMonth(shiftMonth(month, -1))}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable
          testID="next-month"
          style={[styles.monthBtn, month >= currentMonth && { opacity: 0.3 }]}
          disabled={month >= currentMonth}
          onPress={() => setMonth(shiftMonth(month, 1))}
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} /><Text style={styles.legendText}>Full day</Text>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.warning }]} /><Text style={styles.legendText}>Started only</Text>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.surfaceTertiary, borderWidth: 1, borderColor: theme.colors.border }]} /><Text style={styles.legendText}>Absent</Text>
        </View>
      </View>

      {loading || !data ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row' }}>
            {/* Fixed name column */}
            <View>
              <View style={[styles.gridHeadCell, { width: 190, alignItems: 'flex-start' }]}>
                <Text style={styles.gridHeadText}>SALESPERSON</Text>
              </View>
              {data.rows.map((r: any) => {
                const present = Object.keys(r.days).length;
                return (
                  <View key={r.id} style={[styles.nameCell, { width: 190 }]}>
                    <Text style={styles.nameText} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.nameSub}>{r.employee_id} • {present} day{present === 1 ? '' : 's'}</Text>
                  </View>
                );
              })}
            </View>
            {/* Scrollable day grid */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {days.map((d) => (
                    <View key={d} style={[styles.gridHeadCell, { width: CELL }]}>
                      <Text style={styles.gridHeadText}>{d}</Text>
                    </View>
                  ))}
                </View>
                {data.rows.map((r: any) => (
                  <View key={r.id} style={{ flexDirection: 'row' }}>
                    {days.map((d) => {
                      const rec = r.days[String(d)];
                      const bg = !rec ? theme.colors.surfaceTertiary : rec.end_time ? theme.colors.success : theme.colors.warning;
                      return (
                        <View key={d} style={[styles.dayCellWrap, { width: CELL }]}>
                          <Pressable
                            testID={`att-cell-${r.employee_id}-${d}`}
                            disabled={!rec}
                            onPress={() => setDetail({ ...rec, name: r.name, employee_id: r.employee_id })}
                            style={[styles.dayCell, { backgroundColor: bg }, !rec && { borderWidth: 1, borderColor: theme.colors.border }]}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Card>
      )}

      <AdminModal visible={!!detail} title={`${detail?.name || ''} — ${detail?.date || ''}`} onClose={() => setDetail(null)}>
        {detail ? (
          <View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="login" size={18} color={theme.colors.success} />
              <Text style={styles.detailLabel}>Day Start</Text>
              <Text style={styles.detailValue}>{fmtT(detail.start_time)}</Text>
              {detail.start_lat != null ? (
                <GhostBtn testID="map-start" small label="View on Map" onPress={() => openMap(detail.start_lat, detail.start_lng)} />
              ) : (
                <Text style={styles.noGps}>No GPS</Text>
              )}
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="logout" size={18} color={theme.colors.error} />
              <Text style={styles.detailLabel}>Day End</Text>
              <Text style={styles.detailValue}>{fmtT(detail.end_time)}</Text>
              {detail.end_lat != null ? (
                <GhostBtn testID="map-end" small label="View on Map" onPress={() => openMap(detail.end_lat, detail.end_lng)} />
              ) : (
                <Text style={styles.noGps}>No GPS</Text>
              )}
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="timer-outline" size={18} color={theme.colors.info} />
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>
                {detail.duration_minutes != null ? `${Math.floor(detail.duration_minutes / 60)}h ${detail.duration_minutes % 60}m` : 'In progress'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
              <PrimaryBtn label="Close" small onPress={() => setDetail(null)} />
            </View>
          </View>
        ) : null}
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, marginBottom: 16 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  monthBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, minWidth: 150, textAlign: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 20 },
  legendDot: { width: 12, height: 12, borderRadius: 3, marginLeft: 10 },
  legendText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  gridHeadCell: { height: 34, alignItems: 'center', justifyContent: 'center' },
  gridHeadText: { fontSize: 10, fontWeight: '700', color: theme.colors.muted },
  nameCell: { height: 44, justifyContent: 'center', borderTopWidth: 1, borderTopColor: theme.colors.divider },
  nameText: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  nameSub: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  dayCellWrap: { height: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: theme.colors.divider },
  dayCell: { width: 22, height: 22, borderRadius: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  detailLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, width: 70 },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  noGps: { fontSize: 11, color: theme.colors.muted },
});
