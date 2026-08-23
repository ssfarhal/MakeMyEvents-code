import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, eventTypeColor, formatINR, formatDate } from './theme';
import { Booking } from './api';
import { shareInvoice } from './invoice';

const eventIcon = (t: string): any => {
  switch ((t || '').toLowerCase()) {
    case 'wedding': return 'heart';
    case 'reception': return 'sparkles';
    case 'engagement': return 'diamond';
    case 'birthday': return 'gift';
    case 'corporate': return 'briefcase';
    default: return 'calendar';
  }
};

const statusMeta = (s: string) => {
  switch (s) {
    case 'confirmed': return { bg: Colors.successContainer, fg: Colors.success, label: 'Confirmed' };
    case 'pending': return { bg: Colors.warningContainer, fg: Colors.warning, label: 'Pending' };
    case 'completed': return { bg: '#F0F0F0', fg: '#6B7280', label: 'Completed' };
    case 'cancelled': return { bg: Colors.errorContainer, fg: Colors.error, label: 'Cancelled' };
    default: return { bg: '#F0F0F0', fg: '#6B7280', label: s };
  }
};

type Props = {
  booking: Booking | null;
  onClose: () => void;
  onEdit: (b: Booking) => void;
  onUpdate: (id: string, data: Partial<Booking>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function BookingDetailSheet({ booking, onClose, onEdit, onUpdate, onDelete }: Props) {
  if (!booking) return null;
  const total = booking.totalAmount || 0;
  const advance = booking.advancePaid || 0;
  const balance = total - advance;
  const color = eventTypeColor(booking.eventType);
  const status = statusMeta(booking.status);
  const isCancelled = booking.status === 'cancelled';
  const isCompleted = booking.status === 'completed';

  const callClient = async () => {
    if (!booking.phone) return;
    const url = `tel:+91${booking.phone}`;
    try { await Linking.openURL(url); } catch { Alert.alert('Cannot call', 'Phone is not supported on this device.'); }
  };

  const copyPhone = async () => {
    if (!booking.phone) return;
    await Clipboard.setStringAsync(booking.phone);
    Alert.alert('Copied', 'Phone number copied to clipboard');
  };

  const collectBalance = () => {
    if (balance <= 0) return;
    Alert.alert('Collect Balance', `Mark ₹${formatINR(balance)} as collected from ${booking.clientName}?`, [
      { text: 'Cancel' },
      { text: 'Confirm', onPress: async () => onUpdate(booking.id, { advancePaid: total }) },
    ]);
  };

  const markDone = async () => {
    await onUpdate(booking.id, { status: 'completed' });
    onClose();
  };

  const cancelBooking = () => {
    Alert.alert('Cancel Booking?', `Cancel booking for "${booking.clientName}"?`, [
      { text: 'Keep' },
      { text: 'Cancel Booking', style: 'destructive', onPress: async () => { await onUpdate(booking.id, { status: 'cancelled' }); } },
    ]);
  };

  const deleteBooking = () => {
    Alert.alert('Delete booking?', 'This cannot be undone.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await onDelete(booking.id); onClose(); } },
    ]);
  };

  const onInvoice = async () => {
    try { await shareInvoice(booking); }
    catch (e: any) { Alert.alert('Invoice error', e.message || 'Failed to generate invoice'); }
  };

  return (
    <Modal visible={!!booking} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.eventIcon, { backgroundColor: color + '22' }]}>
              <Ionicons name={eventIcon(booking.eventType)} size={22} color={color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name} numberOfLines={1}>{booking.clientName}</Text>
              <Text style={[styles.eventType, { color }]}>{booking.eventType}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6, marginLeft: 4 }} testID="close-detail-btn">
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Info grid */}
            <View style={styles.gridCard}>
              <View style={styles.gridRow}>
                <GridCell label="Event Date" value={formatDate(booking.eventDate)} />
                <View style={styles.vSep} />
                <GridCell label="Function Time" value={booking.functionTime === 'Night' ? '🌙 Night' : '☀️ Day'} />
              </View>
              <View style={styles.hSep} />
              <View style={styles.gridRow}>
                <GridCell label="Guest Count" value={`${booking.guestCount} guests`} />
                <View style={styles.vSep} />
                <GridCell label="Total Amount" value={`₹${formatINR(total)}`} accent color={color} />
              </View>
              <View style={styles.hSep} />
              <View style={styles.gridRow}>
                <GridCell label={balance > 0 ? 'Balance Due' : 'Payment'} value={balance > 0 ? `₹${formatINR(balance)}` : 'Fully Paid'} />
                <View style={styles.vSep} />
                <GridCell label="Booking ID" value={booking.id} />
              </View>
            </View>

            {/* Contact */}
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>+91 {booking.phone || 'N/A'}</Text>
              </View>
              <Pressable onPress={copyPhone} style={styles.contactBtn} testID="copy-phone-btn">
                <Ionicons name="copy-outline" size={16} color={Colors.primary} />
              </Pressable>
              <Pressable onPress={callClient} style={[styles.contactBtn, { backgroundColor: Colors.primary }]} testID="call-client-btn">
                <Ionicons name="call" size={16} color="#fff" />
              </Pressable>
            </View>

            {/* Payment summary */}
            <Text style={styles.sectionTitle}>Payment Summary</Text>
            <View style={styles.paymentCard}>
              <PayRow label="Total Amount" value={`₹${formatINR(total)}`} bold />
              <PayRow label="Advance Paid" value={`₹${formatINR(advance)}`} valueColor={Colors.success} />
              <View style={styles.paySep} />
              <PayRow label={balance > 0 ? 'Balance Due' : 'Status'} value={balance > 0 ? `₹${formatINR(balance)}` : 'Fully Paid ✓'} bold valueColor={balance > 0 ? Colors.warning : Colors.success} />
              {balance > 0 && !isCancelled && (
                <Pressable onPress={collectBalance} style={styles.collectBtn} testID="collect-balance-btn">
                  <Ionicons name="cash" size={16} color="#fff" />
                  <Text style={styles.collectText}>Collect Balance</Text>
                </Pressable>
              )}
            </View>

            {/* Notes */}
            {booking.notes ? (
              <>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{booking.notes}</Text>
                </View>
              </>
            ) : null}

            {/* Invoice */}
            <Pressable onPress={onInvoice} style={styles.invoiceBtn} testID="invoice-btn">
              <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
              <Text style={styles.invoiceText}>{Platform.OS === 'web' ? 'Print Invoice' : 'Share PDF Invoice'}</Text>
            </Pressable>

            {/* Actions */}
            {!isCancelled && !isCompleted && (
              <View style={styles.actionsRow}>
                <ActionBtn testID="edit-btn" icon="create-outline" label="Edit" color={Colors.primary} onPress={() => { onEdit(booking); onClose(); }} outline />
                <ActionBtn testID="cancel-btn" icon="close-circle-outline" label="Cancel" color={Colors.warning} onPress={cancelBooking} outline />
                <ActionBtn testID="done-btn" icon="checkmark-circle" label="Done" color={Colors.success} onPress={markDone} />
              </View>
            )}
            {(isCancelled || isCompleted) && (
              <Pressable onPress={deleteBooking} style={styles.deleteBtn} testID="delete-btn">
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.deleteText}>Delete Booking</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function GridCell({ label, value, accent, color }: any) {
  return (
    <View style={[styles.gridCell, accent && { backgroundColor: (color || Colors.primary) + '18' }]}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={[styles.gridValue, accent && { color: color || Colors.primary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PayRow({ label, value, bold, valueColor }: any) {
  return (
    <View style={styles.payRow}>
      <Text style={[styles.payLabel, bold && { fontWeight: '700', color: Colors.onSurface }]}>{label}</Text>
      <Text style={[styles.payValue, bold && { fontSize: 15 }, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function ActionBtn({ testID, icon, label, color, onPress, outline }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.actionBtn, outline ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color }]}>
      <Ionicons name={icon} size={16} color={outline ? color : '#fff'} />
      <Text style={[styles.actionText, { color: outline ? color : '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  eventIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: Colors.onSurface },
  eventType: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.outlineVariant },
  gridCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: Colors.outlineVariant, overflow: 'hidden', marginBottom: 20 },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, minHeight: 66, justifyContent: 'center' },
  gridLabel: { fontSize: 10, color: Colors.muted },
  gridValue: { fontSize: 13, fontWeight: '700', color: Colors.onSurface, marginTop: 4 },
  vSep: { width: 1, backgroundColor: Colors.outlineVariant },
  hSep: { height: 1, backgroundColor: Colors.outlineVariant },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 10, marginTop: 4, letterSpacing: 0.3 },
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 },
  contactLabel: { fontSize: 10, color: Colors.muted },
  contactValue: { fontSize: 14, fontWeight: '700', color: Colors.onSurface, marginTop: 2 },
  contactBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryContainer, marginLeft: 6 },
  paymentCard: { backgroundColor: Colors.surfaceVariant, borderRadius: 14, padding: 16, marginBottom: 20 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  payLabel: { fontSize: 13, color: Colors.onSurfaceVariant, fontWeight: '600' },
  payValue: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  paySep: { height: 1, backgroundColor: Colors.outlineVariant, marginVertical: 6 },
  collectBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10, marginTop: 12 },
  collectText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  notesBox: { backgroundColor: Colors.surfaceVariant, borderRadius: 12, padding: 14, marginBottom: 20 },
  notesText: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 20 },
  invoiceBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.primary, marginBottom: 12 },
  invoiceText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  actionText: { fontWeight: '700', fontSize: 13 },
  deleteBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.error },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
