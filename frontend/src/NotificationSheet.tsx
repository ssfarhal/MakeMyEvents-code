import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, formatINRFull, formatDate, daysUntil } from './theme';
import { Booking } from './api';

type Props = {
  visible: boolean;
  onClose: () => void;
  bookings: Booking[];
  ownerName?: string;
  onOpenBooking: (b: Booking) => void;
};

export function overdueBookings(bookings: Booking[]): Booking[] {
  return bookings
    .filter((b) => b.status !== 'cancelled' && (b.totalAmount || 0) - (b.advancePaid || 0) > 0 && daysUntil(b.eventDate) < 0)
    .slice()
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export default function NotificationSheet({ visible, onClose, bookings, ownerName, onOpenBooking }: Props) {
  const overdue = overdueBookings(bookings);
  const displayName = (ownerName || 'Owner').split(' ')[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Pending Payments</Text>
              <Text style={styles.sub}>{overdue.length} event{overdue.length !== 1 ? 's' : ''} with unpaid balance after event date</Text>
            </View>
            <Pressable onPress={onClose} testID="close-notifications-btn"><Ionicons name="close" size={22} color={Colors.muted} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 30 }}>
            {overdue.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-circle" size={40} color={Colors.success} />
                <Text style={styles.emptyTitle}>You&apos;re all caught up 🎉</Text>
                <Text style={styles.emptySub}>No overdue payments right now.</Text>
              </View>
            ) : (
              overdue.map((b) => {
                const balance = (b.totalAmount || 0) - (b.advancePaid || 0);
                return (
                  <Pressable
                    key={b.id}
                    testID={`notif-${b.id}`}
                    onPress={() => { onClose(); setTimeout(() => onOpenBooking(b), 120); }}
                    style={styles.card}
                  >
                    <View style={styles.cardDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardMsg}>
                        Hi {displayName}, there is a pending amount of{' '}
                        <Text style={{ color: Colors.warning, fontWeight: '800' }}>{formatINRFull(balance)}</Text>
                        {' '}by <Text style={{ fontWeight: '800' }}>{b.clientName}</Text>. If collected, please update in Collect Payment.
                      </Text>
                      <Text style={styles.cardMeta}>{b.eventType} • Event was {formatDate(b.eventDate)} • #{b.id}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 24, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.warningContainer, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.onSurface },
  emptySub: { fontSize: 12, color: Colors.muted },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warningContainer, borderLeftWidth: 3, borderLeftColor: Colors.warning, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, marginRight: 10 },
  cardMsg: { fontSize: 13, color: Colors.onSurface, lineHeight: 19 },
  cardMeta: { fontSize: 11, color: Colors.muted, marginTop: 4 },
});
