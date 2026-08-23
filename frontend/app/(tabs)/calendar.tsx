import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBookings } from '@/src/BookingsContext';
import { Colors, formatINR, eventTypeColor } from '@/src/theme';
import { Booking } from '@/src/api';
import AddBookingSheet from '@/src/AddBookingSheet';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarScreen() {
  const { bookings, addBooking } = useBookings();
  const [focused, setFocused] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPrefillDate, setAddPrefillDate] = useState<Date | null>(null);

  const y = focused.getFullYear();
  const m = focused.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // Monday=0

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const bookingsByDay: Record<number, Booking[]> = useMemo(() => {
    const map: Record<number, Booking[]> = {};
    for (const b of bookings) {
      const dt = new Date(b.eventDate);
      if (dt.getFullYear() === y && dt.getMonth() === m) {
        const day = dt.getDate();
        (map[day] ||= []).push(b);
      }
    }
    return map;
  }, [bookings, y, m]);

  const bookedDays = Object.keys(bookingsByDay).length;
  const availableDays = daysInMonth - bookedDays;
  const occupancy = daysInMonth > 0 ? Math.round((bookedDays / daysInMonth) * 100) : 0;

  const today = new Date();
  const isTodayMonth = today.getFullYear() === y && today.getMonth() === m;

  const selectedBookings = selectedDay ? (bookingsByDay[selectedDay.getDate()] || []) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Availability</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Month nav */}
        <View style={styles.navRow}>
          <Pressable testID="prev-month" onPress={() => setFocused(new Date(y, m - 1, 1))} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.monthName}>{MONTH_NAMES[m]}</Text>
            <Text style={styles.monthYear}>{y}</Text>
          </View>
          <Pressable testID="next-month" onPress={() => setFocused(new Date(y, m + 1, 1))} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </Pressable>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {[
            { c: Colors.primary, l: 'Confirmed' },
            { c: Colors.warning, l: 'Pending' },
            { c: Colors.success, l: 'Available' },
          ].map((it) => (
            <View key={it.l} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: it.c }]} />
              <Text style={styles.legendText}>{it.l}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          <View style={styles.dayLabels}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={[styles.dayLabel, d === 'Sun' && { color: Colors.error }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.cellsWrap}>
            {cells.map((cell, i) => {
              if (cell === null) return <View key={`e-${i}`} style={styles.cellEmpty} />;
              const dayBookings = bookingsByDay[cell] || [];
              const isBooked = dayBookings.length > 0;
              const isPending = isBooked && dayBookings.some((b) => b.status === 'pending');
              const isConfirmed = isBooked && dayBookings.some((b) => b.status === 'confirmed');
              const isToday = isTodayMonth && today.getDate() === cell;
              const cellDate = new Date(y, m, cell);
              const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());

              let bg = Colors.successContainer + '80';
              let fg = Colors.success;
              let border: string | null = null;
              if (isToday) { bg = Colors.primary; fg = '#fff'; }
              else if (isConfirmed) { bg = Colors.primary + '22'; fg = Colors.primary; border = Colors.primary + '77'; }
              else if (isPending) { bg = Colors.warning + '22'; fg = Colors.warning; border = Colors.warning + '77'; }
              else if (isPast) { bg = 'transparent'; fg = '#CCC'; }

              return (
                <Pressable
                  key={`c-${cell}`}
                  testID={`cal-cell-${cell}`}
                  onPress={() => setSelectedDay(cellDate)}
                  style={[styles.cell, { backgroundColor: bg, borderColor: border || 'transparent', borderWidth: border ? 1.5 : 0 }]}
                >
                  <Text style={[styles.cellDay, { color: fg }]}>{cell}</Text>
                  {isBooked && !isToday && (
                    <View style={[styles.cellDot, { backgroundColor: isConfirmed ? Colors.primary : Colors.warning }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Monthly summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Monthly Summary</Text>
          <View style={styles.summaryRow}>
            <SummaryTile color={Colors.primary} label="Booked" value={String(bookedDays)} />
            <SummaryTile color={Colors.success} label="Available" value={String(availableDays)} />
            <SummaryTile color={Colors.secondary} label="Occupancy" value={`${occupancy}%`} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${occupancy}%` }]} />
          </View>
        </View>
      </ScrollView>

      {/* Day detail */}
      <Modal visible={!!selectedDay} transparent animationType="slide" onRequestClose={() => setSelectedDay(null)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedDay(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {selectedDay && (
                <>
                  <Text style={styles.dayTitle}>{selectedDay.toDateString()}</Text>
                  <Text style={styles.dayMeta}>{selectedBookings.length} booking{selectedBookings.length !== 1 ? 's' : ''}</Text>
                  {selectedBookings.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                      <Text style={{ color: Colors.success, fontWeight: '700', marginTop: 8, fontSize: 15 }}>Hall is available on this date</Text>
                      <Text style={{ color: Colors.muted, marginTop: 4, fontSize: 13 }}>No events scheduled. Perfect for booking!</Text>
                    </View>
                  ) : (
                    selectedBookings.map((b) => (
                      <View key={b.id} style={styles.dayBooking}>
                        <View style={[styles.smallDot, { backgroundColor: eventTypeColor(b.eventType) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bkName}>{b.clientName}</Text>
                          <Text style={styles.bkMeta}>{b.eventType} • {b.functionTime} • {b.guestCount} guests</Text>
                          <Text style={styles.bkMoney}>Total {formatINR(b.totalAmount)} • Bal {formatINR(b.totalAmount - b.advancePaid)}</Text>
                        </View>
                      </View>
                    ))
                  )}
                  <Pressable
                    testID="book-this-date-btn"
                    onPress={() => {
                      setAddPrefillDate(selectedDay);
                      setSelectedDay(null);
                      setShowAdd(true);
                    }}
                    style={styles.bookDateBtn}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.bookDateText}>
                      {selectedBookings.length === 0 ? 'Book this Date' : 'Add another booking'}
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AddBookingSheet
        visible={showAdd}
        prefillDate={addPrefillDate}
        onClose={() => { setShowAdd(false); setAddPrefillDate(null); }}
        onSubmit={addBooking}
      />
    </SafeAreaView>
  );
}

function SummaryTile({ color, label, value }: any) {
  return (
    <View style={[styles.summaryTile, { backgroundColor: color + '18' }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: color + 'B0' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.onSurface, flex: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryContainer, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 10, borderRadius: 10, backgroundColor: '#fff' },
  monthName: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  monthYear: { fontSize: 13, color: Colors.muted },
  legendRow: { flexDirection: 'row', gap: 12, marginBottom: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.muted, fontWeight: '600' },
  grid: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12 },
  dayLabels: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.muted },
  cellsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cellEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
  cellDay: { fontSize: 15, fontWeight: '700' },
  cellDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  summary: { backgroundColor: '#fff', marginTop: 20, borderRadius: 16, padding: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: Colors.onSurface, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryTile: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  progressTrack: { height: 8, backgroundColor: Colors.outlineVariant, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginTop: 10 },
  dayTitle: { fontSize: 18, fontWeight: '800', color: Colors.onSurface },
  dayMeta: { fontSize: 12, color: Colors.muted, marginTop: 2, marginBottom: 12 },
  dayBooking: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.surfaceVariant, borderRadius: 12, padding: 12, marginBottom: 8 },
  smallDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  bkName: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  bkMeta: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  bkMoney: { fontSize: 12, color: Colors.primary, fontWeight: '700', marginTop: 4 },
  bookDateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 16 },
  bookDateText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
