import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  save: () => void;
  busy: boolean;
};

export default function SettingsBottomSheet({ visible, onClose, name, setName, save, busy }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconWrap}><Ionicons name="business" size={20} color={Colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Business Settings</Text>
              <Text style={styles.sub}>This name appears on every invoice</Text>
            </View>
            <Pressable onPress={onClose} testID="close-settings-btn"><Ionicons name="close" size={22} color={Colors.muted} /></Pressable>
          </View>

          <Text style={styles.label}>Hall / Convention Name</Text>
          <TextInput
            testID="hall-name-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Bharath Convention Hall"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            autoFocus
          />
          <Text style={styles.hint}>Tip: this name is shown at the top of the PDF invoice you share with clients.</Text>

          <Pressable onPress={save} disabled={busy || !name.trim()} style={[styles.save, (busy || !name.trim()) && { opacity: 0.6 }]} testID="save-hall-name-btn">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, marginBottom: 8 },
  input: { backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.onSurface, borderWidth: 1, borderColor: Colors.outline },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 8, lineHeight: 16 },
  save: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
