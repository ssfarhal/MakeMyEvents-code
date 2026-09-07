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

import { Colors } from '@/src/theme';

const DELETE_ACCOUNT_API = 'https://app-launcher-3237.preview.emergentagent.com/api/public/delete-account';

export default function DeleteAccountScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    const value = email.trim();

    if (!value) {
      setMessage('Please enter your email address.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const res = await fetch(DELETE_ACCOUNT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      setEmail('');
      setMessage('Your account and data have been deleted.');
    } catch (e: any) {
      setMessage(e?.message || 'Unable to delete account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.page}>
          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.subtitle}>
            Enter your email address and submit to delete your account data from the database.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            testID="delete-account-email"
          />

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
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  page: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.onSurface, marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, color: Colors.onSurfaceVariant, marginBottom: 20 },
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
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  message: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.onSurface,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
});