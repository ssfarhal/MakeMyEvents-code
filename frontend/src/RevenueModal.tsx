import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, formatINRFull, formatDate } from './theme';
import { Booking } from './api';

type Period = 'month' | 'quarter' | 'six' | 'fy';

type Props = {
  visible: boolean;
  onClose: () => void;
  bookings: Booking[];
};

// Indian Financial Year: 1-Apr → 31-Mar
function fyRange(now = new Date()): { start: Date; end: Date } {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // months are 0-indexed; Apr=3
  return { start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31) };
}

function computeRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (period === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0), label: 'This Month' };
  }
  if (period === 'quarter') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0), label: 'Quarterly (last 3 months)' };
  }
  if (period === 'six') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0), label: 'Last 6 Months' };
  }
  const { start, end } = fyRange(now);
  return { start, end, label: `Annual — FY ${start.getFullYear()}-${(end.getFullYear() + '').slice(-2)}` };
}

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function RevenueModal({ visible, onClose, bookings }: Props) {
  const [period, setPeriod] = useState<Period>('fy');
  const { start, end, label } = useMemo(() => computeRange(period), [period]);
  const startISO = iso(start);
  const endISO = iso(end);

  const inRange = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled' && b.eventDate >= startISO && b.eventDate <= endISO),
    [bookings, startISO, endISO],
  );

  const revenue = inRange.reduce((s, b) => s + (b.advancePaid || 0), 0);
  const pending = inRange.reduce((s, b) => s + Math.max(0, (b.totalAmount || 0) - (b.advancePaid || 0)), 0);
  const totalValue = inRange.reduce((s, b) => s + (b.totalAmount || 0), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconWrap}><Ionicons name="wallet" size={20} color={Colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Revenue</Text>
              <Text style={styles.sub}>{label} • {formatDate(startISO)} → {formatDate(endISO)}</Text>
            </View>
            <Pressable onPress={onClose} testID="close-revenue-btn"><Ionicons name="close" size={22} color={Colors.muted} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator>
            <View style={styles.periodRow}>
              {[
                { k: 'month' as const, l: 'Monthly' },
                { k: 'quarter' as const, l: 'Quarterly' },
                { k: 'six' as const, l: '6 Months' },
                { k: 'fy' as const, l: 'Annual (FY)' },
              ].map((p) => (
                <Pressable key={p.k} onPress={() => setPeriod(p.k)} style={[styles.chip, { flexShrink: 0 }, period === p.k && { backgroundColor: Colors.primary }]} testID={`revenue-period-${p.k}`}>
                  <Text style={[styles.chipText, period === p.k && { color: '#fff' }]}>{p.l}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.kpiRow}>
              <KpiTile color={Colors.primary} bg={Colors.primaryContainer} icon="cash" label={'Revenue\nCollected'} value={formatINRFull(revenue)} />
              <KpiTile color={Colors.warning} bg={Colors.warningContainer} icon="wallet-outline" label={'Pending\nBalance'} value={formatINRFull(pending)} />
            </View>
            <View style={[styles.kpiRow, { marginTop: 10 }]}>
              <KpiTile color={Colors.secondary} bg={Colors.secondaryContainer} icon="calendar" label={'Bookings'} value={String(inRange.length)} />
              <KpiTile color={Colors.success} bg={Colors.successContainer} icon="stats-chart" label={'Booking\nValue'} value={formatINRFull(totalValue)} />
            </View>

            <Text style={styles.sectionTitle}>Bookings in this period</Text>
            {inRange.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ color: Colors.muted }}>No bookings in this range.</Text>
              </View>
            ) : (
              inRange.slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate)).map((b) => {
                const bal = (b.totalAmount || 0) - (b.advancePaid || 0);
                return (
                  <View key={b.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{b.clientName}</Text>
                      <Text style={styles.rowMeta}>{b.eventType} • {formatDate(b.eventDate)} • #{b.id}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.rowAmt, { color: Colors.success }]}>{formatINRFull(b.advancePaid || 0)}</Text>
                      {bal > 0 && <Text style={[styles.rowMeta, { color: Colors.warning }]}>Bal {formatINRFull(bal)}</Text>}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function KpiTile({ color, bg, icon, label, value }: any) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.outline, backgroundColor: Colors.surfaceVariant },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.outlineVariant },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '800', color: Colors.onSurface, marginTop: 10 },
  kpiLabel: { fontSize: 10, color: Colors.muted, marginTop: 2, lineHeight: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  rowMeta: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  rowAmt: { fontSize: 14, fontWeight: '800' },
});
