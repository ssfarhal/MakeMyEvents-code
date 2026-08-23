import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/AuthContext';
import { useBookings } from '@/src/BookingsContext';
import { Colors } from '@/src/theme';
import { BookingCard } from '@/src/BookingCard';
import AddBookingSheet from '@/src/AddBookingSheet';
import BookingDetailSheet from '@/src/BookingDetailSheet';
import { EmptyState, SkeletonCard } from '@/src/EmptyState';
import { Booking } from '@/src/api';

type Filter = 'all' | 'upcoming' | 'completed' | 'pending';

export default function Bookings() {
  const { user } = useAuth();
  const { bookings, refresh, loading, addBooking, updateBooking, addPayment, deletePayment, deleteBooking, seed } = useBookings();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);

  const todayISO = new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => ({
    all: bookings.length,
    upcoming: bookings.filter((b) => b.eventDate >= todayISO && b.status !== 'cancelled').length,
    pending: bookings.filter((b) => (b.totalAmount - b.advancePaid) > 0 && b.status !== 'completed').length,
  }), [bookings, todayISO]);

  const filtered = useMemo(() => {
    let list = bookings;
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((b) => b.clientName.toLowerCase().includes(s) || b.eventType.toLowerCase().includes(s));
    }
    if (filter === 'upcoming') list = list.filter((b) => b.eventDate >= todayISO && b.status !== 'cancelled');
    if (filter === 'completed') list = list.filter((b) => b.status === 'completed');
    if (filter === 'pending') list = list.filter((b) => (b.totalAmount - b.advancePaid) > 0 && b.status !== 'completed');
    return list.slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [bookings, filter, q, todayISO]);

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { key: 'completed', label: 'Completed' },
    { key: 'pending', label: 'Pending Balance', count: counts.pending },
  ];

  // Keep detail booking in sync with bookings list
  React.useEffect(() => {
    if (detail) {
      const latest = bookings.find((b) => b.id === detail.id);
      if (latest && latest !== detail) setDetail(latest);
    }
  }, [bookings, detail]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={styles.header}>
        {searchOpen ? (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={Colors.muted} />
              <TextInput
                testID="search-input"
                value={q}
                onChangeText={setQ}
                autoFocus
                placeholder="Search by client or event type..."
                placeholderTextColor={Colors.muted}
                style={styles.searchInput}
              />
            </View>
            <Pressable onPress={() => { setSearchOpen(false); setQ(''); }}>
              <Text style={{ color: Colors.primary, fontWeight: '700', marginLeft: 8 }}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Bookings</Text>
            <View style={{ flex: 1 }} />
            <Pressable testID="open-search-btn" onPress={() => setSearchOpen(true)} style={styles.searchBtn}>
              <Ionicons name="search" size={18} color={Colors.primary} />
            </Pressable>
          </>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
        style={{ maxHeight: 56, flexGrow: 0 }}
      >
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`filter-chip-${f.key}`}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, { flexShrink: 0 }, active && { backgroundColor: Colors.primary }]}
            >
              <Text style={[styles.chipLabel, active && { color: '#fff' }]}>{f.label}</Text>
              {f.count != null && f.count > 0 && (
                <View style={[styles.chipCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                  <Text style={[styles.chipCountText, active && { color: '#fff' }]}>{f.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.countText}>{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</Text>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {loading && bookings.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="reader-outline"
            title="No bookings found"
            subtitle={q ? `No results for "${q}"` : bookings.length === 0 ? 'Add your first booking, or tap "Seed demo" to load sample data.' : 'Try a different filter.'}
            ctaLabel={bookings.length === 0 ? 'Load demo data' : 'Add Booking'}
            onCta={bookings.length === 0 ? seed : () => { setEditing(null); setShowAdd(true); }}
          />
        ) : (
          filtered.map((b) => <BookingCard key={b.id} booking={b} onPress={() => setDetail(b)} />)
        )}
      </ScrollView>

      <Pressable testID="fab-new-booking" onPress={() => { setEditing(null); setShowAdd(true); }} style={styles.fab}>
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
        hallName={user?.hallName}
        hallAddress={user?.hallAddress}
        ownerName={user?.ownerName}
        ownerPhone={user?.ownerPhone}
        onClose={() => setDetail(null)}
        onEdit={(b) => { setEditing(b); setShowAdd(true); }}
        onUpdate={updateBooking}
        onAddPayment={addPayment}
        onDeletePayment={deletePayment}
        onDelete={deleteBooking}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.onSurface },
  searchBtn: { padding: 10, backgroundColor: Colors.primaryContainer, borderRadius: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.onSurface, padding: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.outline, gap: 6 },
  chipLabel: { fontSize: 13, fontWeight: '700', color: Colors.onSurfaceVariant },
  chipCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: Colors.primary + '22' },
  chipCountText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  countText: { fontSize: 12, color: Colors.muted, paddingHorizontal: 16, paddingBottom: 4, fontWeight: '500' },
  fab: { position: 'absolute', right: 16, bottom: 100, backgroundColor: Colors.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
