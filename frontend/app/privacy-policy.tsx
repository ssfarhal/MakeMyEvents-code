import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/src/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-privacy-btn">
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Your booking data is handled with care</Text>
          <Text style={styles.heroText}>
            This policy explains what information MakeMyEvents collects and how it is stored and used.
          </Text>
        </View>

        <PolicyCard
          title="What we collect"
          body="We collect client names, phone numbers, booking details, and event dates when managing event reservations and related communication."
        />
        <PolicyCard
          title="How we store it"
          body="Booking and client information is stored in MongoDB so the app can securely manage hall bookings, schedules, and event records."
        />
        <PolicyCard
          title="How we share it"
          body="We do not share client data with third parties."
        />

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Important note</Text>
          <Text style={styles.noteBody}>
            Access to booking information should be limited to authorized MakeMyEvents staff members who need it to operate the service.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyCard({ title, body }: { title: string; body: string; }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: Colors.onSurface,
    marginHorizontal: 12,
  },
  spacer: { width: 40, height: 40 },
  content: { padding: 16, paddingBottom: 28 },
  hero: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    backgroundColor: Colors.primary,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.onSurface,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.onSurfaceVariant,
  },
  note: {
    marginTop: 6,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: 18,
    padding: 16,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  noteBody: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.onSurfaceVariant,
  },
});
