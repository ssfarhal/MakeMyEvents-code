import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialName?: string;
  initialAddress?: string;
  initialPhone?: string;
  initialOwnerName?: string;
  onSave: (data: { hallName: string; hallAddress: string; ownerName: string; ownerPhone: string }) => Promise<void>;
};

export default function SettingsBottomSheet({ visible, onClose, initialName, initialAddress, initialPhone, initialOwnerName, onSave }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(initialName || '');
      setAddress(initialAddress || '');
      setPhone(initialPhone || '');
      setOwnerName(initialOwnerName || '');
    }
  }, [visible, initialName, initialAddress, initialPhone, initialOwnerName]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave({ hallName: name.trim(), hallAddress: address.trim(), ownerName: ownerName.trim(), ownerPhone: phone.trim() });
      onClose();
    } catch (e) { console.warn(e); }
    finally { setBusy(false); }
  };

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
              <Text style={styles.sub}>These details appear at the top of every invoice</Text>
            </View>
            <Pressable onPress={onClose} testID="close-settings-btn"><Ionicons name="close" size={22} color={Colors.muted} /></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Hall / Convention Name *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="business-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                testID="hall-name-input"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Bharath Convention Hall"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Convention Hall Address</Text>
            <View style={[styles.inputWrap, { minHeight: 72, alignItems: 'flex-start' }]}>
              <Ionicons name="location-outline" size={16} color={Colors.muted} style={{ marginRight: 8, marginTop: 4 }} />
              <TextInput
                testID="hall-address-input"
                value={address}
                onChangeText={setAddress}
                placeholder="Street, Area, City, PIN"
                placeholderTextColor={Colors.muted}
                style={[styles.input, { minHeight: 60 }]}
                multiline
              />
            </View>

            <Text style={styles.label}>Owner Name</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                testID="owner-name-input"
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={Colors.muted}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Owner Phone Number</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                testID="owner-phone-input"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9+ ]/g, '').slice(0, 15))}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={Colors.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            <Text style={styles.hint}>Tip: hall name, address and phone are printed at the top of every PDF invoice you share.</Text>

            <Pressable onPress={save} disabled={busy || !name.trim()} style={[styles.save, (busy || !name.trim()) && { opacity: 0.6 }]} testID="save-hall-name-btn">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, marginTop: 12, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.outline },
  input: { flex: 1, fontSize: 14, color: Colors.onSurface, padding: 0 },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 12, lineHeight: 16 },
  save: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
