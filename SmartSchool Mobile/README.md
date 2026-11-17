# SmartSchool Mobile (React Native + Expo SDK 58)

Native mobile application for the **SmartSchool MIS Platform** (Uganda Curriculum & School Management), built with **React Native**, **Expo SDK 58**, **TypeScript**, and **Zustand**.

Located alongside `TradeDesk Mobile` in the root workspace directory:
```
c:\xampp\htdocs\ax-website\
├── TradeDesk Mobile\
└── SmartSchool Mobile\
```

---

## 🚀 Key Features & Modules

### 1. **Authentication & Multi-Tenant Support**
- **School Domain Selector**: Preset quick-picks (Demo School, St. Mary's, King's College, Gayaza) + custom domain input (`<subdomain>.smartschool.ug`).
- **Staff Credentials**: Secure sign-in with email/username and password with eye toggle.
- **Offline / Demo Mode**: Instant preview without network dependencies.

### 2. **Dashboard / Home Tab (`HomeScreen.tsx`)**
- Live KPI grid: Total Students, Today's Attendance %, Staff On Duty, Lessons Today.
- School term badge (e.g. `Term 1 • 2026`) and school status indicator.
- Quick action shortcuts to Take Roll Call, Enter Marks, or View Schedule.
- Urgent Announcements carousel with pop-up detail reader.
- Today's live lessons preview with real-time slot tracking.

### 3. **Attendance Roll Call (`AttendanceScreen.tsx`)**
- Class (S.1–S.6) and Stream (North, East, West, All) pill filters.
- Real-time roll call counts: Total, Present (green), Absent (red), Late (amber).
- **1-Tap Roster Actions**: Fast toggling between Present, Absent, and Late.
- "All Present" bulk shortcut.
- Instant search filter by Student Name or LIN.
- Bulk sync button with offline fallback queue.

### 4. **Record Marks (`RecordMarksScreen.tsx`)**
- Switch between **New Lower Secondary Curriculum (Activities / Competencies A1–A3)** and **End of Term Exams (Papers 1–3)**.
- **Competency Grading**: Rapid 1, 2, or 3-score buttons (/3).
- **Exam Grading**: Direct numeric marks input (/100).
- Debounced auto-save with green checkmark feedback (`✓ Saved`).
- Roster progress indicator (e.g. `48 / 52 scored`).

### 5. **Timetable & Daily Schedule (`TimetableScreen.tsx`)**
- Monday through Saturday day tabs with automatic current-day highlighting.
- Live lesson badge (`LIVE NOW`) for currently active periods.
- Subject name, class & stream, room name, and assigned teacher.
- Floating "+ Add Lesson" button with modal schedule form.
- Lesson slot deletion with confirmation dialog.

### 6. **Settings & Offline Sync (`SettingsScreen.tsx`)**
- Staff Profile card with role and school information.
- Dark Mode / Light Mode toggle.
- Offline data sync status & "Sync Now" button.
- Local cache refresh.
- Sign out action.

---

## 🛠️ Project Structure

```
SmartSchool Mobile/
├── assets/                  # Brand logos, icons, and splash assets
├── src/
│   ├── api/                 # REST API endpoints for SmartSchool backend
│   │   ├── client.ts        # Base HTTP fetch client with token handling
│   │   ├── attendanceApi.ts # Student rosters & attendance saving
│   │   ├── dashboardApi.ts  # Stats & announcement polling
│   │   ├── marksApi.ts      # Continuous assessment & exam mark saving
│   │   └── timetableApi.ts  # Schedule retrieval & lesson management
│   ├── components/          # Reusable Native UI components
│   │   ├── AddLessonModal.tsx
│   │   ├── AnnouncementModal.tsx
│   │   ├── AppHeader.tsx
│   │   ├── BottomNav.tsx
│   │   ├── KPICard.tsx
│   │   ├── NotificationSheet.tsx
│   │   ├── StudentAttendanceCard.tsx
│   │   ├── StudentMarkCard.tsx
│   │   └── TimetableLessonCard.tsx
│   ├── screens/             # Core 6 screens
│   │   ├── AttendanceScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── RecordMarksScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── TimetableScreen.tsx
│   ├── store/
│   │   └── authStore.ts     # Zustand global store (user, school, dark mode)
│   ├── theme/
│   │   └── colors.ts        # Teal & Slate Dark/Light color tokens
│   └── types/
│       └── index.ts         # TypeScript models
├── App.tsx                  # Root navigation & state container
├── app.json                 # Expo configuration
├── package.json             # Dependencies
└── tsconfig.json            # TypeScript configuration
```

---

## 🏃 Running the Application

### 1. Start the Expo Development Server
```bash
npx expo start
```

### 2. Run on Android Emulator or Device
```bash
npx expo start --android
```

### 3. Run on iOS Simulator or Device
```bash
npx expo start --ios
```

### 4. Run in Web Browser
```bash
npx expo start --web
```
