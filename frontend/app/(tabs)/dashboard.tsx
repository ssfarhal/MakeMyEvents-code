import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/AuthContext';
import { useBookings } from '@/src/BookingsContext';
import { Colors, formatFullDate, formatINR } from '@/src/theme';
import { BookingCard } from '@/src/BookingCard';
import AddBookingSheet from '@/src/AddBookingSheet';
import BookingDetailSheet from '@/src/BookingDetailSheet';
import { EmptyState } from '@/src/EmptyState';
import { Booking } from '@/src/api';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { bookings, refresh, addBooking, updateBooking, deleteBooking, seed, loading } = useBookings();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (detail) {
      const latest = bookings.find((b) => b.id === detail.id);
      if (latest && latest !== detail) setDetail(latest);
    }
  }, [bookings, detail]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const todayISO = now.toISOString().slice(0, 10);
  const todayBookings = bookings.filter((b) => b.eventDate === todayISO);
  const upcoming = bookings.filter((b) => b.eventDate >= todayISO && b.status !== 'cancelled').slice(0, 4);

  const kpis = useMemo(() => {
    const m = now.getMonth(), y = now.getFullYear();
    let monthlyRevenue = 0, pendingBalance = 0, upcomingCount = 0;
    for (const b of bookings) {
      const d = new Date(b.eventDate);
      if (d.getMonth() === m && d.getFullYear() === y) monthlyRevenue += b.advancePaid || 0;
      const bal = (b.totalAmount || 0) - (b.advancePaid || 0);
      if (b.eventDate >= todayISO && b.status !== 'cancelled') {
        upcomingCount++;
        if (bal > 0 && b.status !== 'completed') pendingBalance += bal;
      }
    }
    return { monthlyRevenue, pendingBalance, upcomingCount };
  }, [bookings, todayISO]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appbar}>
        <Image source={require('../../assets/logo.png')} style={styles.brandLogo} />
        <Text style={styles.brand}>MakeMyEvents</Text>
        <View style={{ flex: 1 }} />
        {bookings.length === 0 && !loading && (
          <Pressable testID="seed-btn" onPress={seed} style={styles.iconBtn}>
            <Ionicons name="sparkles-outline" size={20} color={Colors.primary} />
          </Pressable>
        )}
        <Pressable testID="logout-btn" onPress={signOut} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {/* Hero header */}
        <LinearGradient colors={[Colors.primary, Colors.primary + 'CC']} style={styles.hero}>
          <View style={styles.availPill}>
            <View style={[styles.dot, { backgroundColor: todayBookings.length ? '#FF6B6B' : '#6BCB77' }]} />
            <Text style={styles.availText}>{todayBookings.length ? 'Hall Booked Today' : 'Hall Available Today'}</Text>
          </View>
          <Text style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0] || 'Owner'}</Text>
          <Text style={styles.heroBig}>
            {todayBookings.length ? `${todayBookings[0].clientName} — ${todayBookings[0].eventType}` : 'No events scheduled today'}
          </Text>
          <Text style={styles.heroDate}>{formatFullDate(now)}</Text>
        </LinearGradient>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <KpiCard color={Colors.primary} bg={Colors.primaryContainer} icon="cash" label={'Monthly\nRevenue'} value={formatINR(kpis.monthlyRevenue)} />
          <KpiCard color={Colors.secondary} bg={Colors.secondaryContainer} icon="calendar" label={'Upcoming\nEvents'} value={String(kpis.upcomingCount)} />
          <KpiCard color={Colors.warning} bg={Colors.warningContainer} icon="wallet" label={'Pending\nBalance'} value={formatINR(kpis.pendingBalance)} isAlert={kpis.pendingBalance > 0} />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <Pressable onPress={() => router.push('/(tabs)/bookings')}><Text style={styles.link}>View all</Text></Pressable>
        </View>

        {upcoming.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No upcoming bookings"
            subtitle={bookings.length === 0 ? 'Add your first booking or load demo data.' : 'Add a new booking to see it here.'}
            ctaLabel={bookings.length === 0 ? 'Load demo data' : 'Add Booking'}
            onCta={bookings.length === 0 ? seed : () => setShowAdd(true)}
          />
        ) : (
          upcoming.map((b) => <BookingCard key={b.id} booking={b} onPress={() => setDetail(b)} />)
        )}
      </ScrollView>

      <Pressable
        testID="fab-new-booking"
        onPress={() => { setEditing(null); setShowAdd(true); }}
        style={styles.fab}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>New Booking</Text>
      </Pressable>

      <AddBookingSheet
        visible={showAdd}
        existing={editing}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onSubmit={async (data) => {
          if (editing) await updateBooking(editing.id, data);
          else await addBooking(data);
        }}
      />

      <BookingDetailSheet
        booking={detail}
        onClose={() => setDetail(null)}
        onEdit={(b) => { setEditing(b); setShowAdd(true); }}
        onUpdate={updateBooking}
        onDelete={deleteBooking}
      />
    </SafeAreaView>
  );
}

function KpiCard({ color, bg, icon, label, value, isAlert }: any) {
  return (
    <View style={[styles.kpi, isAlert && { borderWidth: 1.5, borderColor: Colors.warning + '77' }]}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.background },
  brandLogo: { width: 32, height: 32, marginRight: 8 },
  brand: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  iconBtn: { padding: 8 },
  hero: { borderRadius: 20, padding: 20, marginBottom: 16 },
  availPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.20)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  availText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroBig: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  heroDate: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpi: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 17, fontWeight: '800', color: Colors.onSurface, marginTop: 10 },
  kpiLabel: { fontSize: 10, color: Colors.muted, marginTop: 2, lineHeight: 13 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.onSurface },
  link: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  emptySub: { fontSize: 12, color: Colors.muted, textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 88, backgroundColor: Colors.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
