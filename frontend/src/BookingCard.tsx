import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, eventTypeColor, formatDate, formatINR } from './theme';
import { Booking } from './api';

const iconFor = (t: string) => {
  switch ((t || '').toLowerCase()) {
    case 'wedding': return 'heart';
    case 'reception': return 'sparkles';
    case 'engagement': return 'diamond';
    case 'birthday': return 'gift';
    case 'corporate': return 'briefcase';
    default: return 'calendar';
  }
};

const statusPill = (status: string) => {
  switch (status) {
    case 'confirmed': return { bg: Colors.successContainer, fg: Colors.success, label: 'Confirmed' };
    case 'pending': return { bg: Colors.warningContainer, fg: Colors.warning, label: 'Pending' };
    case 'completed': return { bg: '#F0F0F0', fg: '#6B7280', label: 'Done' };
    case 'cancelled': return { bg: Colors.errorContainer, fg: Colors.error, label: 'Cancelled' };
    default: return { bg: '#F0F0F0', fg: '#6B7280', label: status };
  }
};

export function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const color = eventTypeColor(booking.eventType);
  const balance = (booking.totalAmount || 0) - (booking.advancePaid || 0);
  const pill = statusPill(booking.status);
  const d = new Date(booking.eventDate);
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Pressable
      testID={`booking-card-${booking.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.badge, { backgroundColor: color + '22' }]}>
        <Ionicons name={iconFor(booking.eventType) as any} color={color} size={22} />
        <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
          {booking.eventType}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{booking.clientName}</Text>
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
        <View style={[styles.row, { marginTop: 4 }]}>
          <Ionicons name="calendar-outline" size={11} color={Colors.muted} />
          <Text style={styles.metaText}>{formatDate(booking.eventDate)}</Text>
          <Ionicons name="people-outline" size={11} color={Colors.muted} style={{ marginLeft: 8 }} />
          <Text style={styles.metaText}>{booking.guestCount}</Text>
          <View style={[styles.funcChip, { backgroundColor: booking.functionTime === 'Night' ? 'rgba(26,35,126,0.12)' : 'rgba(245,127,23,0.14)', marginLeft: 8 }]}>
            <Ionicons name={booking.functionTime === 'Night' ? 'moon' : 'sunny'} size={10} color={booking.functionTime === 'Night' ? '#3949AB' : '#F57F17'} />
            <Text style={[styles.funcText, { color: booking.functionTime === 'Night' ? '#3949AB' : '#F57F17' }]}>{booking.functionTime}</Text>
          </View>
        </View>
        <View style={[styles.row, { marginTop: 6, alignItems: 'center' }]}>
          <View style={[styles.money, { backgroundColor: Colors.success + '18' }]}>
            <Text style={[styles.moneyLbl, { color: Colors.success }]}>Adv </Text>
            <Text style={[styles.moneyVal, { color: Colors.success }]}>{formatINR(booking.advancePaid)}</Text>
          </View>
          <View style={[styles.money, { backgroundColor: (balance > 0 ? Colors.warning : Colors.success) + '18', marginLeft: 6 }]}>
            <Text style={[styles.moneyLbl, { color: balance > 0 ? Colors.warning : Colors.success }]}>Bal </Text>
            <Text style={[styles.moneyVal, { color: balance > 0 ? Colors.warning : Colors.success }]}>{formatINR(balance)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {days >= 0 && booking.status !== 'completed' && (
            <Text style={[styles.daysText, { color: days <= 2 ? Colors.warning : Colors.muted }]}>
              {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days}d`}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  badge: { width: 68, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  badgeText: { fontSize: 9, fontWeight: '700', marginTop: 4 },
  body: { flex: 1, padding: 12, paddingLeft: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 10, fontWeight: '700' },
  metaText: { fontSize: 12, color: Colors.muted, marginLeft: 4 },
  funcChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, gap: 3 },
  funcText: { fontSize: 10, fontWeight: '700' },
  money: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  moneyLbl: { fontSize: 10 },
  moneyVal: { fontSize: 11, fontWeight: '700' },
  daysText: { fontSize: 11, fontWeight: '600' },
});
