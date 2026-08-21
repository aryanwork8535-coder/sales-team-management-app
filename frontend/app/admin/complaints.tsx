import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, StatusChip, FilterChips, PrimaryBtn, GhostBtn, AdminModal, Field } from '@/src/adminUi';
import { AuthImage } from '@/src/AuthImage';

const FILTERS = ['Open', 'In Progress', 'Resolved', 'All'];

export default function AdminComplaints() {
  const [filter, setFilter] = useState('Open');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<any>(null);
  const [note, setNote] = useState('');
  const [photoView, setPhotoView] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const d = await api.complaints(f === 'All' ? undefined : f);
      setItems(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const setStatus = async (id: string, status: string, comment = '') => {
    setBusyId(id);
    try {
      await api.reviewComplaint(id, { status, comment });
      load(filter);
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async () => {
    if (!resolving) return;
    await setStatus(resolving.id, 'Resolved', note.trim());
    setResolving(null);
    setNote('');
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <Text style={styles.pageTitle}>Complaints</Text>
      <Text style={styles.pageSub}>{items.length} complaints</Text>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : items.length === 0 ? (
        <Card><Text style={styles.empty}>No {filter.toLowerCase() === 'all' ? '' : filter.toLowerCase() + ' '}complaints</Text></Card>
      ) : (
        items.map((c) => (
          <Card key={c.id}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shop}>{c.retailer_name}</Text>
                <Text style={styles.meta}>
                  {c.complaint_no} • by {c.salesperson_name} • {new Date(c.created_at).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <StatusChip status={c.status} />
            </View>
            <View style={styles.catRow}>
              <MaterialCommunityIcons name="tag-outline" size={14} color={theme.colors.brand} />
              <Text style={styles.cat}>{c.category}</Text>
            </View>
            <Text style={styles.desc}>{c.description}</Text>
            {c.photo_path ? (
              <Pressable testID={`view-complaint-photo-${c.id}`} onPress={() => setPhotoView(c.photo_path)} style={{ marginTop: 10 }}>
                <AuthImage path={c.photo_path} style={styles.thumb} />
              </Pressable>
            ) : null}
            {c.resolution_note ? (
              <View style={styles.resolution}>
                <MaterialCommunityIcons name="check-decagram" size={14} color={theme.colors.success} />
                <Text style={styles.resolutionText}>{c.resolution_note} — {c.resolved_by}</Text>
              </View>
            ) : null}
            {c.status !== 'Resolved' ? (
              <View style={styles.actions}>
                {c.status === 'Open' ? (
                  <GhostBtn testID={`progress-${c.id}`} label="Mark In Progress" small onPress={() => setStatus(c.id, 'In Progress')} />
                ) : null}
                <PrimaryBtn testID={`resolve-${c.id}`} label="Resolve" tone="success" small busy={busyId === c.id} onPress={() => { setResolving(c); setNote(''); }} />
              </View>
            ) : null}
          </Card>
        ))
      )}

      <AdminModal visible={!!resolving} title={`Resolve ${resolving?.complaint_no || ''}`} onClose={() => setResolving(null)}>
        <Field testID="resolution-note" label="Resolution Note" value={note} onChangeText={setNote} placeholder="e.g. Replacement stock dispatched" />
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setResolving(null)} />
          <PrimaryBtn testID="confirm-resolve-btn" label="Mark Resolved" tone="success" onPress={resolve} />
        </View>
      </AdminModal>

      <AdminModal visible={!!photoView} title="Complaint Photo" onClose={() => setPhotoView(null)}>
        {photoView ? <AuthImage path={photoView} style={styles.fullPhoto} /> : null}
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2, marginBottom: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  shop: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  meta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cat: { fontSize: 12, fontWeight: '600', color: theme.colors.brand },
  desc: { fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 6, lineHeight: 19 },
  thumb: { width: 80, height: 80, borderRadius: 10 },
  resolution: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 10, backgroundColor: '#DCF5E7', borderRadius: 8 },
  resolutionText: { flex: 1, fontSize: 12, color: theme.colors.success, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  empty: { fontSize: 12, color: theme.colors.muted, padding: 16, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  fullPhoto: { width: '100%', height: 420, borderRadius: 12 },
});
