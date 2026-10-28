# Fynly — Agent Operating Guidelines & Architecture Blueprint

This document sets the ground rules, conventions, and architectural constraints for any AI agent or engineer working on **Fynly**.

---

## 1. Core Principles & Non-Negotiables

1. **Stage-by-Stage Execution**:
   - Work **only** on the current approved stage.
   - Stop and present results at the end of each stage. Do not move to the next stage without explicit user approval.
2. **Simplified Backend Architecture (No Overengineering)**:
   - All API endpoints and business logic **must live in controllers** (`src/controllers/`).
   - **Do NOT create a `services/` directory**, repositories, domain layers, use cases, or factory abstractions.
   - Shared calculations and reusable pure functions live in `src/utils/`.
   - Routes purely map HTTP verbs/paths to controllers.
   - Middleware handles authentication, request validation (Zod), and centralized error handling.
3. **Financial Precision & Integrity**:
   - Store all monetary values as **integer paise** (e.g. `10000` = ₹100.00) in database models and internal calculations.
   - **Never use floating-point numbers** for monetary math to prevent precision loss.
   - Clearly delineate between confirmed, pending, refund, reversal, and transfer transactions.
   - Prevent duplicate imports through deterministic transaction fingerprinting / hashing.
   - **Never fake financial data** or simulate working bank integrations without genuine authorized APIs.
4. **Database Safety**:
   - Use PostgreSQL with Prisma ORM and migrations.
   - **Never delete or reset an existing database** without explicit user permission.
5. **Testing Verification**:
   - Never report a test as passed unless it was actually executed and verified via test runner output.
6. **Premium Mobile UX**:
   - Build for Expo (React Native) + Expo Router with a sleek, modern aesthetic (tailored dark palette, polished charts, fluid micro-interactions, clean typography).
   - Ensure complete state handling: loading skeletons, errors, empty states, and stale data indicators.

---

## 2. Monorepo Structure

```text
fynly/
├── apps/
│   ├── mobile/
│   │   ├── app/                # Expo Router file-based screens & navigation
│   │   ├── components/         # Reusable UI components (buttons, cards, charts)
│   │   ├── hooks/              # Custom React hooks (queries, state)
│   │   ├── lib/                # API client, utility functions, theme tokens
│   │   ├── types/              # Mobile TypeScript interfaces & schemas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── app.json
│   └── backend/
│       ├── src/
│       │   ├── config/         # Environment validation (Zod), constants
│       │   ├── controllers/    # ALL business logic & request handling (NO services)
│       │   ├── middleware/     # Auth, Zod validation, error handler, rate limits
│       │   ├── routes/         # Express router endpoints mapped to controllers
│       │   ├── utils/          # Pure helpers, date/paise math, hashing
│       │   ├── app.ts          # Express app configuration & middleware pipeline
│       │   └── server.ts       # HTTP listener bootstrap
│       ├── prisma/
│       │   ├── schema.prisma   # PostgreSQL schema & relations
│       │   └── migrations/     # Prisma migration history
│       ├── tests/              # Supertest API tests, unit tests for calculations
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── package.json                # Root workspace configuration
├── README.md                   # Project overview & developer guide
└── AGENTS.md                   # This file
```

---

## 3. Tech Stack Specifications

| Layer | Technology | Key Details |
|---|---|---|
| **Mobile App** | Expo (React Native) + TypeScript | Expo Router (v4+), React Native Reanimated, Lucide Icons |
| **Data Fetching** | TanStack Query (React Query v5) | Caching, optimistic updates, query invalidation |
| **Client State** | React Context / Zustand (only if needed) | Lightweight global session / preferences state |
| **Backend API** | Node.js + Express + TypeScript | Strict TypeScript, modular routes, controller-based logic |
| **Validation** | Zod | End-to-end schema validation (request bodies, query params, env vars) |
| **Database** | PostgreSQL | Hosted locally or via container / managed service |
| **ORM** | Prisma ORM | Type-safe queries, migration tracking |
| **Authentication**| JWT (Access + Refresh tokens) + Argon2 / bcrypt | Password hashing, secure bearer token middleware |
| **Testing** | Vitest / Jest + Supertest | Unit tests for financial utils, integration tests for endpoints |

---

## 4. Financial Data Model Specifications

