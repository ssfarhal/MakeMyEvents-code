import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/AuthContext';
import { Colors } from '@/src/theme';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const [busy, setBusy] = React.useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }
  if (user) return <Redirect href="/(tabs)/dashboard" />;

  const onLogin = async () => {
    setBusy(true);
    try { await signIn(); } finally { setBusy(false); }
  };

  return (
    <LinearGradient colors={['#F8F4F5', '#F3E8EC', '#FFF7FA']} style={styles.gradient}>
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.logoWrap}>
              <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBrand}>MakeMyEvents</Text>
              <Text style={styles.heroSub}>Owner access portal</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Bookings, availability & revenue — all in one place.</Text>
          <Text style={styles.heroBody}>
            Sign in with your Google account to manage events, approve bookings, and keep every hall update on track.
          </Text>
          <View style={styles.chipsRow}>
            {[
              { icon: 'calendar-outline', label: 'Booking control' },
              { icon: 'calendar-clear-outline', label: 'Availability' },
              { icon: 'wallet-outline', label: 'Payments' },
            ].map((c) => (
              <View key={c.label} style={styles.chip}>
                <Ionicons name={c.icon as any} size={14} color="#fff" />
                <Text style={styles.chipText}>{c.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Owner Login</Text>
          <Text style={styles.cardSub}>Use your Google account connected to the venue.</Text>
          <Pressable
            testID="google-signin-button"
            onPress={onLogin}
            disabled={busy}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <View style={styles.gDot}><Text style={styles.gText}>G</Text></View>
                <Text style={styles.btnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.hint}>Secure Google sign-in via Emergent auth.</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What you can do after login</Text>
            {[
              { icon: 'create-outline', t: 'Create and update bookings' },
              { icon: 'calendar-outline', t: 'Check hall availability' },
              { icon: 'receipt-outline', t: 'Track booking details & invoices' },
            ].map((r) => (
              <View key={r.t} style={styles.miniRow}>
                <Ionicons name={r.icon as any} size={16} color={Colors.primary} />
                <Text style={styles.miniText}>{r.t}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  scroll: { padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  blobA: { position: 'absolute', top: -80, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(123,29,60,0.09)' },
  blobB: { position: 'absolute', bottom: -70, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(201,150,58,0.10)' },
  hero: { borderRadius: 28, padding: 24, marginBottom: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', padding: 8, marginRight: 12 },
  logo: { width: '100%', height: '100%' },
  heroBrand: { color: '#fff', fontSize: 19, fontWeight: '700' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30 },
  heroBody: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20, marginTop: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.20)', borderWidth: 1 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: Colors.outlineVariant },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.onSurface },
  cardSub: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 19 },
  btn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  gDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  gText: { fontSize: 13, fontWeight: '800', color: '#111' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hint: { color: Colors.onSurfaceVariant, fontSize: 11, marginTop: 12 },
  infoBox: { marginTop: 20, backgroundColor: 'rgba(249,228,236,0.6)', borderRadius: 18, padding: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: Colors.onSurface, marginBottom: 10 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  miniText: { fontSize: 12, color: Colors.onSurfaceVariant, fontWeight: '500' },
});
