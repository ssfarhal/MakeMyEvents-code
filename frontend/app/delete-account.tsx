import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/src/theme';
import { BACKEND_URL } from '@/src/api';

export default function DeleteAccountScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const submit = async () => {
    const value = email.trim().toLowerCase();

    if (!value || !value.includes('@')) {
      setMessage('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/public/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }

      setEmail('');
      setIsSuccess(true);
      setMessage(data?.message || 'Your account and all associated data have been permanently deleted.');
    } catch (e: any) {
      setIsSuccess(false);
      setMessage(e?.message || 'Unable to process your request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.page}>
          <View style={styles.iconWrap}>
            <Ionicons name="trash-outline" size={32} color={Colors.error} />
          </View>
          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.subtitle}>
            Enter your registered email address to permanently delete your BookMyEvents account and all associated data including bookings, payments, and financial records.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            testID="delete-account-email"
            editable={!isSuccess}
          />

          {!isSuccess && (
            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.9 },
                busy && { opacity: 0.7 },
              ]}
              testID="delete-account-submit"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Delete My Account</Text>}
            </Pressable>
          )}

          {message ? (
            <View style={[styles.messageBox, isSuccess ? styles.successBox : styles.errorBox]}>
              <Ionicons
                name={isSuccess ? 'checkmark-circle' : 'warning'}
                size={18}
                color={isSuccess ? '#2d7a4f' : Colors.error}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.messageText, { color: isSuccess ? '#2d7a4f' : Colors.error }]}>
                {message}
              </Text>
            </View>
          ) : null}

          <Text style={styles.legal}>
            This action is permanent and cannot be undone. Please make sure you have saved any important records before proceeding.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  page: { flex: 1, padding: 24, justifyContent: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.errorContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.onSurface, marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 21, color: Colors.onSurfaceVariant, marginBottom: 24 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.onSurface,
  },
  button: {
    marginTop: 16,
    backgroundColor: Colors.error,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  messageBox: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, padding: 14, borderWidth: 1 },
  successBox: { backgroundColor: '#e6f4ed', borderColor: '#2d7a4f' },
  errorBox: { backgroundColor: Colors.errorContainer, borderColor: Colors.error },
  messageText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: Colors.muted, textAlign: 'center' },
});