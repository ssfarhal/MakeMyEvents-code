import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme';

type Props = {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyState({ icon = 'reader-outline', title, subtitle, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBg}>
        <Ionicons name={icon} size={40} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {ctaLabel && onCta ? (
        <Pressable onPress={onCta} style={styles.cta} testID="empty-state-cta">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={sk.card}>
      <View style={sk.badge} />
      <View style={{ flex: 1, padding: 12, gap: 8 }}>
        <View style={[sk.bar, { width: '70%' }]} />
        <View style={[sk.bar, { width: '45%', height: 10 }]} />
        <View style={[sk.bar, { width: '85%', height: 10 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 8 },
  iconBg: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.onSurface, textAlign: 'center' },
  sub: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const sk = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', height: 96 },
  badge: { width: 68, backgroundColor: Colors.outlineVariant },
  bar: { height: 14, backgroundColor: Colors.outlineVariant, borderRadius: 6 },
});