- **Monetary Unit**: All amounts stored in database as `BigInt` or `Int` representing **paise** (`1 INR = 100 paise`).
- **Transaction Types**: `INCOME`, `EXPENSE`, `TRANSFER`, `REFUND`.
- **Transaction Status**: `PENDING`, `SETTLED`, `CANCELLED`.
- **Account Types**: `SAVINGS`, `CURRENT`, `CREDIT_CARD`, `WALLET`, `CASH`.
- **Budgets**: `DAILY`, `WEEKLY`, `MONTHLY`, `CATEGORY_SPECIFIC` with configurable alert thresholds (e.g., 70%, 90%, 100%).
- **Deduplication Key**: Hashed fingerprint `sha256(userId + accountId + date + amountInPaise + normalizedMerchant)` to reject duplicate manual entries or CSV rows.

---

## 5. UI/UX Blueprint & Navigation

Bottom Tab Navigation (Expo Router):
1. **Home (`/`)**:
   - Total net balance & safe-to-spend today widget.
   - Recent spending vs. budget status bar.
   - Quick action buttons (Add Expense, Add Income, Import Statement).
   - Recent 5 transactions.
2. **Activity (`/activity`)**:
   - Comprehensive searchable transaction history.
   - Multi-facet filters: Date range, Account, Category, Type (Income/Expense).
   - Transaction details modal with category re-assignment & receipt note.
3. **Budgets (`/budgets`)**:
   - Overall monthly allowance gauge & remaining days breakdown.
   - Category-wise progress bars with threshold warnings (Amber at 70%, Orange at 90%, Red at 100%).
   - Create/Edit budget flow.
4. **Insights (`/insights`)**:
   - Spending breakdown donut/bar charts.
   - Week-over-week and month-over-month trends.
   - Top merchants and recurring subscriptions detection.
5. **Profile (`/profile`)**:
   - User account settings & active session management.
   - Linked financial accounts / manual accounts management.
   - Notification thresholds configuration.
   - Data export / Statement import history.

---

## 6. Implementation Stages & Status Tracker

- [x] **Stage 1 — Inspect and plan** (COMPLETED)
  - Inspect existing workspace (confirmed empty).
  - Create `README.md` and `AGENTS.md`.
  - Present concise implementation plan, major decisions, and risks.
  - Await user approval.
- [x] **Stage 2 — Foundation** (COMPLETED)
  - Initialize monorepo workspace (`apps/backend` and `apps/mobile`).
  - Set up Express + TypeScript backend with Zod env validation, error middleware, and health check.
  - Set up Prisma with PostgreSQL connection and initial schema skeleton.
  - Set up Expo mobile app with Expo Router and design system tokens.
  - Verify both services boot and connect cleanly.
- [x] **Stage 3 — Authentication and transactions** (COMPLETED)
  - Implement User and Account models with password hashing.
  - Registration, login, token refresh, and protected routes.
  - Category and Transaction models.
  - Transaction CRUD endpoints in controllers, CSV deduplication hash.
  - Mobile screens: Auth (Login/Register), Home balance widget, Manual Transaction entry modal, and Activity list.
- [x] **Stage 4 — Budgets and dashboard** (COMPLETED)
  - Budget & BudgetCategory models.
  - Calculations for period boundaries, category spending, safe-to-spend allowance.
  - Automated tests for money calculations and date boundaries.
  - Mobile screens: Budgets tab with progress bars, budget setup, and Home dashboard integration.
- [x] **Stage 5 — Alerts and CSV import** (COMPLETED)
  - Configurable notification thresholds (70%, 90%, 100%).
  - In-app notification events & Notification Center modal.
  - Bank statement CSV parser (handling standard formats, e.g. HDFC, ICICI, SBI, custom).
  - Deduplication pipeline & transaction reconciliation preview.
- [x] **Stage 6 — Insights and bank integration** (COMPLETED)
  - Analytics controller: category breakdowns, weekly/monthly spending trends, recurring expense heuristic.
  - Spending velocity, daily burn rate, and month-end forecast calculation in integer paise.
  - Researched and architected authorized bank-data provider integration (RBI Account Aggregator framework in India).
  - Mobile Insights tab with executive MoM summary, velocity forecast, weekly trajectory bars, category distribution, top merchants, and recurring subscription detector.
- [x] **Stage 7 — Hardening** (COMPLETED)
  - Security hardening: Helmet HTTP protection headers, express-rate-limit with generous developer/testing thresholds for OTP and auth.
  - Full test suite passing 38/38 automated integration and unit tests across 6 suites with Supertest.
  - Production build checks verified for both backend (tsc build to dist) and mobile app (Expo web bundling export).
  - All 7 Stages from master roadmap successfully executed and verified.
