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
          <Ionicons name="shield-checkmark" size={36} color="rgba(255,255,255,0.9)" style={{ marginBottom: 14 }} />
          <Text style={styles.heroTitle}>Your data is in safe hands</Text>
          <Text style={styles.heroText}>
            This policy explains what information BookMyEvents collects, how it is stored, and how it is used. Effective from June 2026.
          </Text>
        </View>

        <PolicySection
          title="1. What We Collect"
          body={[
            'Name and email address (collected when you sign in with Google)',
            'Phone number (collected when you sign in with Phone OTP)',
            'Booking details: client names, phone numbers, event dates, event types, guest counts',
            'Financial data: booking amounts, advance payments, payment histories, charge breakdowns (hall rent, labour, electricity, maintenance, etc.)',
            'Business details you provide: hall/venue name, address, owner name, and contact number',
          ]}
        />

        <PolicySection
          title="2. How We Store It"
          body={[
            'All data is stored securely in a MongoDB database hosted in a cloud environment',
            'Your session is protected by a secure bearer token that expires after 7 days',
            'Phone OTP authentication is provided through Firebase Authentication (Google)',
            'Google OAuth is provided through Emergent Auth, a secure third-party authentication provider',
            'No passwords are stored — we use Google OAuth and Firebase Phone Auth exclusively',
          ]}
        />

        <PolicySection
          title="3. How We Use It"
          body={[
            'To display your bookings, calendar, and financial summaries within the app',
            'To generate PDF invoices and reports with your hall details',
            'To send WhatsApp reminders for pending balance collections',
            'To provide manager access features so your staff can view and create bookings',
          ]}
        />

        <PolicySection
          title="4. Who Can Access Your Data"
          body={[
            'Only you (the account owner) and any managers you explicitly invite can access your booking data',
            'BookMyEvents staff do not access your booking or financial data',
            'We do not sell, rent, or share your data with any third parties for marketing purposes',
            'We do not share data with advertisers or analytics providers',
          ]}
        />

        <PolicySection
          title="5. Manager Access"
          body={[
            'When you invite a manager, they can view all your bookings and financial data, and create new bookings on your behalf',
            'Manager access can be revoked at any time from the Settings → Manager Access section',
            'Managers log in using the same app with their own phone number or email',
          ]}
        />

        <PolicySection
          title="6. Data Retention & Deletion"
          body={[
            'Your data is stored for as long as your account is active',
            'You can permanently delete your account and all associated data from Settings → Delete Account',
            'You can also submit a deletion request at the /delete-account page using your email',
            'Upon deletion, all bookings, financial records, session tokens, and account data are immediately and permanently removed from the database',
            'Deleted data cannot be recovered',
          ]}
        />

        <PolicySection
          title="7. Security"
          body={[
            'All API communication is over HTTPS/TLS',
            'Session tokens are stored securely on your device using Expo SecureStore (native) or encrypted localStorage (web)',
            'Firebase Phone Auth and Google OAuth ensure we never handle your passwords directly',
            'Each owner\'s data is completely isolated — no cross-tenant access is possible',
          ]}
        />

        <View style={styles.note}>
          <Ionicons name="mail-outline" size={16} color={Colors.primary} style={{ marginBottom: 8 }} />
          <Text style={styles.noteTitle}>Questions?</Text>
          <Text style={styles.noteBody}>
            If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us through the app or submit a deletion request at the /delete-account page.
          </Text>
        </View>

        <Text style={styles.footer}>BookMyEvents • Privacy Policy • June 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicySection({ title, body }: { title: string; body: string[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {body.map((line, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.cardBody}>{line}</Text>
        </View>
      ))}
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
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.outlineVariant,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 18, fontWeight: '800', color: Colors.onSurface,
    marginHorizontal: 12,
  },
  spacer: { width: 40, height: 40 },
  content: { padding: 16, paddingBottom: 32 },
  hero: { borderRadius: 22, padding: 24, marginBottom: 16, backgroundColor: Colors.primary, alignItems: 'flex-start' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  heroText: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.outlineVariant },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7, marginRight: 10, flexShrink: 0 },
  cardBody: { flex: 1, fontSize: 13, lineHeight: 20, color: Colors.onSurfaceVariant },
  note: { marginTop: 4, backgroundColor: Colors.secondaryContainer, borderRadius: 18, padding: 18 },
  noteTitle: { fontSize: 14, fontWeight: '800', color: Colors.onSurface, marginBottom: 6 },
  noteBody: { fontSize: 13, lineHeight: 20, color: Colors.onSurfaceVariant },
  footer: { textAlign: 'center', fontSize: 11, color: Colors.muted, marginTop: 20, paddingBottom: 8 },
});
