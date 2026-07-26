# Finishing Pro — Technical Specification

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Status:** Active Development (Staging)

---

## 1. Project Overview

**Finishing Pro** is a construction finishing management platform for tracking interior finishing activities across residential towers. It enables admins to upload activity schedules from Excel files and allows site supervisors to update progress in real time via mobile or desktop.

### Key Users
| Role | Access | Device |
|------|--------|--------|
| Admin (Head Office) | Full dashboard, upload, reports, manage supervisors | Desktop |
| Site Supervisor | View assigned floors, update activity status | Mobile + Desktop |

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.11 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS (v4 PostCSS plugin) | ^4 |
| Backend / Auth / DB | Supabase (free tier) | supabase-js ^2.110.8 |
| Excel Parsing | SheetJS (xlsx) | ^0.18.5 |
| Deployment | Vercel (Preview on `staging` branch) | — |

### Cost Implications
- **Supabase Free Tier:** 50,000 monthly active users, 500 MB database, 1 GB storage. No cost for current usage.
- **Vercel Free Tier:** Sufficient for preview deployments and moderate production traffic.
- **No external paid APIs** are used in this project.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vercel (Hosting)                   │
├─────────────────────────────────────────────────────┤
│  Next.js App Router                                 │
│  ┌───────────────┐  ┌────────────────────────────┐  │
│  │ Client Pages  │  │ API Routes (Server-side)   │  │
│  │ /admin/*      │  │ /api/admin/create-supervisor│  │
│  │ /supervisor/* │  │ /api/admin/reset-password   │  │
│  │ /login        │  │ /api/admin/deactivate-sup   │  │
│  └───────┬───────┘  └──────────┬─────────────────┘  │
│          │                     │                    │
│          │ (anon key)          │ (service_role key) │
│          ▼                     ▼                    │
│  ┌─────────────────────────────────────────────┐    │
│  │         Supabase (PostgreSQL + Auth)         │    │
│  │  • profiles   • projects   • activities      │    │
│  │  • supervisor_assignments  • uploads         │    │
│  │  • RLS Policies  • Triggers  • Functions     │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Client-side rendering with auth guards** — All pages are `'use client'`. Layouts enforce role-based access.
2. **Server-side API routes for admin operations** — Creating/deactivating supervisors uses the Supabase `service_role` key via Next.js Route Handlers. This prevents logging out the admin during user creation.
3. **Row-Level Security (RLS)** — All tables have RLS enabled. A `SECURITY DEFINER` helper function `is_admin()` prevents infinite recursion when checking admin policies on the `profiles` table.
4. **Paginated fetches** — Activity queries use `.range()` pagination in chunks of 1000 to bypass Supabase's default 1000-row limit.

---

## 4. Authentication & Authorization

### Auth Flow

| Action | Method |
|--------|--------|
| Admin login | `supabase.auth.signInWithPassword()` → redirects to `/admin/dashboard` |
| Supervisor login | `supabase.auth.signInWithPassword()` → redirects to `/supervisor/home` |
| Create supervisor | `POST /api/admin/create-supervisor` → `supabase.auth.admin.createUser()` (server-side) |
| Password reset | `POST /api/admin/reset-password` → `supabase.auth.admin.updateUserById()` (server-side) |
| Session refresh | `visibilitychange` listener calls `supabase.auth.getSession()` when tab regains focus |

### Role-Based Access Control

| Route Pattern | Admin | Supervisor | Unauthenticated |
|---------------|-------|------------|-----------------|
| `/admin/*` | Allowed | Redirected to `/supervisor/home` | Redirected to `/login` |
| `/supervisor/*` (except login) | Redirected to `/admin/dashboard` | Allowed | Redirected to `/supervisor/login` |
| `/supervisor/login` | Redirected to `/admin/dashboard` | Public | Public |
| `/login` | Public | Public | Public |

### Enforcement Points
- **`src/app/admin/layout.tsx`** — Checks `profile.role === 'admin'`. Non-admins redirected.
- **`src/app/supervisor/layout.tsx`** — Checks user exists and role is not admin. Admins redirected. Login page exempted from auth guard.
- **Supabase RLS** — Database-level enforcement ensures supervisors can only read/update their assigned project data.

---

## 5. Database Schema

### Tables

#### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK, FK → auth.users) | User ID from Supabase Auth |
| role | TEXT | `'admin'` or `'supervisor'` |
| full_name | TEXT | Display name |
| phone | TEXT | Contact number |
| email | TEXT | Email address |
| is_active | BOOLEAN | Account active status |
| created_at | TIMESTAMPTZ | Auto-set |
| updated_at | TIMESTAMPTZ | Auto-updated via trigger |

#### `projects`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| name | TEXT | Project name |
| location | TEXT | Site location |
| status | TEXT | `'active'`, `'completed'`, `'on_hold'` |
| total_floors | INTEGER | Number of floors |
| total_flats | INTEGER | Number of flats |
| has_template | BOOLEAN | Whether Excel data has been uploaded |
| created_by | UUID (FK → auth.users) | Admin who created |
| created_at / updated_at | TIMESTAMPTZ | Timestamps |

#### `activities`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| project_id | UUID (FK → projects) | Parent project |
| floor | INTEGER | Floor number |
| flat_number | INTEGER | Flat/unit number |
| configuration | TEXT | Flat type (1BHK, 2BHK, etc.) |
| stage | TEXT | Work stage |
| stage_gate | TEXT | Stage gate identifier |
| activity | TEXT | Activity description |
| vendor | TEXT | Assigned vendor |
| status | TEXT | `not_started`, `in_progress`, `completed`, `delayed`, `on_hold` |
| actual_start / actual_end | TEXT | Dates set by supervisors |
| delay_days | INTEGER | Calculated delay |
| sort_order | INTEGER | Display order |
| ... | | Additional tracking fields |

#### `supervisor_assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| supervisor_id | UUID (FK → profiles) | Assigned supervisor |
| project_id | UUID (FK → projects) | Assigned project |
| assigned_floors | INTEGER[] | Array of floor numbers |
| allow_vendor_reassignment | BOOLEAN | Permission flag |
| UNIQUE(supervisor_id, project_id) | | Prevents duplicates |

#### `uploads`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| project_id | UUID (FK → projects) | Related project |
| file_name | TEXT | Original filename |
| total_rows | INTEGER | Rows uploaded |
| uploaded_by | UUID (FK → auth.users) | Admin who uploaded |
| uploaded_at | TIMESTAMPTZ | Upload timestamp |

### Database Functions & Triggers

| Name | Purpose |
|------|---------|
| `is_admin()` | SECURITY DEFINER function that checks if current user is admin. Used in all admin RLS policies to avoid infinite recursion. |
| `handle_new_user()` | Trigger function that auto-creates a `profiles` row when a new user is inserted into `auth.users`. Reads role/name from `raw_user_meta_data`. |
| `update_updated_at()` | Trigger function that sets `updated_at = now()` on row update. |

### RLS Policy Summary

| Table | Admin | Supervisor |
|-------|-------|------------|
| profiles | Full CRUD | Read own only |
| projects | Full CRUD | Read assigned only |
| activities | Full CRUD | Read + Update assigned only |
| uploads | Full CRUD | Read assigned only |
| supervisor_assignments | Full CRUD | Read own only |

---

## 6. API Routes (Server-Side)

All routes use the `SUPABASE_SERVICE_ROLE_KEY` (never exposed to browser).

### `POST /api/admin/create-supervisor`
**Purpose:** Create a new supervisor account without logging out the admin.

| Field | Type | Required |
|-------|------|----------|
| email | string | Yes |
| password | string | Yes |
| fullName | string | Yes |
| phone | string | No |

**Flow:** `auth.admin.createUser()` → profile auto-created by trigger → phone/name updated.

### `POST /api/admin/reset-password`
**Purpose:** Reset a supervisor's password.

| Field | Type | Required |
|-------|------|----------|
| userId | string | Yes |
| newPassword | string | Yes |

### `POST /api/admin/deactivate-supervisor`
**Purpose:** Deactivate or reactivate a supervisor (bans/unbans from auth).

| Field | Type | Required |
|-------|------|----------|
| userId | string | Yes |
| isActive | boolean | Yes |

**Flow:** Updates `profiles.is_active` AND bans/unbans the auth user.

---

## 7. Page Structure

```
src/app/
├── layout.tsx              # Root layout with AuthProvider
├── auth-wrapper.tsx        # Auth wrapper component
├── page.tsx                # Landing → redirects to /login
├── login/page.tsx          # Admin login
├── admin/
│   ├── layout.tsx          # Auth guard (admin only) + Sidebar + TopBar + ProjectProvider
│   ├── dashboard/page.tsx  # Health Score gauge + activity list
│   ├── upload/page.tsx     # Excel upload + preview + save to Supabase
│   ├── supervisors/page.tsx# Manage supervisors (CRUD, assign floors)
│   ├── projects/page.tsx   # Manage projects
│   ├── reports/page.tsx    # Vendor performance reports
│   └── audit-log/page.tsx  # Activity history
├── supervisor/
│   ├── layout.tsx          # Auth guard (supervisor only)
│   ├── login/page.tsx      # Supervisor login (public)
│   └── home/page.tsx       # Supervisor dashboard
└── api/admin/
    ├── create-supervisor/route.ts
    ├── reset-password/route.ts
    └── deactivate-supervisor/route.ts
```

---

## 8. Key Features

### 8.1 Health Score (Dashboard)
Replaces simple status tiles with a 0–100 composite score.

**Formula:**
```
Health Score = Progress (40%) + On-Time Quality (30%) + Risk Exposure (30%)

Progress       = (completed / total) × 100
On-Time Quality = ((completed_on_time + in_progress_on_time) / (completed + in_progress)) × 100
Risk Exposure  = (1 − (delayed + on_hold) / total) × 100
```

**Color Bands:** Green (80+), Yellow (60–79), Orange (40–59), Red (0–39)

### 8.2 Excel Upload
- Parses "Sale Unit wise status" sheet from uploaded `.xlsx`
- Skips first 7 header rows, filters invalid rows
- Uploads in 18 chunks of 500 rows each (session refreshed before upload)
- Column mapping: row[2]=floor, row[3]=flat, row[4]=config, row[5]=stage, row[6]=stageGate, row[7]=activity, row[8]=vendor, row[14]=status

### 8.3 Delete Safeguard
Before admin deletes uploaded data, the system checks if supervisors have modified any activities (status changed from `not_started`, or `actual_start`/`actual_end` set). If so, a warning is displayed with the count of modified activities.

### 8.4 Supervisor Management
- Create supervisor accounts with email + temporary password
- Assign to projects and specific floors
- Reset passwords
- Deactivate/reactivate accounts (bans from Supabase Auth)
- All operations via server-side API (preserves admin session)

---

## 9. Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (secret, for admin API routes) |

**Important:** `SUPABASE_SERVICE_ROLE_KEY` must NEVER be prefixed with `NEXT_PUBLIC_` — it should only execute on the server.

---

## 10. Errors Identified & Resolved

### 10.1 RLS Infinite Recursion (`42P17`)
**Error:** `infinite recursion detected in policy for relation 'profiles'`  
**Root Cause:** Admin RLS policies on the `profiles` table contained `EXISTS (SELECT 1 FROM profiles WHERE ...)` — a self-referencing subquery that triggered PostgreSQL's recursion guard.  
**Fix:** Created `is_admin()` as a `SECURITY DEFINER` function (bypasses RLS) and replaced all admin policy checks with `public.is_admin()`.  
**Impact:** Critical — blocked all admin operations including project creation.

### 10.2 Activity Fetch Truncated at 1000 Rows
**Error:** Dashboard showed only 1000 of 8,880+ activities.  
**Root Cause:** Supabase's default query limit is 1000 rows per request. A single `.select('*')` without `.range()` silently truncates results.  
**Fix:** Implemented pagination in `getActivitiesFromSupabase()` using `.range(from, from + 999)` in a loop until fewer than 1000 rows are returned.  
**Impact:** High — supervisors couldn't see most of their assigned activities.

### 10.3 JWT Expired After Tab Backgrounded
**Error:** `JWT expired` errors after returning to a backgrounded tab.  
**Root Cause:** Supabase's auto-refresh timer doesn't fire reliably when the browser tab is inactive (browser throttles timers).  
**Fix:** Added a `visibilitychange` event listener that calls `supabase.auth.getSession()` when the tab becomes visible. Also handles `SIGNED_OUT` event to clear stale profile state.  
**Impact:** Medium — users had to manually refresh the page after leaving it idle.

### 10.4 Data Lost After Logout/Login Cycle
**Error:** Projects and activities disappeared after logout then re-login.  
**Root Cause:** `ProjectProvider` fetched projects once on mount but didn't re-fetch when auth state changed. After logout, the project list was cleared but never repopulated on re-login.  
**Fix:** Made `refreshProjects` depend on the `user` state from `useAuth()`. When `user` changes (login/logout), projects are re-fetched.  
**Impact:** High — appeared as data loss to the user.

### 10.5 Supervisor Login Page Infinite Spinner
**Error:** Supervisor login page (`/supervisor/login`) showed loading spinner indefinitely.  
**Root Cause:** The supervisor layout's auth guard required `user` to be present before rendering children. Since the login page is where unauthenticated users land, this created a deadlock.  
**Fix:** Used `usePathname()` to detect the login route and skip the auth guard on `/supervisor/login`.  
**Impact:** Critical — supervisors couldn't access the login page at all.

### 10.6 Project Save Stuck on "Saving..."
**Error:** Clicking "Save" in the project creation modal showed "Saving..." indefinitely with no error feedback.  
**Root Cause:** No `try/catch` in the `handleSave` function. Supabase errors (particularly the RLS recursion error) were thrown but never caught, so the loading state was never reset.  
**Fix:** Wrapped `handleSave` in `try/catch/finally`. Extract error details from Supabase's `PostgrestError` format (`{ message, details, hint, code }`). Display error in the modal.  
**Impact:** Medium — poor UX with no error feedback.

### 10.7 Admin Session Lost When Creating Supervisor (Prevented)
**Error:** (Proactively prevented, never hit in production)  
**Root Cause:** Using `supabase.auth.signUp()` on the client creates a new user AND switches the session to that user if auto-confirm is enabled. This would log out the admin.  
**Fix:** Moved supervisor creation to a server-side API route using `supabase.auth.admin.createUser()` with the service role key. The admin's browser session is unaffected.  
**Impact:** Would have been Critical — admin would be logged out every time they created a supervisor.

### 10.8 Supervisor Accessing Admin Pages (Prevented)
**Error:** A logged-in supervisor could manually navigate to `/admin/*` and see admin pages.  
**Root Cause:** The admin layout's auth guard was temporarily relaxed to only check `!user` without verifying `profile.role === 'admin'`.  
**Fix:** Re-added role check: `if (profile.role !== 'admin') router.replace('/supervisor/home')`. Also added the inverse check in supervisor layout to redirect admins.  
**Impact:** High — security issue allowing unauthorized access.

---

## 11. Deployment

### Branching Strategy
| Branch | Purpose |
|--------|---------|
| `staging` | Active development, auto-deploys to Vercel Preview |
| `main` | Production (when ready) |

### Deploy Steps
1. Push to `staging` → Vercel auto-deploys preview
2. Set environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Supabase Setup
1. Run `supabase-schema.sql` in SQL Editor (creates all tables, RLS, triggers)
2. Create first admin user manually in Supabase Auth Dashboard
3. Update that user's profile: `UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com'`

---

## 12. File Reference — Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client initialization (anon key) |
| `src/lib/auth-context.tsx` | Auth provider (user, profile, session, signIn/Out) |
| `src/lib/project-context.tsx` | Project provider (current project, list, refresh) |
| `src/lib/supabase-data.ts` | All Supabase CRUD operations (paginated reads, supervisor management) |
| `src/lib/project-data-store.ts` | Excel file parser (xlsx → activity rows) |
| `src/lib/types.ts` | TypeScript interfaces |
| `src/components/admin/HealthScore.tsx` | Health Score gauge component |
| `src/components/admin/SupervisorModal.tsx` | Add/edit supervisor form modal |
| `supabase-schema.sql` | Complete database schema (run in SQL Editor) |

---

## 13. Known Limitations

1. **Supabase Free Tier Limits:** 500 MB database, 50K MAU, 2 GB bandwidth/month
2. **No real-time subscriptions:** Activity updates require manual refresh (not using Supabase Realtime)
3. **Excel format dependency:** Parser expects "Sale Unit wise status" sheet with specific column layout
4. **No email notifications:** Supervisors must be told their credentials manually
5. **Audit log uses mock data:** Not yet wired to real Supabase audit trail
6. **Reports page uses mock data:** Vendor performance not yet calculated from real activities
