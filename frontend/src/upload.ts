import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { TOKEN_KEY } from './api';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export async function uploadImage(uri: string): Promise<string> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, 'photo.jpg');
  } else {
    form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  }
  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error('Photo upload failed');
  const j = await res.json();
  return j.path;
}
