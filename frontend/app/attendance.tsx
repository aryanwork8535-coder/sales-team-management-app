import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

async function getGps(): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { latitude: null, longitude: null };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { latitude: null, longitude: null };
  }
}

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDur = (m?: number) => (m == null ? '—' : `${Math.floor(m / 60)}h ${m % 60}m`);

export default function Attendance() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [today, setToday] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([api.attendanceToday(), api.attendanceList()]);
      setToday(t || null);
      setHistory(h || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const punch = async (type: 'start' | 'end') => {
    setBusy(true);
    try {
      const gps = await getGps();
      if (type === 'start') await api.attendanceStart(gps);
      else await api.attendanceEnd(gps);
      Alert.alert(type === 'start' ? 'Day Started' : 'Day Ended', gps.latitude ? 'GPS location captured' : 'GPS unavailable — recorded without location');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const started = !!today?.start_time;
  const ended = !!today?.end_time;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-attendance" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Attendance</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.todayCard}>
            <Text style={styles.todayLabel}>TODAY • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <MaterialCommunityIcons name="login" size={20} color={theme.colors.success} />
                <Text style={styles.timeLabel}>Day Start</Text>
                <Text style={styles.timeValue}>{fmtTime(today?.start_time)}</Text>
              </View>
              <View style={styles.timeBox}>
                <MaterialCommunityIcons name="logout" size={20} color={theme.colors.error} />
                <Text style={styles.timeLabel}>Day End</Text>
                <Text style={styles.timeValue}>{fmtTime(today?.end_time)}</Text>
              </View>
              <View style={styles.timeBox}>
                <MaterialCommunityIcons name="timer-outline" size={20} color={theme.colors.info} />
                <Text style={styles.timeLabel}>Duration</Text>
                <Text style={styles.timeValue}>{fmtDur(today?.duration_minutes)}</Text>
              </View>
            </View>

            {!started ? (
              <Pressable testID="start-day-btn" style={styles.punchBtn} disabled={busy} onPress={() => punch('start')}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MaterialCommunityIcons name="map-marker-check" size={22} color="#fff" />
                    <Text style={styles.punchText}>START DAY</Text>
                  </>
                )}
              </Pressable>
            ) : !ended ? (
              <Pressable testID="end-day-btn" style={[styles.punchBtn, { backgroundColor: theme.colors.error }]} disabled={busy} onPress={() => punch('end')}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <MaterialCommunityIcons name="map-marker-off" size={22} color="#fff" />
                    <Text style={styles.punchText}>END DAY</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <View style={styles.doneBanner}>
                <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.success} />
                <Text style={styles.doneText}>Day completed — great work!</Text>
              </View>
            )}
            <Text style={styles.gpsNote}>GPS location is captured with each punch</Text>
          </View>

          <Text style={styles.section}>History</Text>
          {history.length === 0 ? (
            <Text style={styles.empty}>No attendance records yet</Text>
          ) : (
            history.map((a) => (
              <View key={a.id} style={styles.histRow}>
                <View style={styles.histDate}>
                  <Text style={styles.histDay}>{new Date(a.date).getDate()}</Text>
                  <Text style={styles.histMon}>{new Date(a.date).toLocaleDateString('en-IN', { month: 'short' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTimes}>{fmtTime(a.start_time)} → {fmtTime(a.end_time)}</Text>
                  <Text style={styles.histDur}>{fmtDur(a.duration_minutes)}</Text>
                </View>
                <MaterialCommunityIcons
                  name={a.end_time ? 'check-circle' : 'progress-clock'}
                  size={20}
                  color={a.end_time ? theme.colors.success : theme.colors.warning}
                />
              </View>
            ))
          )}
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
  todayCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  todayLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, letterSpacing: 0.5, marginBottom: 14 },
  timeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  timeBox: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 12, gap: 4 },
  timeLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  timeValue: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  punchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 14, minHeight: 56 },
  punchText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  doneBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: '#DCF5E7', borderRadius: 12 },
  doneText: { fontSize: 14, fontWeight: '700', color: theme.colors.success },
  gpsNote: { fontSize: 11, color: theme.colors.muted, textAlign: 'center', marginTop: 10 },
  section: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 24, marginBottom: 10 },
  empty: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', padding: 16 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  histDate: { width: 46, alignItems: 'center', padding: 6, backgroundColor: theme.colors.brandTertiary, borderRadius: 10 },
  histDay: { fontSize: 16, fontWeight: '800', color: theme.colors.brand },
  histMon: { fontSize: 10, fontWeight: '600', color: theme.colors.brand },
  histTimes: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  histDur: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
});
