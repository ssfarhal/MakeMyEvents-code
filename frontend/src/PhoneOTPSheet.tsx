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

/**
 * OTP flow routing:
 *
 *  Platform.OS === 'web'
 *    → Firebase Web SDK  (invisible reCAPTCHA runs silently)
 *
 *  Platform.OS !== 'web'  AND  @react-native-firebase native modules loaded (EAS builds)
 *    → @react-native-firebase/auth  (silent APNs / Play Integrity — no reCAPTCHA)
 *
 *  Platform.OS !== 'web'  AND  native modules NOT available (Expo Go)
 *    → Custom backend OTP  (/api/auth/phone-otp/send + verify)
 *      In test mode (no SMS key): OTP displayed on screen
 */

// Reuse one invisible reCAPTCHA verifier across renders on web
let _webVerifier: any = null;

// Which backend flow is active in the current session
type OtpMode = 'firebase-web' | 'firebase-native' | 'backend';

export default function PhoneOTPSheet({ visible, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [testOtp, setTestOtp] = useState('');   // test mode only
  const [testMode, setTestMode] = useState(false);
  const otpModeRef = useRef<OtpMode>('firebase-web');
  const nativeConfirmRef = useRef<any>(null);    // holds firebase-native confirmation

  useEffect(() => {
    if (visible) {
      setStep('phone');
      setPhone('');
      setOtp('');
      setError('');
      setBusy(false);
      setTestOtp('');
      setTestMode(false);
      nativeConfirmRef.current = null;
    }
  }, [visible]);

  const fmt = (v: string) => v.replace(/[^0-9+\-\s]/g, '');

  const normalize = (v: string) => {
    let p = v.trim().replace(/[\s\-]/g, '');
    if (!p.startsWith('+')) p = p.length === 10 ? '+91' + p : '+' + p;
    return p;
  };

  const resetWebVerifier = () => {
    try { _webVerifier?.clear(); } catch {}
    _webVerifier = null;
  };

  // ─── Try to load @react-native-firebase/auth ───────────────────────────────
  const tryLoadNativeFirebase = async () => {
    try {
      const mod = await import('@react-native-firebase/auth');
      const authFn = mod?.default ?? mod;
      // authFn must be callable (it is the auth() factory)
      if (typeof authFn !== 'function') return null;
      // Sanity-check: calling authFn() should return an object with signInWithPhoneNumber
      const authInstance = authFn();
      if (typeof authInstance?.signInWithPhoneNumber !== 'function') return null;
      return authFn;
    } catch {
      return null;
    }
  };

  // ─── SEND OTP ──────────────────────────────────────────────────────────────
  const sendOTP = async () => {
    setError('');
    setTestOtp('');
    setTestMode(false);

    const normalizedPhone = normalize(phone);
    if (normalizedPhone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // ── Web: Firebase Web SDK + invisible reCAPTCHA ──────────────────────
        otpModeRef.current = 'firebase-web';
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
        const { firebaseAuth, isFirebaseConfigured } = await import('./firebase');
        if (!isFirebaseConfigured || !firebaseAuth) {
          setError('Firebase is not configured. Check your .env settings.');
          return;
        }
        if (!_webVerifier) {
          _webVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {},
          });
          await _webVerifier.render();
        }
        const confirmation = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, _webVerifier);
        nativeConfirmRef.current = confirmation;
        setStep('otp');

      } else {
        // ── Native: try @react-native-firebase first ─────────────────────────
        const firebaseNative = await tryLoadNativeFirebase();

        if (firebaseNative) {
          // EAS build — native modules available
          otpModeRef.current = 'firebase-native';
          const confirmation = await firebaseNative().signInWithPhoneNumber(normalizedPhone);
          nativeConfirmRef.current = confirmation;
          setStep('otp');
        } else {
          // Expo Go fallback — native modules NOT available
          // Use custom backend OTP instead
          otpModeRef.current = 'backend';
          const res: any = await api.phoneSendOTP(normalizedPhone);
          nativeConfirmRef.current = null; // not used in backend mode
          if (res?.test_mode && res?.otp) {
            setTestOtp(res.otp);
            setTestMode(true);
          }
          setStep('otp');
        }
      }
    } catch (e: any) {
      resetWebVerifier();
      const msg: string = e?.message || 'Failed to send OTP';
      if (msg.includes('invalid-phone-number')) {
        setError('Invalid phone number. Use format: +91XXXXXXXXXX');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many requests. Please wait a few minutes and try again.');
      } else if (msg.includes('not-authorized') || msg.includes('unauthorized-domain')) {
        setError(
          'Domain not authorised in Firebase.\n' +
          'Add this domain in Firebase Console → Authentication → Settings → Authorized Domains.'
        );
      } else if (msg.includes('api-key-not-valid')) {
        setError('Firebase API key is invalid. Please check your configuration.');
      } else {
        setError(msg.substring(0, 180));
      }
    } finally {
      setBusy(false);
    }
  };

  // ─── VERIFY OTP ───────────────────────────────────────────────────────────
  const verifyOTP = async () => {
    setError('');
    const code = otp.trim();
    if (!code || code.length < 4) {
      setError('Enter the OTP you received');
      return;
    }
    setBusy(true);
    try {
      const normalizedPhone = normalize(phone);

      if (otpModeRef.current === 'backend') {
        // ── Custom backend verification ──────────────────────────────────────
        const authResponse: any = await api.phoneVerifyOTP(normalizedPhone, code);
        onSuccess(authResponse.session_token, authResponse.user);
        onClose();

      } else {
        // ── Firebase verification (web or native) ────────────────────────────
        if (!nativeConfirmRef.current) {
          setError('Session expired. Please go back and resend the OTP.');
          return;
        }
        const result = await nativeConfirmRef.current.confirm(code);
        const idToken = await result.user.getIdToken();
        const authResponse: any = await api.phoneVerify(idToken);
        onSuccess(authResponse.session_token, authResponse.user);
        onClose();
      }
    } catch (e: any) {
      const msg: string = e?.message || 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('INVALID_CODE') || msg.includes('Incorrect OTP')) {
        setError(msg.includes('attempt') ? msg : 'Incorrect OTP. Please check and try again.');
      } else if (msg.includes('session-expired') || msg.includes('SESSION_EXPIRED') || msg.includes('code-expired') || msg.includes('expired')) {
        setError('OTP expired. Please go back and request a new one.');
      } else if (msg.includes('Too many')) {
        setError('Too many incorrect attempts. Please request a new OTP.');
        setStep('phone');
      } else {
        setError(msg.substring(0, 180));
      }
    } finally {
      setBusy(false);
    }
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
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
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Phone Login</Text>
              <Text style={styles.sub}>
                {step === 'phone'
                  ? 'Enter your mobile number to receive an OTP'
                  : `OTP sent to ${normalize(phone)}`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'phone' ? (
              <>
                <Text style={styles.label}>Mobile Number</Text>
                <View style={styles.inputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    value={phone.startsWith('+91') ? phone.slice(3) : phone}
                    onChangeText={(v) => setPhone(fmt(v))}
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

                {error ? <ErrorBox msg={error} /> : null}

                <Pressable onPress={sendOTP} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.btnText}>Send OTP</Text>
                    </>
                  )}
                </Pressable>

                {/* Invisible reCAPTCHA anchor — required by Firebase Web SDK on web */}
                {Platform.OS === 'web' && (
                  <View nativeID="recaptcha-container" style={{ height: 0, overflow: 'hidden' }} />
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
                  OTP sent to {normalize(phone)}. Valid for 10 minutes.
                </Text>

                {/* Test mode banner — shown only in Expo Go when no SMS provider is configured */}
                {testMode && testOtp ? (
                  <View style={styles.testBox}>
                    <Ionicons name="flask-outline" size={14} color="#92400e" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.testTitle}>Test Mode — No SMS sent</Text>
                      <Text style={styles.testBody}>
                        Your OTP: <Text style={styles.testCode}>{testOtp}</Text>
                      </Text>
                      <Text style={styles.testNote}>
                        Add FAST2SMS_API_KEY to backend .env to send real SMS.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {error ? <ErrorBox msg={error} /> : null}

                <Pressable onPress={verifyOTP} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
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
                    setTestOtp('');
                    setTestMode(false);
                    nativeConfirmRef.current = null;
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

function ErrorBox({ msg }: { msg: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="warning-outline" size={16} color={Colors.error} style={{ marginRight: 6, marginTop: 1 }} />
      <Text style={styles.errorText}>{msg}</Text>
    </View>
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceVariant, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.outline, overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: Colors.outline,
    backgroundColor: '#F0F0F0',
  },
  countryCodeText: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: Colors.onSurface, letterSpacing: 1 },
  otpInput: {
    backgroundColor: Colors.surfaceVariant, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.outline,
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 28, color: Colors.onSurface, letterSpacing: 10,
    textAlign: 'center', fontWeight: '700',
  },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 8, lineHeight: 16 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.errorContainer, borderRadius: 12,
    padding: 12, marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: Colors.error, lineHeight: 17 },
  testBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fef3c7', borderRadius: 12,
    padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#f59e0b',
  },
  testTitle: { fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  testBody: { fontSize: 12, color: '#78350f' },
  testCode: { fontSize: 22, fontWeight: '900', color: '#b45309', letterSpacing: 4 },
  testNote: { fontSize: 10, color: '#92400e', marginTop: 4, lineHeight: 14 },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 20,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  resendBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  resendText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
