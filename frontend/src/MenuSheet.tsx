import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme';

export type MenuItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  destructive?: boolean;
  hidden?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  hallName?: string;
  ownerName?: string;
  ownerEmail?: string;
};

export default function MenuSheet({ visible, onClose, items, hallName, ownerName, ownerEmail }: Props) {
  const shown = items.filter((i) => !i.hidden);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Ionicons name="business" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.hallName} numberOfLines={1}>{hallName || 'MakeMyEvents'}</Text>
              <Text style={styles.email} numberOfLines={1}>{ownerName || ownerEmail || 'Owner'}</Text>
            </View>
            <Pressable onPress={onClose} testID="close-menu-btn" style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScrollView contentContainerStyle={{ paddingVertical: 4 }}>
            {shown.map((item) => (
              <Pressable
                key={item.key}
                testID={`menu-item-${item.key}`}
                onPress={() => { onClose(); setTimeout(item.onPress, 120); }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.rowIcon, item.destructive && { backgroundColor: Colors.errorContainer }]}>
                  <Ionicons name={item.icon} size={18} color={item.destructive ? Colors.error : Colors.primary} />
                </View>
                <Text style={[styles.rowLabel, item.destructive && { color: Colors.error }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.footer}>MakeMyEvents • Owner portal</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: 32, maxHeight: '75%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC' },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  avatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  hallName: { fontSize: 16, fontWeight: '800', color: Colors.onSurface },
  email: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: Colors.outlineVariant, marginHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  rowPressed: { backgroundColor: Colors.surfaceVariant },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.onSurface },
  footer: { textAlign: 'center', fontSize: 10, color: Colors.muted, marginTop: 8 },
});
