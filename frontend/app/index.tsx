import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { isValidReferenceCode } from '@/src/referenceCodes';

const STORAGE_KEY = 'mme_ref_code_verified';

async function isVerified(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1';
    }
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    return v === '1';
  } catch { return false; }
}

async function markVerified(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, '1');
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, '1');
  } catch {}
}

export default function ReferenceCodeGate() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await isVerified();
      if (ok) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    })();
  }, [router]);

  const onSubmit = async () => {
    setError(null);
    if (!code.trim()) { setError('Please enter your reference code.'); return; }
    setBusy(true);
    // small delay for tactile feedback
    setTimeout(async () => {
      if (isValidReferenceCode(code)) {
        await markVerified();
        setBusy(false);
        router.replace('/login');
      } else {
        setBusy(false);
        setError('Invalid reference code. Please check and try again.');
      }
    }, 250);
  };

  if (checking) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator color="#D4A73C" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.brand}>MakeMyEvents</Text>
          <Text style={styles.tagline}>Event Planning & Booking Platform</Text>

          <View style={styles.formCard}>
            <TextInput
              value={code}
              onChangeText={(v) => { setCode(v); if (error) setError(null); }}
              placeholder="Enter Reference code"
              placeholderTextColor="#8A8A8A"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
              testID="reference-code-input"
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
            testID="reference-code-submit"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit</Text>
            )}
          </Pressable>

          <Text style={styles.footerHint}>
            Don't have a reference code? Contact your MakeMyEvents administrator.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoWrap: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  brand: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  tagline: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 36,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  input: {
    fontSize: 16,
    color: '#111',
    padding: 0,
    minHeight: 24,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  submitBtn: {
    width: '100%',
    marginTop: 22,
    backgroundColor: '#1E2733',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.4 },
  footerHint: {
    marginTop: 28,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
