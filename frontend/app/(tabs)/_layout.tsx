import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          backgroundColor: theme.colors.surfaceSecondary,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="beat" options={{ title: 'Beat', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="map-marker-path" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="retailers" options={{ title: 'Retailers', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="store-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
