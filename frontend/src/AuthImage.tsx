import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from './api';
import { theme } from './theme';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export function AuthImage({ path, style }: { path: string; style?: any }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const res = await fetch(`${BASE}/api/files/${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (alive) setSrc(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  if (!src) {
    return (
      <View style={[style, styles.ph]}>
        <ActivityIndicator size="small" color={theme.colors.brand} />
      </View>
    );
  }
  return <Image source={{ uri: src }} style={style} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  ph: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceTertiary },
});
