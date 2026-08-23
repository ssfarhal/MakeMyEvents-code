# MakeMyEvents — Product Requirements

## Overview
Mobile app for venue/hall owners to manage event bookings, availability, and revenue. Rebuilt from a Flutter reference (`MakeMyEvents.zip`) into an Expo / React Native app so it can run and deploy on this platform.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, expo-router, react-native-safe-area-context, expo-linear-gradient, @expo/vector-icons
- **Backend**: FastAPI + MongoDB (motor)
- **Auth**: Emergent-managed Google OAuth (session token stored in expo-secure-store / localStorage)

## Screens
1. **Owner Login** (`/`)
   - Maroon gradient hero, "Continue with Google" button, feature chips (Booking control, Availability, Payments), post-login preview list.
2. **Dashboard** (`/(tabs)/dashboard`)
   - Personalised greeting + "Hall Available/Booked Today" pill
   - 3 KPI cards: Monthly Revenue, Upcoming Events, Pending Balance (alert border when > 0)
   - Upcoming events list (top 4) with event badge, status pill, day-count
   - FAB "New Booking"
   - Seed button appears when no bookings exist (demo data)
3. **Bookings** (`/(tabs)/bookings`)
   - Search by client / event type
   - 4 filter chips: All, Upcoming, Completed, Pending Balance (with counts)
   - Booking cards with event icon, status pill, advance/balance, function time chip
   - Detail modal → Edit / Delete
   - FAB "New Booking"
4. **Availability Calendar** (`/(tabs)/calendar`)
   - Month navigation, Confirmed/Pending/Available legend
   - 7-column grid; today highlighted, past greyed
   - Monthly Summary: Booked / Available / Occupancy + progress bar
   - Tap day → sheet listing that day's bookings

## Backend Endpoints (`/api`)
- `POST /auth/session` — exchange Emergent `session_id` for `session_token` + user
- `GET /auth/me` — current user (Bearer)
- `POST /auth/logout`
- `GET/POST/PATCH/DELETE /bookings` — CRUD, per-user
- `POST /bookings/seed` — idempotent demo data seed for owner

## Data Model
- `users` — user_id (unique), email (unique), name, picture
- `user_sessions` — session_token, user_id, expires_at (TTL 7 days)
- `bookings` — id, user_id, clientName, phone, eventType, eventDate (ISO), functionTime, guestCount, totalAmount, advancePaid, status, notes

## Design tokens
- Primary: `#7B1D3C` (maroon), Secondary: `#C9963A` (gold)
- Event-type color coding: Wedding maroon, Reception gold, Engagement green, Birthday blue, Corporate purple
- Radius: 12–20; spacing 8pt grid

## Testing (Iteration 1)
- 11/11 backend pytest passed
- Frontend login screen and Google-redirect flow verified
