import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, eventTypeColor, formatDate, formatINRFull, toLocalISODate } from './theme';
import { Booking, ChargeItem } from './api';

const EVENT_TYPES = ['Wedding', 'Reception', 'Engagement', 'Birthday', 'Corporate', 'Other'];

// Arial Black — mapped to closest native equivalents per platform.
const ARIAL_BLACK = Platform.select<string | undefined>({
  ios: 'Arial-Black',
  android: 'sans-serif-black',
  web: 'Arial Black, Arial, sans-serif',
  default: undefined,
}) as string | undefined;

const FIXED_CHARGES: { label: string; icon: any }[] = [
  { label: 'Hall Rent', icon: 'business-outline' },
  { label: 'Labor Charges', icon: 'people-circle-outline' },
  { label: 'Electricity Charges', icon: 'flash-outline' },
  { label: 'Maintenance Fee', icon: 'construct-outline' },
];

const EXTRA_SLOTS = 3;

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
  const [customEventName, setCustomEventName] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [functionTime, setFunctionTime] = useState<'Day' | 'Night'>('Day');
  const [guestCount, setGuestCount] = useState('');
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, string>>({});
  const [extraCharges, setExtraCharges] = useState<{ label: string; amount: string }[]>([]);
  const [advancePaid, setAdvancePaid] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setClientName(existing?.clientName || '');
      setPhone(existing?.phone || '');
      const et = existing?.eventType || 'Wedding';
      const isStd = EVENT_TYPES.includes(et);
      setEventType(isStd ? et : 'Other');
      setCustomEventName(isStd ? '' : et);
      setDate(existing?.eventDate ? new Date(existing.eventDate) : (prefillDate || null));
      setFunctionTime((existing?.functionTime as any) || 'Day');
      setGuestCount(existing ? String(existing.guestCount) : '');
      setAdvancePaid(existing ? String(existing.advancePaid || 0) : '');
      setNotes(existing?.notes || '');

      // Rehydrate charges
      const fixedInit: Record<string, string> = {};
      FIXED_CHARGES.forEach((c) => { fixedInit[c.label] = ''; });
      const extraInit: { label: string; amount: string }[] = Array.from({ length: EXTRA_SLOTS }, () => ({ label: '', amount: '' }));

      const savedCharges = existing?.charges || [];
      if (savedCharges.length > 0) {
        const fixedLabels = FIXED_CHARGES.map((c) => c.label);
        let extraIdx = 0;
        for (const c of savedCharges) {
          if (fixedLabels.includes(c.label)) {
            fixedInit[c.label] = c.amount ? String(c.amount) : '';
          } else if (extraIdx < EXTRA_SLOTS) {
            extraInit[extraIdx] = { label: c.label || '', amount: c.amount ? String(c.amount) : '' };
            extraIdx += 1;
          }
        }
      } else if (existing && existing.totalAmount) {
        // Legacy booking: seed Hall Rent with the existing total so edit doesn't lose data
        fixedInit['Hall Rent'] = String(existing.totalAmount);
      }
      setFixedAmounts(fixedInit);
      setExtraCharges(extraInit);
    }
  }, [visible, existing, prefillDate]);

  const totalAmount = useMemo(() => {
    let sum = 0;
    for (const c of FIXED_CHARGES) sum += parseFloat(fixedAmounts[c.label] || '0') || 0;
    for (const e of extraCharges) sum += parseFloat(e.amount || '0') || 0;
    return sum;
  }, [fixedAmounts, extraCharges]);

  const finalEventType = eventType === 'Other' ? (customEventName.trim() || 'Other') : eventType;
  const isValid = clientName.trim() && phone.trim().length >= 10 && date && totalAmount > 0 && (eventType !== 'Other' || customEventName.trim());

  const setFixedAmount = (label: string, val: string) => {
    setFixedAmounts((prev) => ({ ...prev, [label]: val.replace(/[^0-9.]/g, '') }));
  };
  const setExtraLabel = (idx: number, val: string) => {
    setExtraCharges((prev) => prev.map((it, i) => (i === idx ? { ...it, label: val } : it)));
  };
  const setExtraAmount = (idx: number, val: string) => {
    setExtraCharges((prev) => prev.map((it, i) => (i === idx ? { ...it, amount: val.replace(/[^0-9.]/g, '') } : it)));
  };

  const submit = async () => {
    if (!isValid || !date) {
      Alert.alert('Missing info', 'Fill client, phone, date and at least one charge amount.');
      return;
    }
    setBusy(true);
    try {
      const charges: ChargeItem[] = [];
      for (const c of FIXED_CHARGES) {
        const amt = parseFloat(fixedAmounts[c.label] || '0') || 0;
        if (amt > 0) charges.push({ label: c.label, amount: amt });
      }
      for (const e of extraCharges) {
        const amt = parseFloat(e.amount || '0') || 0;
        const label = e.label.trim();
        if (amt > 0 && label) charges.push({ label, amount: amt });
      }
      await onSubmit({
        clientName: clientName.trim(),
        phone: phone.trim(),
        eventType: finalEventType,
        eventDate: toLocalISODate(date),
        functionTime,
        guestCount: parseInt(guestCount || '0', 10),
        totalAmount,
        advancePaid: parseFloat(advancePaid || '0'),
        notes: notes.trim(),
        charges,
      } as any);
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} testID="close-booking-sheet" style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>{existing ? 'Edit Booking' : 'New Booking'}</Text>
          <View style={{ width: 36 }} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
          >
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
            {eventType === 'Other' && (
              <Field
                icon="pricetag-outline"
                placeholder="Which event? (e.g. Sangeet, Baby Shower) *"
                value={customEventName}
                onChangeText={setCustomEventName}
                testID="input-customEventName"
              />
            )}

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
            <Text style={styles.helperText}>Enter each charge below — Total Amount adds up automatically.</Text>

            {FIXED_CHARGES.map((c) => (
              <Field
                key={c.label}
                icon={c.icon}
                placeholder={`${c.label} (₹)`}
                value={fixedAmounts[c.label] || ''}
                onChangeText={(v: string) => setFixedAmount(c.label, v)}
                keyboardType="decimal-pad"
                testID={`input-${c.label.replace(/\s+/g, '')}`}
              />
            ))}

            <Text style={styles.subLabel}>Additional Charges (optional)</Text>
            {extraCharges.map((row, idx) => (
              <View key={idx} style={styles.extraRow}>
                <View style={[fs.wrap, { flex: 1.2, marginRight: 8, marginBottom: 0 }]}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.onSurfaceVariant} style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder={`Charge ${idx + 1} name`}
                    placeholderTextColor={Colors.muted}
                    style={fs.input}
                    value={row.label}
                    onChangeText={(v) => setExtraLabel(idx, v)}
                    testID={`input-extraLabel-${idx}`}
                  />
                </View>
                <View style={[fs.wrap, { flex: 1, marginBottom: 0 }]}>
                  <Text style={{ color: Colors.onSurfaceVariant, marginRight: 6, fontWeight: '700' }}>₹</Text>
                  <TextInput
                    placeholder="Amount"
                    placeholderTextColor={Colors.muted}
                    style={fs.input}
                    value={row.amount}
                    onChangeText={(v) => setExtraAmount(idx, v)}
                    keyboardType="decimal-pad"
                    testID={`input-extraAmount-${idx}`}
                  />
                </View>
              </View>
            ))}

            <View style={styles.totalCard} testID="computed-totalAmount">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cash-outline" size={20} color={Colors.primary} />
                <Text style={styles.totalLabel}>Total Amount</Text>
              </View>
              <Text style={styles.totalValue}>{formatINRFull(totalAmount)}</Text>
            </View>

            <Field icon="wallet-outline" placeholder="Advance Paid (₹)" value={advancePaid} onChangeText={(v: string) => setAdvancePaid(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" testID="input-advancePaid" />

            <Text style={styles.section}>Additional Notes</Text>
            <Field icon="document-text-outline" placeholder="Notes / Special Requirements" value={notes} onChangeText={setNotes} multiline testID="input-notes" />

            <Pressable testID="submit-booking-btn" onPress={submit} disabled={busy} style={({ pressed }) => [styles.submit, pressed && { opacity: 0.9 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{existing ? 'Update Booking' : 'Confirm Booking'}</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.outline },
  input: { flex: 1, fontSize: 15, color: Colors.onSurface, padding: 0, fontFamily: ARIAL_BLACK, fontWeight: '900' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, backgroundColor: '#fff' },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: Colors.onSurface, textAlign: 'center', fontFamily: ARIAL_BLACK },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  section: { fontSize: 14, fontWeight: '900', color: Colors.primary, marginTop: 10, marginBottom: 6, letterSpacing: 0.4, fontFamily: ARIAL_BLACK, textTransform: 'uppercase' },
  helperText: { fontSize: 13, color: Colors.muted, marginBottom: 8, fontFamily: ARIAL_BLACK, fontWeight: '900' },
  subLabel: { fontSize: 14, fontWeight: '900', color: Colors.onSurfaceVariant, marginTop: 4, marginBottom: 6, letterSpacing: 0.3, fontFamily: ARIAL_BLACK },
  extraRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  totalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary + '10', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + '33' },
  totalLabel: { fontSize: 16, fontWeight: '900', color: Colors.primary, marginLeft: 8, fontFamily: ARIAL_BLACK },
  totalValue: { fontSize: 20, fontWeight: '900', color: Colors.primary, fontFamily: ARIAL_BLACK },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: Colors.outline, backgroundColor: Colors.surfaceVariant },
  typeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  typeText: { fontSize: 13, fontWeight: '900', color: Colors.onSurfaceVariant, fontFamily: ARIAL_BLACK },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.outline, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  dateText: { flex: 1, fontSize: 15, color: Colors.onSurface, fontWeight: '900', fontFamily: ARIAL_BLACK },
  dayNight: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  funcBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.outline, backgroundColor: Colors.surfaceVariant },
  funcBtnText: { fontSize: 14, fontWeight: '900', color: Colors.onSurfaceVariant, fontFamily: ARIAL_BLACK },
  submit: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '900', fontFamily: ARIAL_BLACK, letterSpacing: 0.5 },
  iosPickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosPicker: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
});
