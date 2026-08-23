import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/AuthContext';
import { Colors } from '@/src/theme';
import { BookingsProvider } from '@/src/BookingsContext';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/" />;
  return (
    <BookingsProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: '#9E9E9E',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: Colors.outlineVariant,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10),
            height: 60 + Math.max(insets.bottom, 10),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused, size }) => (
              <MaterialIcons name={focused ? 'dashboard' : 'dashboard-customize'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, focused, size }) => (
              <MaterialIcons name={focused ? 'calendar-month' : 'calendar-today'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: 'Bookings',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'reader' : 'reader-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </BookingsProvider>
  );
}
