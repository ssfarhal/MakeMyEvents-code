import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Platform, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, formatDate, formatINRFull, toLocalISODate } from './theme';
import { Booking } from './api';
import { computeFinancialSummary, shareFinancialReport } from './invoice';

type Props = {
  visible: boolean;
  onClose: () => void;
  bookings: Booking[];
  hallName?: string;
  hallAddress?: string;
  ownerName?: string;
  ownerPhone?: string;
};

const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const endOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0); };

export default function FinancialDetailsModal({ visible, onClose, bookings, hallName, hallAddress, ownerName, ownerPhone }: Props) {
  const [start, setStart] = useState<Date>(startOfMonth());
  const [end, setEnd] = useState<Date>(endOfMonth());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  const startISO = toLocalISODate(start);
  const endISO = toLocalISODate(end);

  const summary = useMemo(() => computeFinancialSummary(bookings, startISO, endISO), [bookings, startISO, endISO]);
  const isProfit = summary.netProfit >= 0;

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
    try { await shareFinancialReport(bookings, startISO, endISO, { hallName, hallAddress, ownerName, ownerPhone }); }
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
            <View style={styles.iconWrap}><Ionicons name="analytics" size={20} color={Colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Financial Details</Text>
              <Text style={styles.sub}>Income, expenditures & net profit report</Text>
            </View>
            <Pressable onPress={onClose} testID="close-financial-btn"><Ionicons name="close" size={22} color={Colors.muted} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Date Range</Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setShowStart(true)} style={styles.dateBtn} testID="financial-start-date">
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.dateHint}>From</Text>
                  <Text style={styles.dateVal}>{formatDate(startISO)}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setShowEnd(true)} style={styles.dateBtn} testID="financial-end-date">
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
                <Pressable key={p.key} onPress={() => applyPreset(p.key)} style={styles.presetChip} testID={`financial-preset-${p.key}`}>
                  <Text style={styles.presetText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Income */}
            <View style={[styles.card, { borderColor: Colors.success + '55' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="trending-up" size={16} color={Colors.success} />
                <Text style={[styles.cardTitle, { color: Colors.success }]}>Income (Hall Rent)</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Bookings</Text>
                <Text style={styles.rowValue}>{summary.bookingCount}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Hall Rent</Text>
                <Text style={[styles.rowValue, styles.strong, { color: Colors.success }]}>{formatINRFull(summary.income)}</Text>
              </View>
            </View>

            {/* Expenditure */}
            <View style={[styles.card, { borderColor: Colors.warning + '55' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="trending-down" size={16} color={Colors.warning} />
                <Text style={[styles.cardTitle, { color: Colors.warning }]}>Expenditure by Category</Text>
              </View>
              {summary.expenditureByCategory.length === 0 ? (
                <Text style={styles.emptyRow}>No expenditure entries in this range.</Text>
              ) : (
                summary.expenditureByCategory.map((e) => (
                  <View key={e.label} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{e.label}</Text>
                    <Text style={styles.rowValue}>{formatINRFull(e.amount)}</Text>
                  </View>
                ))
              )}
              <View style={[styles.row, styles.rowSep]}>
                <Text style={[styles.rowLabel, styles.strong]}>Total Expenditure</Text>
                <Text style={[styles.rowValue, styles.strong, { color: Colors.warning }]}>{formatINRFull(summary.totalExpenditure)}</Text>
              </View>
            </View>

            {/* Net Profit */}
            <View style={[styles.netCard, { backgroundColor: (isProfit ? Colors.success : Colors.error) + '15', borderColor: (isProfit ? Colors.success : Colors.error) + '55' }]}>
              <View>
                <Text style={[styles.netLabel, { color: isProfit ? Colors.success : Colors.error }]}>{isProfit ? 'Net Profit' : 'Net Loss'}</Text>
                <Text style={styles.netSub}>Income − Expenditure</Text>
              </View>
              <Text style={[styles.netValue, { color: isProfit ? Colors.success : Colors.error }]}>
                {isProfit ? '' : '- '}{formatINRFull(Math.abs(summary.netProfit))}
              </Text>
            </View>

            <Pressable onPress={generate} disabled={busy} style={[styles.generate, busy && { opacity: 0.6 }]} testID="generate-financial-btn">
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.generateText}>{Platform.OS === 'web' ? 'Print / Save PDF' : 'Download Financial Report'}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>

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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '92%' },
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
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowSep: { borderTopWidth: 1, borderTopColor: Colors.outlineVariant, marginTop: 6, paddingTop: 10 },
  rowLabel: { fontSize: 13, color: Colors.onSurfaceVariant, flex: 1, marginRight: 8 },
  rowValue: { fontSize: 13, color: Colors.onSurface, fontWeight: '700' },
  strong: { fontWeight: '800' },
  emptyRow: { fontSize: 12, color: Colors.muted, textAlign: 'center', paddingVertical: 8 },
  netCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 16 },
  netLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  netSub: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  netValue: { fontSize: 20, fontWeight: '900' },
  generate: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15 },
  generateText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  iosBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  iosSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  iosHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
});
