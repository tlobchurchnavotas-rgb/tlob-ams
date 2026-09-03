# TLOB Attendance Management System
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

## 🔑 Default / Demo Login Credentials

When Supabase is not configured, the app falls back to a small local demo set defined in the app. These are for local/offline testing only:

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `admin123`|
| Usher | `usher`  | `usher123`|

> If Supabase Auth is configured, sign in with the actual Supabase user accounts instead of the demo values above.

---

## 📁 Project Structure

```text
TLOB AMS v.1.8/
├── .github/                  ← release automation
├── build/                    ← production web build output
├── build-resources/          ← Electron icon resources
├── desktop.ini
├── electron/                 ← Electron main + preload scripts
├── public/                   ← static assets, app logo, HTML shell
├── src/                      ← React app source
│   ├── App.jsx               ← main app shell, routing, auth state
│   ├── auth.js               ← auth helpers
│   ├── auditLogs.js          ← audit logging helpers
│   ├── components/           ← UI screens and features
│   ├── constants.js          ← logo, seed data, persistence helpers
│   ├── index.js              ← React bootstrap
│   ├── migrate.js            ← Supabase migration utilities
│   ├── publicRegisterApi.js  ← public registration API wrapper
│   ├── roles.js              ← role helpers
│   ├── supabaseClient.js     ← Supabase client configuration
│   └── utils/                ← QR and helper utilities
├── supabase/                 ← SQL schema and migration files
├── tools/                    ← asset generation helpers
├── visitor-register/         ← separate public Vite app for guest check-in
├── package.json
├── README.md
└── .env.example (if present) 
```

---

## ✨ Features

- Dashboard with attendance metrics and celebration summaries
- Member management with QR profile cards and bulk printing
- Events management, attendance tracking, and visitor check-in
- Staff QR scanner and kiosk-style self-check-in flow
- Admin-only reporting, account management, and role-based access
- Optional Supabase backend with row-level security and real tables
- Local fallback behavior when Supabase is offline or unset
- Dark/light mode and browser persistence
- Electron desktop packaging for Windows

---

## 🔧 Configuration and Customization

### Replacing the church logo
Replace the image in `public/logo.png`. If you also want the logo embedded in printed QR cards, update `CHURCH_LOGO_B64` in `src/constants.js`.

### Changing the church name
Search for `The Lord Our Banner` in the app source and update the display strings as needed.

### Supabase setup (recommended)
The app supports both a local demo mode and a real Supabase-backed mode.

1. Create a Supabase project.
2. Open the Supabase SQL editor and run the schema you need:
   - `supabase/schema_auth_rls.sql` for the secure, recommended setup
   - `supabase/schema_real_tables.sql` for the app tables (`members`, `events`, `attendance`, `visitors`)
   - `supabase/schema_realtime.sql` if you want live updates for public registrations or kiosk activity
3. Add a root `.env` file with:

```bash
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

4. Restart the app:

```bash
npm start
```

> If Supabase is not configured, the app falls back to localStorage and demo data.

### Public visitor self-registration (Vercel)
The public check-in site lives under `visitor-register/` and is intentionally separate from the main AMS app.

1. Deploy the Vite app from the `visitor-register` folder on Vercel.
2. Set the project root directory to `visitor-register`.
3. Add these environment variables in Vercel:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Deploy the Edge Function from Supabase:

```bash
supabase secrets set CHURCH_OWNER_ID=00000000-0000-0000-0000-000000000000
supabase functions deploy self-register
```

The `CHURCH_OWNER_ID` should match the Supabase Auth user that owns the AMS data. This is typically the admin user ID in the project.

---

## 🏗️ Building for Production

```bash
npm run build
```

This outputs the web build into the `build/` directory.

---

## 🖥️ Desktop App (Windows) — Electron

This project can also be packaged as a standalone Windows desktop app using Electron.

### Run in development

```bash
npm run electron:dev
```

This starts the React development server and launches Electron against the HTTPS local app URL.

### Create an installer

```bash
npm run electron:dist
```

This builds the React app and creates an installer in the `dist/` folder.

### Create a portable folder

```bash
npm run electron:pack
```

### Publish app updates

```bash
npm version patch
npm run electron:release
```

> If Windows blocks the installer build because of symlink permissions, enable Developer Mode or run the terminal as Administrator.

---

## 📝 Data Storage

The app uses a layered storage approach:

- Local browser storage as the fallback, under keys such as `tlob_members`, `tlob_events`, `tlob_attendance`, `tlob_visitors`, and `tlob_darkMode`
- Supabase tables when configured and signed in
- `app_kv` for small key/value state in the Supabase-backed configuration

To clear local data in a browser, open DevTools → Application → Local Storage and delete the `tlob_*` keys.

---

## ✅ Useful Commands

```bash
npm install
npm start
npm run start:lan
npm run start:lan:https
npm run build
npm run electron:dev
npm run electron:dist
```

This project is designed to work both in the browser and as a packaged desktop application, with Supabase enabled when you want real multi-user data storage.
