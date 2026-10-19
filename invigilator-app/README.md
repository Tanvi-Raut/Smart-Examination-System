# 📱 Smart Exam Invigilator Android App (React Native + Expo)

An Android mobile application built for Examination Hall Invigilators using **React Native** and **Expo**. Designed for rapid barcode/QR scanning of student admit cards, visual identity verification against registered photographs, and fast attendance marking (`Present`, `Absent`, or `Flag Case`).

---

## 🚀 Key Features

- **Dark Mode Aesthetic:** Matches the main college examination web dashboard (`#0b1329` / `#0f172a`).
- **Native Camera QR Scanner:** High-speed barcode/QR viewfinder powered by `expo-camera` with built-in torchlight toggle.
- **Candidate Verification Deck:**
  - ✅ **Student Name**
  - ✅ **Permanent Registration Number (PRN)**
  - ❌ **Roll Number (Strictly Excluded per institutional requirement)**
  - ✅ **Assigned Examination Desk** (e.g., `R1C1`)
  - ✅ **Scheduled Examination Paper Code & Title** (e.g., `CS502: Advanced Java Programming`)
  - ✅ **Session Timings & Hall Venue** (e.g., `10:30 AM – 01:30 PM`, `CC-102`)
  - ✅ **Official Registered Photograph** with green verification boundary
  - ✅ **Face Match Prompt Instruction** for proctors
- **1-Tap Attendance Actions:** `✔ Present`, `✖ Absent`, and `⚠ Flag Case` with instant confirmation and auto-looping back to the scanner for the next student.
- **Backend Connected & Offline Ready:** Connects to the Express backend (`/api/attendance/verify-qr` & `/api/attendance/mark`), while gracefully supporting offline proctoring if signal jammers are active.

---

## 📂 Project Directory Structure

```text
invigilator-app/
├── App.js                     # Navigation Stack Container & Entry Point
├── app.json                   # Expo Application & Camera Permissions Configuration
├── config.js                  # Central Server URL Configuration
├── eas.json                   # EAS Build Configuration for Android APK
├── package.json               # Project Dependencies & Scripts
├── screens/
│   ├── LoginScreen.js         # Invigilator Login with Demo Fill & Server LAN Settings
│   ├── ScannerScreen.js       # Expo Camera Viewfinder & Barcode Scanner
│   └── VerificationScreen.js  # Candidate Verification Card (Roll Number Omitted)
└── README.md
```

---

## 🛠️ Prerequisites

1. Install **Node.js** (v18 or newer).
2. Install the **Expo Go** application on your physical Android phone from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).

---

## 🏃 Quick Start (Running via Expo Go)

### Step 1: Install Dependencies
Open a terminal in the `invigilator-app` directory:
```bash
cd "c:\Smart Examination Management\invigilator-app"
npm install
```

### Step 2: Configure Server LAN Address
Open [config.js](file:///c:/Smart%20Examination%20Management/invigilator-app/config.js) and set `DEFAULT_SERVER_URL` to your computer's local Wi-Fi IP (e.g., `http://192.168.1.105:5000`):
```javascript
export const CONFIG = {
  DEFAULT_SERVER_URL: 'http://192.168.1.105:5000',
  // ...
};
```
*(You can also adjust this directly inside the app on the Login screen).*

### Step 3: Launch Expo Dev Server
```bash
npx expo start
```

### Step 4: Open on Your Android Phone
- Ensure your phone is connected to the same Wi-Fi network (or laptop hotspot).
- Open the **Expo Go** app on your phone.
- Scan the QR code displayed in your terminal.
- The app will bundle and run natively on your Android device!

---

## 📦 Exporting Android APK (Production / Offline Installation)

To generate a standalone `.apk` file that can be installed on any Android phone without Expo Go:

### Option A: Cloud APK Build via EAS (Recommended)
1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log in or create a free Expo account:
   ```bash
   eas login
   ```
3. Trigger the Android APK build:
   ```bash
   eas build -p android --profile preview
   ```
4. EAS Build will compile the native Android package in the cloud and provide a direct download link for the `.apk` file.

### Option B: Local Prebuild
```bash
npx expo run:android
```

---

## 🔑 Demo Invigilator Credentials

- **Invigilator Email:** `invigilator@gcoea.ac.in`
- **Password:** `invigilator123`
*(Tap the **⚡ Quick Demo Fill** button on the Login screen to autofill instantly).*
