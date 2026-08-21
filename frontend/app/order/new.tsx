import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { theme, fmtINR } from '@/src/theme';

export default function NewOrder() {
  const { retailer_id } = useLocalSearchParams<{ retailer_id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [retailer, setRetailer] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, p, b] = await Promise.all([
          api.retailer(retailer_id as string),
          api.products(),
          api.brands(),
        ]);
        setRetailer(r);
        setProducts(p);
        setBrands(b);
      } finally {
        setLoading(false);
      }
    })();
  }, [retailer_id]);

  const filtered = useMemo(() => {
    return selectedBrand === 'ALL' ? products : products.filter(p => p.brand === selectedBrand);
  }, [products, selectedBrand]);

  const items = useMemo(() => {
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([pid, q]) => {
        const p = products.find(x => x.id === pid);
        return p ? { product: p, qty: q, rate: p.salesperson_rate, amount: q * p.salesperson_rate } : null;
      })
      .filter(Boolean) as any[];
  }, [cart, products]);

  const subtotal = items.reduce((s, i) => s + i.amount, 0);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (items.length === 0) { setSchemes([]); return; }
      try {
        const s = await api.schemeCalc(items.map(i => ({ product_id: i.product.id, quantity: i.qty })));
        setSchemes(s.schemes || []);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [items.length, items.map(i => i.qty).join(',')]);

  const setQty = (pid: string, delta: number) => {
    setCart(c => {
      const cur = c[pid] || 0;
      const next = Math.max(0, cur + delta);
      return { ...c, [pid]: next };
    });
  };

  const submit = async () => {
    if (items.length === 0) { Alert.alert('Empty order', 'Add at least one product'); return; }
    setBusy(true);
    try {
      const payload = {
        retailer_id: retailer_id as string,
        items: items.map(i => ({ product_id: i.product.id, quantity: i.qty, rate: i.rate, discount: 0 })),
        remarks: '',
      };
      const order = await api.createOrder(payload);
      Alert.alert('Order Placed', `${order.order_no}\n${fmtINR(order.net_value)}`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/orders') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;

  const brandChips = ['ALL', ...brands];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-order" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>New Order</Text>
          <Text style={styles.retailerText} numberOfLines={1}>{retailer?.shop_name}</Text>
        </View>
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {brandChips.map(b => (
            <Pressable
              key={b}
              testID={`brand-chip-${b}`}
              style={[styles.chip, selectedBrand === b && styles.chipActive]}
              onPress={() => setSelectedBrand(b)}
            >
              <Text style={[styles.chipText, selectedBrand === b && styles.chipTextActive]}>{b}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
        renderItem={({ item }) => {
          const qty = cart[item.id] || 0;
          return (
            <View testID={`product-${item.id}`} style={styles.pcard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pbrand}>{item.brand}</Text>
                <Text style={styles.pname} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.ppack}>{item.pack_size} • {item.sku_code}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{fmtINR(item.salesperson_rate)}</Text>
                  <Text style={styles.mrp}>MRP {fmtINR(item.mrp)}</Text>
                </View>
              </View>
              <View style={styles.stepper}>
                <Pressable testID={`minus-${item.id}`} style={styles.stepBtn} onPress={() => setQty(item.id, -1)}>
                  <MaterialCommunityIcons name="minus" size={18} color={theme.colors.brand} />
                </Pressable>
                <Text style={styles.qty}>{qty}</Text>
                <Pressable testID={`plus-${item.id}`} style={styles.stepBtn} onPress={() => setQty(item.id, 1)}>
                  <MaterialCommunityIcons name="plus" size={18} color={theme.colors.brand} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {schemes.length > 0 && (
          <View style={styles.schemeInfo}>
            <MaterialCommunityIcons name="gift-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.schemeText}>
              {schemes.map(s => `${s.brand}: ${s.slab.article}`).join(' • ')}
            </Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.sumLabel}>{items.length} items • Total</Text>
            <Text testID="order-total" style={styles.sumValue}>{fmtINR(subtotal)}</Text>
          </View>
          <Pressable testID="submit-order-btn" style={styles.placeBtn} disabled={busy || items.length === 0} onPress={submit}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeBtnText}>PLACE ORDER</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.onSurface },
  retailerText: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  chipsWrap: { height: 56, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary, flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  pcard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  pbrand: { fontSize: 10, color: theme.colors.brand, fontWeight: '700', letterSpacing: 0.5 },
  pname: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurface, marginTop: 2 },
  ppack: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  price: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  mrp: { fontSize: 10, color: theme.colors.muted, textDecorationLine: 'line-through' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.brandTertiary, borderRadius: 999, padding: 4 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center', fontWeight: '700', color: theme.colors.onSurface },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.colors.border, padding: 14, gap: 10 },
  schemeInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FDECD3', borderRadius: 10 },
  schemeText: { flex: 1, fontSize: 12, color: theme.colors.warning, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  sumValue: { fontSize: 22, fontWeight: '800', color: theme.colors.onSurface },
  placeBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 22, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  placeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});
