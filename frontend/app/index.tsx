import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/AuthContext';
import { theme } from '@/src/theme';

export default function Login() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [empId, setEmpId] = useState('EMP003');
  const [pw, setPw] = useState('sales@123');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin' || user.role === 'sales_manager') router.replace('/admin');
      else router.replace('/(tabs)/home');
    }
  }, [loading, user]);

  const handleLogin = async () => {
    setErr(null);
    setBusy(true);
    try {
      await login(empId.trim().toUpperCase(), pw);
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[theme.colors.brand, '#0B4530']} style={styles.header}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="shield-star" size={44} color={theme.colors.onBrandPrimary} />
          </View>
          <Text style={styles.appName}>FieldForce Pro</Text>
          <Text style={styles.appTag}>FMCG Sales Automation</Text>
        </LinearGradient>

        <View style={styles.formArea}>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in with your Employee ID</Text>

          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="account-circle-outline" size={22} color={theme.colors.muted} />
            <TextInput
              testID="login-employee-id-input"
              value={empId}
              onChangeText={setEmpId}
              placeholder="Employee ID (e.g. EMP003)"
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="characters"
              style={styles.input}
            />
          </View>

          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="lock-outline" size={22} color={theme.colors.muted} />
            <TextInput
              testID="login-password-input"
              value={pw}
              onChangeText={setPw}
              placeholder="Password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {err ? <Text testID="login-error-text" style={styles.err}>{err}</Text> : null}

          <Pressable
            testID="login-submit-button"
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }]}
            disabled={busy}
            onPress={handleLogin}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>LOGIN</Text>}
          </Pressable>

          <Pressable testID="forgot-password-link" onPress={() => setErr('Contact your admin to reset password.')}>
            <Text style={styles.forgot}>Forgot Password?</Text>
          </Pressable>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo Credentials</Text>
            <Text style={styles.demoText}>Salesperson: EMP003 / sales@123</Text>
            <Text style={styles.demoText}>Manager: EMP002 / manager@123</Text>
            <Text style={styles.demoText}>Distributor: EMP004 / dist@123</Text>
            <Text style={styles.demoText}>Admin: EMP001 / admin@123</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  header: { paddingTop: 80, paddingBottom: 48, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoBox: { width: 84, height: 84, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  appName: { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  appTag: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  formArea: { padding: 24, paddingTop: 32 },
  welcome: { fontSize: 24, fontWeight: '700', color: theme.colors.onSurface },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginTop: 4, marginBottom: 24 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, marginBottom: 12, minHeight: 56 },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: theme.colors.onSurface, height: 56 },
  err: { color: theme.colors.error, marginBottom: 8, fontSize: 13 },
  loginBtn: { backgroundColor: theme.colors.brand, borderRadius: 12, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  forgot: { textAlign: 'center', color: theme.colors.brand, marginTop: 16, fontSize: 14 },
  demoBox: { marginTop: 32, padding: 16, backgroundColor: theme.colors.brandTertiary, borderRadius: 12 },
  demoTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onBrandTertiary, marginBottom: 6 },
  demoText: { fontSize: 12, color: theme.colors.onBrandTertiary, marginTop: 2 },
});
