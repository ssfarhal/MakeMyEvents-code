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
  const [testOtp, setTestOtp] = useState(''); // only shown in test mode
  const [testMode, setTestMode] = useState(false);
  const confirmationRef = useRef<any>(null); // for @react-native-firebase on native

  React.useEffect(() => {
    if (visible) {
      setStep('phone');
      setPhone('');
      setOtp('');
      setError('');
      setBusy(false);
      setTestOtp('');
      setTestMode(false);
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
    setTestOtp('');
    setTestMode(false);
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS !== 'web') {
        // ── Native (iOS / Android): use @react-native-firebase/auth ──
        // No reCAPTCHA — uses silent push (iOS) / Play Integrity (Android)
        const rnfAuth = await import('@react-native-firebase/auth');
        const firebaseNative = rnfAuth.default;
        const confirmation = await firebaseNative().signInWithPhoneNumber(normalizedPhone);
        confirmationRef.current = confirmation;
        setStep('otp');
      } else {
        // ── Web: use custom backend OTP (no reCAPTCHA) ──
        const res: any = await api.phoneSendOTP(normalizedPhone);
        if (res?.test_mode && res?.otp) {
          // Development mode: OTP returned in response
          setTestOtp(res.otp);
          setTestMode(true);
        }
        setStep('otp');
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to send OTP';
      if (msg.includes('invalid-phone-number')) {
        setError('Invalid phone number. Use format: +91XXXXXXXXXX');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please wait and try again.');
      } else {
        setError(msg.substring(0, 150));
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
    setBusy(true);
    try {
      const normalizedPhone = normalizePhone(phone);

      if (Platform.OS !== 'web' && confirmationRef.current) {
        // ── Native: verify with @react-native-firebase ──
        const result = await confirmationRef.current.confirm(otp);
        const idToken = await result.user.getIdToken();
        const authResponse: any = await api.phoneVerify(idToken);
        onSuccess(authResponse.session_token, authResponse.user);
      } else {
        // ── Web: verify with custom backend ──
        const authResponse: any = await api.phoneVerifyOTP(normalizedPhone, otp);
        onSuccess(authResponse.session_token, authResponse.user);
      }
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('INVALID_CODE') || msg.includes('Incorrect OTP')) {
        setError(msg.includes('attempt') ? msg : 'Incorrect OTP. Please check and try again.');
      } else if (msg.includes('session-expired') || msg.includes('SESSION_EXPIRED') || msg.includes('expired')) {
        setError('OTP has expired. Please go back and resend.');
      } else if (msg.includes('Too many')) {
        setError('Too many incorrect attempts. Please request a new OTP.');
        setStep('phone');
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
                  : `OTP sent to ${normalizePhone(phone)}`}
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
                  Enter your 10-digit mobile number. OTP will be sent via SMS.
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
                  OTP sent to {normalizePhone(phone)}. Valid for 10 minutes.
                </Text>

                {/* Test mode banner — only shown when SMS is not configured */}
                {testMode && testOtp ? (
                  <View style={styles.testBox}>
                    <Ionicons name="flask-outline" size={14} color="#b45309" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.testTitle}>Test Mode — No SMS sent</Text>
                      <Text style={styles.testOtp}>Your OTP: <Text style={styles.testOtpCode}>{testOtp}</Text></Text>
                      <Text style={styles.testNote}>
                        Add a FAST2SMS_API_KEY to backend .env to send real SMS.
                      </Text>
                    </View>
                  </View>
                ) : null}

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
                    confirmationRef.current = null;
                  }}
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
  testBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  testTitle: { fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  testOtp: { fontSize: 12, color: '#78350f' },
  testOtpCode: { fontSize: 20, fontWeight: '900', color: '#b45309', letterSpacing: 4 },
  testNote: { fontSize: 10, color: '#92400e', marginTop: 4, lineHeight: 14 },
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
