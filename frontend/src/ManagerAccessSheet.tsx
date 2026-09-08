import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme';
import { api } from './api';

type ManagerRecord = {
  identifier: string;
  identifier_type: string;
  added_at: string;
  status: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ManagerAccessSheet({ visible, onClose }: Props) {
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'phone' | 'email'>('phone');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      loadManagers();
      setInput('');
      setError('');
    }
  }, [visible]);

  const loadManagers = async () => {
    setLoading(true);
    try {
      const data = await api.listManagers();
      setManagers(data || []);
    } catch (e: any) {
      console.warn('load managers failed', e);
    } finally {
      setLoading(false);
    }
  };

  const detectType = (value: string): 'phone' | 'email' => {
    if (value.includes('@')) return 'email';
    return 'phone';
  };

  const handleAdd = async () => {
    const val = input.trim();
    if (!val) {
      setError('Enter a phone number or email address');
      return;
    }
    const type = detectType(val);
    setError('');
    setAdding(true);
    try {
      await api.addManager(val, type);
      setInput('');
      await loadManagers();
    } catch (e: any) {
      const msg = e?.message || 'Failed to add manager';
      if (msg.includes('409') || msg.includes('already')) {
        setError('This manager is already added.');
      } else {
        setError(msg.substring(0, 100));
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (manager: ManagerRecord) => {
    Alert.alert(
      'Remove Manager',
      `Remove access for ${manager.identifier}? They will no longer be able to view or create bookings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removeManager(manager.identifier);
              await loadManagers();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove manager');
            }
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    } catch {
      return '';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="people" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Manager Access</Text>
              <Text style={styles.sub}>Managers can view and create bookings</Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Add Manager */}
            <View style={styles.addSection}>
              <Text style={styles.sectionLabel}>Invite a Manager</Text>
              <Text style={styles.sectionHint}>
                Enter their phone number or email. They can log in with the same credential and will automatically get manager access.
              </Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-add-outline" size={16} color={Colors.muted} style={{ marginRight: 8 }} />
                <TextInput
                  value={input}
                  onChangeText={(v) => { setInput(v); setError(''); }}
                  placeholder="Phone (+91XXXXXXXXXX) or Email"
                  placeholderTextColor={Colors.muted}
                  style={styles.textInput}
                  keyboardType="default"
                  autoCapitalize="none"
                />
              </View>
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}
              <Pressable
                onPress={handleAdd}
                disabled={adding}
                style={[styles.addBtn, adding && { opacity: 0.6 }]}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Add Manager</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Manager List */}
            <Text style={styles.sectionLabel}>Active Managers</Text>
            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
            ) : managers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={32} color={Colors.muted} />
                <Text style={styles.emptyTitle}>No managers yet</Text>
                <Text style={styles.emptyText}>
                  Add a manager above to let them access your bookings.
                </Text>
              </View>
            ) : (
              managers.map((m, i) => (
                <View key={i} style={styles.managerCard}>
                  <View style={styles.managerIcon}>
                    <Ionicons
                      name={m.identifier_type === 'email' ? 'mail' : 'phone-portrait'}
                      size={16}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.managerIdentifier}>{m.identifier}</Text>
                    <Text style={styles.managerMeta}>
                      {m.identifier_type === 'email' ? 'Email login' : 'Phone OTP login'} •{' '}
                      Added {formatDate(m.added_at)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemove(m)}
                    style={styles.removeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                  </Pressable>
                </View>
              ))
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.secondary} style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.infoText}>
                Managers can view all bookings, add payments, and create new bookings. They cannot change business settings, generate reports, or delete the account.
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  addSection: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Colors.onSurface, marginBottom: 6 },
  sectionHint: { fontSize: 11, color: Colors.muted, lineHeight: 16, marginBottom: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: { flex: 1, fontSize: 14, color: Colors.onSurface, padding: 0 },
  errorText: { fontSize: 11, color: Colors.error, marginTop: 6 },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  emptyText: { fontSize: 12, color: Colors.muted, textAlign: 'center', lineHeight: 17 },
  managerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  managerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  managerIdentifier: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  managerMeta: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  removeBtn: { padding: 4 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.secondaryContainer,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  infoText: { flex: 1, fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 17 },
});
