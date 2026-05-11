# TLOB Attendance System
**The Lord Our Banner Christian Church**  
Church Attendance Management System

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher
- npm (comes with Node.js)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm start
npm run start:lan:https
```

The app will open at **http://localhost:3000**

---

## 🌐 Local Network (iPad / Phone) Access (No Publishing)

You can access the system **locally only** (same Wi‑Fi) from an iPad/tablet/phone browser.

### 1) Start the dev server on your LAN

```bash
npm run start:lan
```

### 2) Allow Windows Firewall (one-time)
When Windows prompts, allow access for **Private networks**.

### 3) Open the app from your iPad
On the PC, find your LAN IP (example: `192.168.1.29`). Then on iPad Safari open:

- `http://192.168.1.29:3000`

> Tip: You can generate a QR code for that URL and scan it on the iPad.

### Camera QR scanning note (iPad Safari)
If you want the **in-browser camera scanner** on iPad, iOS Safari typically requires **HTTPS**.

Start the dev server with HTTPS:

```bash
npm run start:lan:https
```

If iOS warns about the certificate, you’ll need to trust it on the iPad (this is normal for local dev HTTPS).

---

## 🔑 Default Login Credentials

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `admin123`|
| Usher | `usher`  | `usher123`|

---

## 📁 Project Structure

```
tlob-church-app/
├── public/
│   ├── index.html
│   └── logo.png              ← Church logo
├── src/
│   ├── App.jsx               ← Main app (routing, state, layout)
│   ├── index.js              ← React entry point
│   ├── constants.js          ← Logo, seed data, usePersisted hook
│   ├── utils/
│   │   └── qr.js             ← QR code generator (SVG, no library needed)
│   └── components/
│       ├── Icon.jsx           ← SVG icon system
│       ├── Avatar.jsx         ← Member avatar (photo or initial)
│       ├── Charts.jsx         ← BarChart, LineChart, DonutChart
│       ├── LoginPage.jsx      ← Login screen
│       ├── KioskView.jsx      ← Self-service kiosk mode
│       ├── DashboardView.jsx  ← Overview & stats
│       ├── MembersView.jsx    ← Member list + BulkPrintModal
│       ├── MemberProfile.jsx  ← Individual member profile & QR print
│       ├── EventsView.jsx     ← Event management
│       ├── ScannerView.jsx    ← QR scanner (staff)
│       ├── AttendanceView.jsx ← Attendance logs
│       ├── ReportsView.jsx    ← Attendance & absentee reports
│       ├── VisitorsView.jsx   ← Visitor tracking
│       ├── CelebrationsView.jsx ← Birthdays & anniversaries
│       └── UserMgmtView.jsx   ← App user management (Admin)
├── package.json
└── README.md
```

---

## ✨ Features

- **Dashboard** — Stats, charts, upcoming celebrations widget
- **Members** — CRUD, photo upload, CSV bulk import, QR ID card print, **Bulk Print QR** with filters
- **Events** — Create/manage events with templates
- **QR Scanner** — Manual + camera scan for check-in (staff mode)
- **Kiosk Mode** — Self-service entrance scanner (fullscreen)
- **Attendance Logs** — Filterable records
- **Reports** — Attendance & absentee reports (PDF/CSV export), Admin only
- **Visitors** — Log walk-in visitors, convert to member
- **Celebrations** — Birthday & anniversary tracker
- **User Management** — Manage app users (Admin only)
- **Dark / Light Mode**
- **Local Storage** — All data persists in browser (prefix: `tlob_`)

---

## 🔧 Customization

### Replacing the Church Logo
Replace `public/logo.png` with your image. Also update `CHURCH_LOGO_B64` in `src/constants.js` if you want it embedded in printed QR cards (convert your image to base64).

### Changing Church Name
Search for `"The Lord Our Banner"` in `src/App.jsx`, `src/constants.js`, and component files.

### Connecting a Real Backend
Currently the app can persist data to either:
- **localStorage** (default / offline)
- **Supabase** (real database) — when configured via environment variables

#### Supabase setup (recommended)
1. Create a Supabase project.
2. In the Supabase dashboard: **SQL Editor** → run **one** of these:
   - `supabase/schema_auth_rls.sql` (**recommended**) — enables Supabase Auth + secure per-user storage
   - `supabase/schema.sql` (legacy/demo) — anonymous read/write (not recommended for production)
3. Create a `.env` file in the project root with:

```bash
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Restart `npm start`.

#### Next phase: Real tables (recommended)
After Auth is working, run `supabase/schema_real_tables.sql` to create real tables:
- `members`
- `events`
- `attendance`
- `visitors`

The app will automatically load/save those datasets for the signed-in user.

The app previously stored data in `app_kv`. That is now only used for small key/value state (and the app will still fall back to localStorage if Supabase is offline).
If Supabase is not configured or is temporarily offline, it will fall back to localStorage.

> Security note: `supabase/schema_auth_rls.sql` requires users to sign in via Supabase Auth and uses Row Level Security (RLS) so users can only access their own data.

### Enabling Real QR Camera Scanning
The camera scanner uses `html5-qrcode` loaded from CDN. This works fine locally — just make sure you're on **https** or **localhost** so the browser allows camera access.

---

## 🏗️ Building for Production

```bash
npm run build
```

Output goes to the `build/` folder. Deploy to any static host (Vercel, Netlify, GitHub Pages, etc.).

---

## 🖥️ Desktop App (Windows) — Electron

This project can be packaged as a standalone Windows desktop app using **Electron + electron-builder**.

### One-time setup

```bash
npm install
```

### Run as a desktop app (dev)

Starts the React dev server and launches Electron.

```bash
npm run electron:dev
```

### Build an installer (.exe)

This will:
- generate app icons (`public/logo.png`, `build-resources/icon.ico`)
- build the React production bundle
- create an installer in the `dist/` folder

```bash
npm run electron:dist
```

> If the build fails with a symlink permission error like:
> `"A required privilege is not held by the client"`  
> enable **Windows Developer Mode** (Settings → Privacy & security → For developers → Developer Mode)
> or run the build from an **Administrator** terminal. This is required so `electron-builder` can unpack its Windows helper tools.

### Build a “portable folder” (no installer)

```bash
npm run electron:pack
```

### Publish auto-updates via GitHub Releases (recommended)

This project uses a safer two-step workflow:
- pushing a version tag (`v*`) creates a **draft** GitHub Release with installer/update assets
- you manually publish that draft when you are ready for public rollout

1. Update app version in `package.json`:

```bash
npm version patch
```

Use `minor` or `major` when needed.

2. Push commit and tag to GitHub:

```bash
git push && git push --tags
```

3. GitHub Actions runs `.github/workflows/release.yml` and creates a **draft** release for that tag with installer/update assets.

4. If you build locally instead, use the new release script to publish draft GitHub update metadata:

```bash
npm run electron:release
```

5. After publishing the draft, installed app clients can fetch the update through the built-in updater.

---

## 📝 Data Storage

All data is stored in `localStorage` with the prefix `tlob_`:
- `tlob_members` — Member records
- `tlob_events` — Events
- `tlob_attendance` — Attendance logs
- `tlob_users` — App users
- `tlob_visitors` — Visitor records
- `tlob_darkMode` — Theme preference

To reset all data, open browser DevTools → Application → Local Storage → clear all `tlob_*` keys.
