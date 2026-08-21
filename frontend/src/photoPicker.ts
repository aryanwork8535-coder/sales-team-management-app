import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

async function ensureCameraPermission(): Promise<boolean> {
  const cur = await ImagePicker.getCameraPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) {
    Alert.alert(
      'Camera access needed',
      'Enable camera access in Settings to capture photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  const req = await ImagePicker.requestCameraPermissionsAsync();
  return req.granted;
}

export async function takePhoto(): Promise<string | null> {
  const ok = await ensureCameraPermission();
  if (!ok) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  return res.canceled ? null : res.assets[0].uri;
}

export async function pickFromGallery(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] });
  return res.canceled ? null : res.assets[0].uri;
}
