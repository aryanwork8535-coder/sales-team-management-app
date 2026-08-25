# FMCG FieldForce Pro — PRD (MVP)

## Overview
A production-oriented FMCG Sales Force Management mobile app (Expo/React Native) with a FastAPI + MongoDB backend for a detergent & home-care company. Field salespersons use it to run their daily beat, add/visit retailers, book orders, collect payments, and track performance.

## Roles
- Super Admin, Sales Manager, Salesperson, Distributor (JWT auth, Employee ID + password).

## MVP Scope — Salesperson Mobile
- **Login** (Employee ID + password, JWT)
- **Home Dashboard**: Good Morning greeting, target progress, KPIs (Sales, Orders, Visits, New Retailers, Collection, Target Left), quick actions, today's beat.
- **Beat Plan**: Ordered retailer list for today's weekday, pending/visited status.
- **Retailers**: Search, add new (GPS auto-capture, duplicate detection by mobile), classification badge.
- **Retailer Profile**: Cover, class badge, outstanding & sales stats, actions (Start Visit / Place Order / Collect / Call / Navigate), recent orders.
- **GPS Visit Tracking**: Start with GPS + timestamp → Complete with result (server-controlled, no manual time entry).
- **Order Booking**: Brand chip filter, product list, +/- stepper, live scheme calculation (DHAMAL & FOAMATIC slabs), sticky bottom bar with total + Place Order.
- **Payment Collection**: Outstanding view, amount, mode (Cash/UPI/Bank/Cheque/Other), reference, remarks. Auto-updates retailer outstanding.
- **Bottom Nav**: Home, Beat, Orders, Retailers, More (Collections, Complaints, Expenses, Attendance, Performance, Logout).

## Backend
- FastAPI + Motor (Mongo). All routes prefixed `/api`. JWT (HS256).
- Collections: users, retailers, products, brands (via products.brand), schemes, scheme_claims, visits, orders, collections, targets, beats, audit_logs, uploads.
- Role-based filters (salespersons see only their retailers/orders).
- **Emergent Managed Object Storage** for file uploads (`/api/upload`, `/api/files/{path}`).
- Auto-seed on first startup: 6 users, 14 products across 4 brands, 2 schemes, 50 retailers, weekday beats for EMP003, daily & monthly targets.

## Design
- Palette: Forest Green (`#0F5A3E`) brand primary, Manrope/Outfit typography, Material Community icons.
- Utility-focused Material You: tonal surfaces, high-contrast, no glassmorphism (per field-use design guidelines).
- 48pt min touch targets, ₹ (Indian) formatting.

## Modules (Iteration 2)
- **Admin Web Panel** (role-based routing: super_admin/sales_manager → `/admin` desktop layout with sidebar): Dashboard (KPI cards, range filters today/7d/30d/all, salesperson performance, brand-wise sales, recent orders), Orders table, Products CRUD (add/edit/toggle active, unique SKU), Users CRUD (add/edit/password reset/deactivate), Expense approvals (approve/reject with bill photo view), Complaint resolution (Open → In Progress → Resolved with note).
- **Attendance**: Start Day / End Day with GPS punch (`/api/attendance/*`), IST date, duration; history list; admin can view all.
- **Expenses**: Salesperson submits (category, amount, remarks, bill photo via Object Storage); Pending → Approved/Rejected by manager or super admin.
- **Complaints**: Salesperson logs against retailer (category, description, photo); admin resolves. Entry from More tab and retailer profile "Log Complaint".
- **Offline Mode**: Orders and visits queue in AsyncStorage on network failure (`src/offline.ts`), auto-sync via NetInfo when back online, home-screen banner with pending count + tap-to-sync. Backend idempotency via `client_id`; offline timestamps honored via `client_time`.
- **Collections list screen** under More tab.

## Modules (Iteration 3)
- **Target Management**: Admin sets daily & monthly sales targets per salesperson (`/admin/targets`, `POST /api/admin/targets` upsert with history via active flag).
- **Performance Screen** (mobile, More tab): rank & top-5 leaderboard for current month, monthly/daily target achievement bars, month stats (orders/visits/collection), 6-month sales trend chart (`GET /api/performance`).
- **Distributor View**: distributor login (EMP004) routes to `/distributor` — KPI header, orders routed to them with Mark Dispatched → Mark Delivered actions (`PUT /api/orders/{id}/status`), scheme claims with Mark Fulfilled (`GET /api/scheme-claims`, `PUT /api/scheme-claims/{id}/fulfil`).
- **Attendance Report** (admin `/admin/attendance`): month-navigable day-wise grid per salesperson (green=full day, amber=started only), cell detail modal with punch times, duration and GPS "View on Map" links (`GET /api/admin/attendance-report?month=YYYY-MM`).

## Security Hardening (Iteration 4 — post security audit)
- Order detail, file download, and collections endpoints now enforce ownership/role checks (BOLA fixes SEC-002/003/004/005).
- Collections validate amount (>0, ≤₹1 Cr) and retailer assignment; distributors denied.
- Public `POST /api/seed` removed (startup auto-seed for empty DB retained).
- Login brute-force protection: 5 failures/60s per employee-ID + per client IP → 5-min 429 block (in-memory, per-process); constant-time dummy bcrypt against user enumeration.
- JWT secret rotated to 64-hex; server refuses to boot with a secret <32 bytes; regex injection fixed (re.escape on search, validated month regex).
- KNOWN ACCEPTED RISKS (preview): seeded demo credentials retained for testing — MUST be rotated via Admin → Users before production launch; CORS `*` (bearer tokens, no cookies); 30-day token expiry; in-memory limiter is per-process.

## Master Data — fully database-driven (Iteration 5)
- Admin CRUD (all `require_admin`, salesperson 403): **Products** (details, prices, GST, image, active), **Brands** (logo, rename cascades to products/schemes), **Retailers** (search + full edit incl. salesperson/distributor/territory assignment, status), **Users** (manager for salespersons, assigned salespersons for distributors, territory), **Territories** (district, rename cascades to users/retailers/beats), **Beats** (salesperson/day/territory/route/retailer multi-select, active flag respected by mobile dashboard), **Schemes** (slabs+gifts, start/end dates, territory & distributor scoping — order eligibility auto-applied at booking & respects active/date/scope), **Targets** (salesperson/distributor/territory × daily/monthly), **Settings** (company details + product categories, no-order reasons, complaint types, expense categories).
- Mobile reads all lists from `GET /api/settings` (expense categories, complaint types, no-order reasons in the new visit-outcome sheet) — changes propagate immediately, nothing hard-coded.
- Startup `migrate_master_data()` (idempotent): seeds brands from product brands, territories from user/beat strings, default settings — never touches existing records.

## Deferred (future iterations)
Advanced reports/exports, notifications, beat plan management from admin, retailer credit-limit enforcement.

## Test Credentials
See `/app/memory/test_credentials.md`.
