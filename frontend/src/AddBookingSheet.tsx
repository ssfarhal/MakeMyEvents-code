import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, eventTypeColor, formatDate } from './theme';
import { Booking } from './api';

const EVENT_TYPES = ['Wedding', 'Reception', 'Engagement', 'Birthday', 'Corporate', 'Other'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Booking>) => Promise<void>;
  existing?: Booking | null;
  prefillDate?: Date | null;
};

export default function AddBookingSheet({ visible, onClose, onSubmit, existing, prefillDate }: Props) {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState('Wedding');
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [functionTime, setFunctionTime] = useState<'Day' | 'Night'>('Day');
  const [guestCount, setGuestCount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setClientName(existing?.clientName || '');
      setPhone(existing?.phone || '');
      setEventType(existing?.eventType || 'Wedding');
      setDate(existing?.eventDate ? new Date(existing.eventDate) : (prefillDate || null));
      setFunctionTime((existing?.functionTime as any) || 'Day');
      setGuestCount(existing ? String(existing.guestCount) : '');
      setTotalAmount(existing ? String(existing.totalAmount) : '');
      setAdvancePaid(existing ? String(existing.advancePaid || 0) : '');
      setNotes(existing?.notes || '');
    }
  }, [visible, existing, prefillDate]);

  const isValid = clientName.trim() && phone.trim().length >= 10 && date && totalAmount;

  const submit = async () => {
    if (!isValid || !date) {
      Alert.alert('Missing info', 'Fill client, phone, date and total amount.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        phone: phone.trim(),
        eventType,
        eventDate: date.toISOString().slice(0, 10),
        functionTime,
        guestCount: parseInt(guestCount || '0', 10),
        totalAmount: parseFloat(totalAmount || '0'),
        advancePaid: parseFloat(advancePaid || '0'),
        notes: notes.trim(),
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally { setBusy(false); }
  };

  const onDateChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setDate(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{existing ? 'Edit Booking' : 'New Booking'}</Text>
            <Pressable onPress={onClose} testID="close-booking-sheet"><Ionicons name="close" size={22} color={Colors.onSurfaceVariant} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>Client Details</Text>
            <Field icon="person-outline" placeholder="Client Name *" value={clientName} onChangeText={setClientName} testID="input-clientName" />
            <Field icon="call-outline" placeholder="Phone (10 digits) *" value={phone} onChangeText={(v: string) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" testID="input-phone" />

            <Text style={styles.section}>Event Details</Text>
            <View style={styles.chipsRow}>
              {EVENT_TYPES.map((t) => {
                const active = eventType === t;
                const c = eventTypeColor(t);
                return (
                  <Pressable key={t} onPress={() => setEventType(t)} style={[styles.typeChip, active && { backgroundColor: c, borderColor: c }]}>
                    <View style={[styles.typeDot, { backgroundColor: active ? '#fff' : c }]} />
                    <Text style={[styles.typeText, active && { color: '#fff' }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn} testID="open-date-picker">
              <Ionicons name="calendar-outline" size={18} color={Colors.onSurfaceVariant} />
              <Text style={[styles.dateText, !date && { color: Colors.muted }]}>
                {date ? formatDate(date.toISOString()) : 'Select Event Date *'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
            {showDatePicker && (
              Platform.OS === 'ios' ? (
                <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                  <View style={styles.iosPickerBackdrop}>
                    <View style={styles.iosPicker}>
                      <View style={styles.iosPickerHeader}>
                        <Pressable onPress={() => setShowDatePicker(false)}><Text style={{ color: Colors.muted, fontWeight: '700' }}>Cancel</Text></Pressable>
                        <Pressable onPress={() => setShowDatePicker(false)}><Text style={{ color: Colors.primary, fontWeight: '800' }}>Done</Text></Pressable>
                      </View>
                      <DateTimePicker
                        value={date || new Date()}
                        mode="date"
                        display="spinner"
                        minimumDate={new Date()}
                        onChange={onDateChange}
                      />
                    </View>
                  </View>
                </Modal>
              ) : (
                <DateTimePicker
                  value={date || new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={onDateChange}
                />
              )
            )}

            <View style={styles.dayNight}>
              {(['Day', 'Night'] as const).map((f) => (
                <Pressable key={f} onPress={() => setFunctionTime(f)} style={[styles.funcBtn, functionTime === f && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                  <Ionicons name={f === 'Day' ? 'sunny' : 'moon'} size={16} color={functionTime === f ? '#fff' : Colors.onSurfaceVariant} />
                  <Text style={[styles.funcBtnText, functionTime === f && { color: '#fff' }]}>{f} Function</Text>
                </Pressable>
              ))}
            </View>
            <Field icon="people-outline" placeholder="Expected Guest Count" value={guestCount} onChangeText={(v: string) => setGuestCount(v.replace(/\D/g, ''))} keyboardType="number-pad" testID="input-guestCount" />

            <Text style={styles.section}>Financial Details</Text>
            <Field icon="cash-outline" placeholder="Total Amount (₹) *" value={totalAmount} onChangeText={(v: string) => setTotalAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" testID="input-totalAmount" />
            <Field icon="wallet-outline" placeholder="Advance Paid (₹)" value={advancePaid} onChangeText={(v: string) => setAdvancePaid(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" testID="input-advancePaid" />

            <Text style={styles.section}>Additional Notes</Text>
            <Field icon="document-text-outline" placeholder="Notes / Special Requirements" value={notes} onChangeText={setNotes} multiline testID="input-notes" />

            <Pressable testID="submit-booking-btn" onPress={submit} disabled={busy} style={({ pressed }) => [styles.submit, pressed && { opacity: 0.9 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{existing ? 'Update Booking' : 'Confirm Booking'}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field(props: any) {
  return (
    <View style={fs.wrap}>
      <Ionicons name={props.icon} size={18} color={Colors.onSurfaceVariant} style={{ marginRight: 10 }} />
      <TextInput {...props} placeholderTextColor={Colors.muted} style={[fs.input, props.multiline && { minHeight: 68 }]} />
    </View>
  );
}

const fs = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.outline },
  input: { flex: 1, fontSize: 14, color: Colors.onSurface, padding: 0 },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  section: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginTop: 8, marginBottom: 8, letterSpacing: 0.3 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.outline, backgroundColor: Colors.surfaceVariant },
  typeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  typeText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.outline, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  dateText: { flex: 1, fontSize: 14, color: Colors.onSurface, fontWeight: '600' },
  dayNight: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  funcBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.outline, backgroundColor: Colors.surfaceVariant },
  funcBtnText: { fontSize: 13, fontWeight: '700', color: Colors.onSurfaceVariant },
  submit: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iosPickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosPicker: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
});
