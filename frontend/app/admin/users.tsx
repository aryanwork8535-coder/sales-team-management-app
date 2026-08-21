import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { Card, TRow, Th, Td, StatusChip, AdminModal, Field, SelectChips, PrimaryBtn, GhostBtn } from '@/src/adminUi';

const ROLES = ['salesperson', 'sales_manager', 'distributor', 'super_admin'];
const EMPTY_FORM = { employee_id: '', name: '', role: 'salesperson', mobile: '', territory: '', password: '' };

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.adminUsers();
      setUsers(d || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ employee_id: u.employee_id, name: u.name, role: u.role, mobile: u.mobile || '', territory: u.territory || '', password: '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { notify('Missing fields', 'Name is required'); return; }
    if (!editing && (!form.employee_id.trim() || !form.password)) {
      notify('Missing fields', 'Employee ID and Password are required');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        const payload: any = { name: form.name.trim(), role: form.role, mobile: form.mobile.trim(), territory: form.territory.trim() };
        if (form.password) payload.password = form.password;
        await api.adminUpdateUser(editing.id, payload);
      } else {
        await api.adminCreateUser({
          employee_id: form.employee_id.trim().toUpperCase(),
          name: form.name.trim(),
          role: form.role,
          mobile: form.mobile.trim(),
          territory: form.territory.trim(),
          password: form.password,
        });
      }
      setModal(false);
      load();
    } catch (e: any) {
      notify('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.adminUpdateUser(u.id, { active: !u.active });
      load();
    } catch (e: any) {
      notify('Error', e.message);
    }
  };

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.pageTitle}>Users</Text>
          <Text style={styles.pageSub}>{users.length} team members</Text>
        </View>
        <PrimaryBtn testID="add-user-btn" label="+ Add User" onPress={openAdd} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>
      ) : (
        <Card>
          <TRow header>
            <Th>Emp ID</Th>
            <Th flex={1.8}>Name</Th>
            <Th flex={1.3}>Role</Th>
            <Th flex={1.2}>Mobile</Th>
            <Th flex={1.3}>Territory</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </TRow>
          {users.map((u) => (
            <TRow key={u.id}>
              <Td bold>{u.employee_id}</Td>
              <Td flex={1.8}>{u.name}</Td>
              <Td flex={1.3}>{u.role.replace('_', ' ')}</Td>
              <Td flex={1.2}>{u.mobile}</Td>
              <Td flex={1.3}>{u.territory}</Td>
              <View style={{ flex: 1 }}><StatusChip status={u.active ? 'Active' : 'Inactive'} /></View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                <Pressable testID={`edit-user-${u.employee_id}`} style={styles.iconAction} onPress={() => openEdit(u)}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.brand} />
                </Pressable>
                <Pressable testID={`toggle-user-${u.employee_id}`} style={styles.iconAction} onPress={() => toggleActive(u)}>
                  <MaterialCommunityIcons name={u.active ? 'account-off-outline' : 'account-check-outline'} size={16} color={theme.colors.warning} />
                </Pressable>
              </View>
            </TRow>
          ))}
        </Card>
      )}

      <AdminModal visible={modal} title={editing ? `Edit ${editing.name}` : 'Add User'} onClose={() => setModal(false)}>
        {!editing ? <Field testID="user-empid" label="Employee ID *" value={form.employee_id} onChangeText={set('employee_id')} placeholder="EMP007" /> : null}
        <Field testID="user-name" label="Full Name *" value={form.name} onChangeText={set('name')} placeholder="Ramesh Patil" />
        <SelectChips label="Role" options={ROLES} value={form.role} onChange={set('role')} />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}><Field testID="user-mobile" label="Mobile" value={form.mobile} onChangeText={set('mobile')} keyboardType="phone-pad" placeholder="9800000000" /></View>
          <View style={{ flex: 1 }}><Field testID="user-territory" label="Territory" value={form.territory} onChangeText={set('territory')} placeholder="Kolhapur City" /></View>
        </View>
        <Field
          testID="user-password"
          label={editing ? 'New Password (leave blank to keep current)' : 'Password *'}
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          placeholder="Min 6 characters"
        />
        <View style={styles.modalBtns}>
          <GhostBtn label="Cancel" onPress={() => setModal(false)} />
          <PrimaryBtn testID="save-user-btn" label={editing ? 'Save Changes' : 'Create User'} busy={busy} onPress={save} />
        </View>
      </AdminModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 60 },
  center: { padding: 80, alignItems: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  pageSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  iconAction: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  formRow: { flexDirection: 'row', gap: 12 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
