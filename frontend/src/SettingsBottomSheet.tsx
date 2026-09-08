import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from './theme';
import ManagerAccessSheet from './ManagerAccessSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialName?: string;
  initialAddress?: string;
  initialPhone?: string;
  initialOwnerName?: string;
  isManager?: boolean;
  onSave: (data: { hallName: string; hallAddress: string; ownerName: string; ownerPhone: string }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
};

export default function SettingsBottomSheet({
  visible, onClose,
  initialName, initialAddress, initialPhone, initialOwnerName,
  isManager = false,
  onSave, onDeleteAccount,
}: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showManagers, setShowManagers] = useState(false);
  const router = useRouter();

  const alreadyConfigured = !!(initialName && initialAddress && initialPhone && initialOwnerName);

  React.useEffect(() => {
    if (visible) {
      setName(initialName || '');
      setAddress(initialAddress || '');
      setPhone(initialPhone || '');
      setOwnerName(initialOwnerName || '');
      setEditMode(!alreadyConfigured);
    }
  }, [visible, initialName, initialAddress, initialPhone, initialOwnerName, alreadyConfigured]);

  const allFilled = !!(name.trim() && address.trim() && ownerName.trim() && phone.trim());

  const save = async () => {
    if (!allFilled) return;
    setBusy(true);
    try {
      await onSave({ hallName: name.trim(), hallAddress: address.trim(), ownerName: ownerName.trim(), ownerPhone: phone.trim() });
      onClose();
    } catch (e) { console.warn(e); }
    finally { setBusy(false); }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete My Account',
      'This will permanently delete your bookings, financial records, and account data from the database and log you out. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await onDeleteAccount();
              onClose();
            } catch (e) {
              console.warn(e);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as any), 200);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.iconWrap}><Ionicons name="business" size={20} color={Colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>Settings</Text>
                <Text style={styles.sub}>
                  {isManager ? 'Manager view — settings are read-only' : 'Manage your venue and account'}
                </Text>
              </View>
              <Pressable onPress={onClose} testID="close-settings-btn">
                <Ionicons name="close" size={22} color={Colors.muted} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Business Details */}
              <Text style={styles.sectionTitle}>Business Details</Text>

              <Text style={styles.label}>Hall / Convention Name *</Text>
              <View style={[styles.inputWrap, (!editMode || isManager) && styles.readOnly]}>
                <Ionicons name="business-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
                <TextInput
                  testID="hall-name-input"
                  value={name}
                  onChangeText={setName}
                  editable={editMode && !isManager}
                  placeholder="e.g. Bharath Convention Hall"
                  placeholderTextColor={Colors.muted}
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>Convention Hall Address *</Text>
              <View style={[styles.inputWrap, { minHeight: 72, alignItems: 'flex-start' }, (!editMode || isManager) && styles.readOnly]}>
                <Ionicons name="location-outline" size={16} color={Colors.muted} style={{ marginRight: 8, marginTop: 4 }} />
                <TextInput
                  testID="hall-address-input"
                  value={address}
                  onChangeText={setAddress}
                  editable={editMode && !isManager}
                  placeholder="Street, Area, City, PIN"
                  placeholderTextColor={Colors.muted}
                  style={[styles.input, { minHeight: 60 }]}
                  multiline
                />
              </View>

              <Text style={styles.label}>Owner Name *</Text>
              <View style={[styles.inputWrap, (!editMode || isManager) && styles.readOnly]}>
                <Ionicons name="person-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
                <TextInput
                  testID="owner-name-input"
                  value={ownerName}
                  onChangeText={setOwnerName}
                  editable={editMode && !isManager}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={Colors.muted}
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>Owner Phone Number *</Text>
              <View style={[styles.inputWrap, (!editMode || isManager) && styles.readOnly]}>
                <Ionicons name="call-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
                <TextInput
                  testID="owner-phone-input"
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^0-9+ ]/g, '').slice(0, 15))}
                  editable={editMode && !isManager}
                  placeholder="e.g. +91 98765 43210"
                  placeholderTextColor={Colors.muted}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>

              <Text style={styles.hint}>All four fields appear at the top of every PDF invoice and report.</Text>

              {!isManager && (
                !editMode ? (
                  <Pressable onPress={() => setEditMode(true)} style={[styles.save, { backgroundColor: Colors.secondary }]} testID="edit-settings-btn">
                    <Text style={styles.saveText}>Edit Details</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={save} disabled={busy || !allFilled} style={[styles.save, (busy || !allFilled) && { opacity: 0.5 }]} testID="save-hall-name-btn">
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{allFilled ? 'Save' : 'Fill all 4 fields to save'}</Text>}
                  </Pressable>
                )
              )}

              {/* Manager Access — only for owners */}
              {!isManager && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Manager Access</Text>
                  <Pressable
                    onPress={() => setShowManagers(true)}
                    style={styles.menuRow}
                    testID="manager-access-btn"
                  >
                    <View style={styles.menuIconWrap}>
                      <Ionicons name="people-outline" size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuLabel}>Manage Managers</Text>
                      <Text style={styles.menuSub}>Invite or remove manager access</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
                  </Pressable>
                </>
              )}

              {/* Legal */}
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Legal & Privacy</Text>

              <Pressable onPress={() => navigate('/privacy-policy')} style={styles.menuRow} testID="privacy-policy-btn">
                <View style={styles.menuIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>Privacy Policy</Text>
                  <Text style={styles.menuSub}>How we handle your data</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
              </Pressable>

              <Pressable onPress={() => navigate('/terms-and-conditions')} style={styles.menuRow} testID="terms-btn">
                <View style={styles.menuIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>Terms & Conditions</Text>
                  <Text style={styles.menuSub}>Usage rules and responsibilities</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
              </Pressable>

              {/* Danger Zone — only for owners */}
              {!isManager && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Danger Zone</Text>
                  <Pressable
                    onPress={confirmDelete}
                    disabled={deleting || busy}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      (deleting || busy) && { opacity: 0.55 },
                      pressed && !deleting && !busy && { opacity: 0.9 },
                    ]}
                    testID="delete-account-btn"
                  >
                    {deleting
                      ? <ActivityIndicator color={Colors.error} />
                      : (
                        <>
                          <Ionicons name="trash-outline" size={16} color={Colors.error} />
                          <Text style={styles.deleteText}>Delete My Account</Text>
                        </>
                      )
                    }
                  </Pressable>
                  <Text style={styles.deleteHint}>Permanently removes all bookings, financial records, and account data.</Text>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manager Access Sub-modal */}
      <ManagerAccessSheet
        visible={showManagers}
        onClose={() => setShowManagers(false)}
      />
    </>
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
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: Colors.outlineVariant, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, marginTop: 10, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.outline },
  readOnly: { backgroundColor: '#F0F0F0', borderColor: Colors.outlineVariant, opacity: 0.9 },
  input: { flex: 1, fontSize: 14, color: Colors.onSurface, padding: 0 },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 10, lineHeight: 16 },
  save: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: Colors.onSurface },
  menuSub: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  deleteBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: Colors.errorContainer,
  },
  deleteText: { color: Colors.error, fontWeight: '800', fontSize: 15 },
  deleteHint: { fontSize: 11, color: Colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 16 },
});
