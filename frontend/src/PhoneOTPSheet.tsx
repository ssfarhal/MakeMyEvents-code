import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './theme';
import { api } from './api';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (sessionToken: string, userData: any) => void;
};

type Step = 'phone' | 'otp';

export default function PhoneOTPSheet({ visible, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmationRef = useRef<any>(null);

  React.useEffect(() => {
    if (visible) {
      setStep('phone');
      setPhone('');
      setOtp('');
      setError('');
      setBusy(false);
      confirmationRef.current = null;
    }
  }, [visible]);

  const formatPhone = (input: string) => input.replace(/[^0-9+\-\s]/g, '');

  const normalizePhone = (input: string) => {
    let p = input.trim().replace(/[\s\-]/g, '');
    if (!p.startsWith('+')) {
      p = p.length === 10 ? '+91' + p : '+' + p;
    }
    return p;
  };

  const sendOTP = async () => {
    setError('');
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // Web: use Firebase Web SDK with RecaptchaVerifier
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
        const { firebaseAuth, isFirebaseConfigured } = await import('./firebase');
        if (!isFirebaseConfigured || !firebaseAuth) {
          setError('Firebase is not configured. Please add Firebase credentials to the .env file.');
          return;
        }
        // Create or reuse invisible recaptcha
        if (!(window as any)._bmeRecaptcha) {
          (window as any)._bmeRecaptcha = new RecaptchaVerifier(
            firebaseAuth,
            'recaptcha-container',
            { size: 'invisible' }
          );
        }
        const confirmation = await signInWithPhoneNumber(
          firebaseAuth,
          normalizedPhone,
          (window as any)._bmeRecaptcha
        );
        confirmationRef.current = confirmation;
        setStep('otp');
      } else {
        // Native (iOS / Android): use @react-native-firebase/auth
        const rnfAuth = await import('@react-native-firebase/auth');
        const firebaseNative = rnfAuth.default;
        const confirmation = await firebaseNative().signInWithPhoneNumber(normalizedPhone);
        confirmationRef.current = confirmation;
        setStep('otp');
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to send OTP';
      if (msg.includes('invalid-phone-number')) {
        setError('Invalid phone number. Use format: +91XXXXXXXXXX');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please wait and try again.');
      } else if (msg.includes('api-key-not-valid') || msg.includes('invalid-api-key')) {
        setError('Firebase configuration error. Please contact the app administrator.');
      } else if (msg.includes('not-authorized')) {
        setError('This domain is not authorised in Firebase. Please add it in Firebase Console → Authentication → Authorized Domains.');
      } else {
        setError(msg.substring(0, 150));
      }
      // Reset recaptcha on error so it can be recreated
      if (Platform.OS === 'web') {
        try { (window as any)._bmeRecaptcha?.clear(); (window as any)._bmeRecaptcha = null; } catch {}
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyOTP = async () => {
    setError('');
    if (!otp || otp.length < 4) {
      setError('Enter the OTP code you received');
      return;
    }
    if (!confirmationRef.current) {
      setError('Session expired. Please go back and resend the OTP.');
      return;
    }
    setBusy(true);
    try {
      const result = await confirmationRef.current.confirm(otp);
      const idToken = await result.user.getIdToken();

      // Exchange Firebase ID token for BookMyEvents session
      const authResponse: any = await api.phoneVerify(idToken);
      onSuccess(authResponse.session_token, authResponse.user);
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('INVALID_CODE')) {
        setError('Incorrect OTP. Please check and try again.');
      } else if (msg.includes('session-expired') || msg.includes('SESSION_EXPIRED')) {
        setError('OTP expired. Please go back and resend.');
      } else if (msg.includes('code-expired')) {
        setError('OTP has expired. Please request a new one.');
      } else {
        setError(msg.substring(0, 150));
      }
    } finally {
      setBusy(false);
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

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Phone Login</Text>
              <Text style={styles.sub}>
                {step === 'phone'
                  ? 'Enter your mobile number to receive an OTP'
                  : `Enter the OTP sent to ${normalizePhone(phone)}`}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {step === 'phone' ? (
              <>
                <Text style={styles.label}>Mobile Number</Text>
                <View style={styles.inputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    value={phone.startsWith('+91') ? phone.slice(3) : phone.startsWith('+') ? phone : phone}
                    onChangeText={(v) => setPhone(formatPhone(v))}
                    placeholder="98765 43210"
                    placeholderTextColor={Colors.muted}
                    keyboardType="phone-pad"
                    style={styles.phoneInput}
                    autoFocus
                    maxLength={15}
                  />
                </View>
                <Text style={styles.hint}>
                  Enter your 10-digit mobile number. We&apos;ll send an OTP via SMS.
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={Colors.error} style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={sendOTP}
                  disabled={busy}
                  style={[styles.btn, busy && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.btnText}>Send OTP</Text>
                    </>
                  )}
                </Pressable>

                {/* Invisible reCAPTCHA container for web */}
                {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter OTP</Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="• • • • • •"
                  placeholderTextColor={Colors.muted}
                  keyboardType="number-pad"
                  style={styles.otpInput}
                  autoFocus
                  maxLength={8}
                />
                <Text style={styles.hint}>
                  OTP sent to {normalizePhone(phone)}. Valid for 5 minutes.
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={Colors.error} style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={verifyOTP}
                  disabled={busy}
                  style={[styles.btn, busy && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.btnText}>Verify & Login</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => { setStep('phone'); setError(''); setOtp(''); confirmationRef.current = null; }}
                  style={styles.resendBtn}
                >
                  <Text style={styles.resendText}>← Change number or resend</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.onSurface },
  sub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, marginBottom: 8, marginTop: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outline,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: Colors.outline,
    backgroundColor: '#F0F0F0',
  },
  countryCodeText: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.onSurface,
    letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    color: Colors.onSurface,
    letterSpacing: 8,
    textAlign: 'center',
  },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 8, lineHeight: 16 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.errorContainer,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: Colors.error, lineHeight: 17 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  resendBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  resendText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
