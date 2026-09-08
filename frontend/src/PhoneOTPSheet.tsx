import React, { useState, useRef, useEffect } from 'react';
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

// Keep one recaptcha verifier alive across renders on web
let _webVerifier: any = null;

export default function PhoneOTPSheet({ visible, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmationRef = useRef<any>(null);

  useEffect(() => {
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

  const resetVerifier = () => {
    try { _webVerifier?.clear(); } catch {}
    _webVerifier = null;
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
      if (Platform.OS !== 'web') {
        // ── Native (iOS / Android) ──
        // @react-native-firebase uses silent APNs (iOS) / Play Integrity (Android)
        // — NO reCAPTCHA on native devices
        const rnfAuth = await import('@react-native-firebase/auth');
        const firebaseNative = rnfAuth.default;
        const confirmation = await firebaseNative().signInWithPhoneNumber(normalizedPhone);
        confirmationRef.current = confirmation;
        setStep('otp');
      } else {
        // ── Web ──
        // Invisible reCAPTCHA — runs silently in background for real users.
        // A visual puzzle only appears when Google detects automated/suspicious traffic.
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
        const { firebaseAuth, isFirebaseConfigured } = await import('./firebase');

        if (!isFirebaseConfigured || !firebaseAuth) {
          setError('Firebase is not configured. Check your .env settings.');
          return;
        }

        // Create invisible verifier if not already created
        if (!_webVerifier) {
          _webVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {}, // fired when reCAPTCHA auto-verifies
          });
          await _webVerifier.render();
        }

        const confirmation = await signInWithPhoneNumber(
          firebaseAuth,
          normalizedPhone,
          _webVerifier,
        );
        confirmationRef.current = confirmation;
        setStep('otp');
      }
    } catch (e: any) {
      resetVerifier(); // must recreate on error
      const msg: string = e?.message || 'Failed to send OTP';
      if (msg.includes('invalid-phone-number')) {
        setError('Invalid phone number. Use: +91XXXXXXXXXX');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many requests. Please wait a few minutes and try again.');
      } else if (msg.includes('not-authorized') || msg.includes('unauthorized-domain')) {
        setError(
          'This domain is not authorised in Firebase.\n' +
          'Go to Firebase Console → Authentication → Settings → Authorized Domains and add this domain.'
        );
      } else if (msg.includes('api-key-not-valid')) {
        setError('Firebase API key is invalid. Please check the configuration.');
      } else {
        setError(msg.substring(0, 160));
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyOTP = async () => {
    setError('');
    if (!otp || otp.trim().length < 4) {
      setError('Enter the OTP you received via SMS');
      return;
    }
    if (!confirmationRef.current) {
      setError('Session expired. Please go back and resend the OTP.');
      return;
    }
    setBusy(true);
    try {
      // Works the same on web (Firebase Web SDK) and native (@react-native-firebase)
      const result = await confirmationRef.current.confirm(otp.trim());
      const idToken = await result.user.getIdToken();

      // Exchange Firebase ID token for BookMyEvents session
      const authResponse: any = await api.phoneVerify(idToken);
      onSuccess(authResponse.session_token, authResponse.user);
      onClose();
    } catch (e: any) {
      const msg: string = e?.message || 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('INVALID_CODE')) {
        setError('Incorrect OTP. Please check and try again.');
      } else if (msg.includes('session-expired') || msg.includes('SESSION_EXPIRED') || msg.includes('code-expired')) {
        setError('OTP expired. Please go back and request a new one.');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please request a new OTP.');
      } else {
        setError(msg.substring(0, 160));
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
                  : `OTP sent to ${normalizePhone(phone)}`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                    value={phone.startsWith('+91') ? phone.slice(3) : phone}
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
                  Enter your 10-digit mobile number. An OTP will be sent via SMS.
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={Colors.error} style={{ marginRight: 6, marginTop: 1 }} />
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

                {/* Invisible reCAPTCHA anchor — required by Firebase Web SDK */}
                {Platform.OS === 'web' && (
                  <View nativeID="recaptcha-container" style={styles.recaptchaContainer} />
                )}
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
                    <Ionicons name="warning-outline" size={16} color={Colors.error} style={{ marginRight: 6, marginTop: 1 }} />
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
                      <Text style={styles.btnText}>Verify &amp; Login</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setStep('phone');
                    setError('');
                    setOtp('');
                    confirmationRef.current = null;
                  }}
                  style={styles.resendBtn}
                >
                  <Text style={styles.resendText}>← Change number or resend OTP</Text>
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
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: '#CCC', marginBottom: 12,
  },
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
    fontSize: 28,
    color: Colors.onSurface,
    letterSpacing: 10,
    textAlign: 'center',
    fontWeight: '700',
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
  recaptchaContainer: { height: 0, overflow: 'hidden' },
});
