import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, formatDate, formatINRFull } from './theme';
import { Booking } from './api';
import { shareReport } from './invoice';

type Props = {
  visible: boolean;
  onClose: () => void;
  bookings: Booking[];
  hallName?: string;
  hallAddress?: string;
  ownerName?: string;
  ownerPhone?: string;
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const endOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0); };

export default function ReportModal({ visible, onClose, bookings, hallName, hallAddress, ownerName, ownerPhone }: Props) {
  const [start, setStart] = useState<Date>(startOfMonth());
  const [end, setEnd] = useState<Date>(endOfMonth());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  const startISO = toISODate(start);
  const endISO = toISODate(end);

  const inRange = bookings.filter((b) => b.eventDate >= startISO && b.eventDate <= endISO);
  const totalRevenue = inRange.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalAdvance = inRange.reduce((s, b) => s + (b.advancePaid || 0), 0);
  const totalBalance = totalRevenue - totalAdvance;

  const applyPreset = (preset: 'this-month' | 'last-month' | 'last-3' | 'this-year') => {
    const now = new Date();
    if (preset === 'this-month') { setStart(startOfMonth()); setEnd(endOfMonth()); return; }
    if (preset === 'last-month') {
      setStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      setEnd(new Date(now.getFullYear(), now.getMonth(), 0));
      return;
    }
    if (preset === 'last-3') {
      setStart(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      setEnd(endOfMonth());
      return;
    }
    if (preset === 'this-year') {
      setStart(new Date(now.getFullYear(), 0, 1));
      setEnd(new Date(now.getFullYear(), 11, 31));
    }
  };

  const generate = async () => {
    if (startISO > endISO) { Alert.alert('Invalid range', 'Start date must be before end date.'); return; }
    setBusy(true);
    try { await shareReport(bookings, startISO, endISO, { hallName, hallAddress, ownerName, ownerPhone }); }
    catch (e: any) { Alert.alert('Report error', e.message || 'Failed to generate PDF'); }
    finally { setBusy(false); }
  };

  const onStartChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowStart(false);
    if (event.type === 'dismissed') return;
    if (selected) setStart(selected);
  };
  const onEndChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowEnd(false);
    if (event.type === 'dismissed') return;
    if (selected) setEnd(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconWrap}><Ionicons name="document-text" size={20} color={Colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Booking Report</Text>
              <Text style={styles.sub}>Download a PDF of all bookings in a date range</Text>
            </View>
            <Pressable onPress={onClose} testID="close-report-btn"><Ionicons name="close" size={22} color={Colors.muted} /></Pressable>
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <Text style={styles.label}>Date Range</Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setShowStart(true)} style={styles.dateBtn} testID="report-start-date">
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.dateHint}>From</Text>
                  <Text style={styles.dateVal}>{formatDate(startISO)}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setShowEnd(true)} style={styles.dateBtn} testID="report-end-date">
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.dateHint}>To</Text>
                  <Text style={styles.dateVal}>{formatDate(endISO)}</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.presetRow}>
              {[
                { key: 'this-month' as const, label: 'This month' },
                { key: 'last-month' as const, label: 'Last month' },
                { key: 'last-3' as const, label: 'Last 3 mo' },
                { key: 'this-year' as const, label: 'This year' },
              ].map((p) => (
                <Pressable key={p.key} onPress={() => applyPreset(p.key)} style={styles.presetChip} testID={`report-preset-${p.key}`}>
                  <Text style={styles.presetText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.summary}>
              <SummaryRow label="Bookings" value={String(inRange.length)} />
              <SummaryRow label="Total Revenue" value={formatINRFull(totalRevenue)} bold />
              <SummaryRow label="Advance Received" value={formatINRFull(totalAdvance)} color={Colors.success} />
              <SummaryRow label="Pending Balance" value={formatINRFull(totalBalance)} color={totalBalance > 0 ? Colors.warning : Colors.success} />
            </View>

            <Pressable onPress={generate} disabled={busy} style={[styles.generate, busy && { opacity: 0.6 }]} testID="generate-report-btn">
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.generateText}>{Platform.OS === 'web' ? 'Print / Save PDF' : 'Download PDF Report'}</Text>
                </>
              )}
            </Pressable>
          </View>

          {showStart && (
            Platform.OS === 'ios' ? (
              <Modal visible transparent animationType="fade" onRequestClose={() => setShowStart(false)}>
                <View style={styles.iosBackdrop}>
                  <View style={styles.iosSheet}>
                    <View style={styles.iosHeader}>
                      <Pressable onPress={() => setShowStart(false)}><Text style={{ color: Colors.muted, fontWeight: '700' }}>Cancel</Text></Pressable>
                      <Pressable onPress={() => setShowStart(false)}><Text style={{ color: Colors.primary, fontWeight: '800' }}>Done</Text></Pressable>
                    </View>
                    <DateTimePicker value={start} mode="date" display="spinner" onChange={onStartChange} />
                  </View>
                </View>
              </Modal>
            ) : (<DateTimePicker value={start} mode="date" display="default" onChange={onStartChange} />)
          )}
          {showEnd && (
            Platform.OS === 'ios' ? (
              <Modal visible transparent animationType="fade" onRequestClose={() => setShowEnd(false)}>
                <View style={styles.iosBackdrop}>
                  <View style={styles.iosSheet}>
                    <View style={styles.iosHeader}>
                      <Pressable onPress={() => setShowEnd(false)}><Text style={{ color: Colors.muted, fontWeight: '700' }}>Cancel</Text></Pressable>
                      <Pressable onPress={() => setShowEnd(false)}><Text style={{ color: Colors.primary, fontWeight: '800' }}>Done</Text></Pressable>
                    </View>
                    <DateTimePicker value={end} mode="date" display="spinner" onChange={onEndChange} />
                  </View>
                </View>
              </Modal>
            ) : (<DateTimePicker value={end} mode="date" display="default" onChange={onEndChange} />)
          )}
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value, bold, color }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontSize: 15 }, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, marginTop: 4, marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.outline, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  dateHint: { fontSize: 10, color: Colors.muted },
  dateVal: { fontSize: 13, fontWeight: '700', color: Colors.onSurface, marginTop: 2 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.primaryContainer },
  presetText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  summary: { backgroundColor: Colors.surfaceVariant, borderRadius: 14, padding: 14, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 12, color: Colors.onSurfaceVariant, fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  generate: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15 },
  generateText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  iosBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  iosSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  iosHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
});
