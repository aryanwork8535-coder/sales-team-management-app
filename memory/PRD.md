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

## Deferred (future iterations)
Admin web dashboard, complaints CRUD, expenses & attendance modules, targets management UI, offline sync, advanced reports, notifications, image uploads on visits/receipts UI (backend endpoints ready).

## Test Credentials
See `/app/memory/test_credentials.md`.
