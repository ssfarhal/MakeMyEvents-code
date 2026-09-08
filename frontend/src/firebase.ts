// Firebase is used only by @react-native-firebase on native platforms.
// The web platform uses a custom backend OTP flow (no reCAPTCHA).
// This file exports web SDK helpers for legacy use only.

export const isFirebaseConfigured = false; // web uses custom OTP backend
export const firebaseApp = null;
export const firebaseAuth = null;
