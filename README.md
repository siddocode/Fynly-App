# Fynly 💸

> A premium personal finance mobile application designed to help users genuinely understand and master their spending.

---

## Overview

**Fynly** gives individuals complete visibility and control over their finances. Built with a mobile-first philosophy, Fynly delivers real-time tracking, proactive budget alerts, CSV statement reconciliation, and financial insights without relying on simulated integrations or compromising financial accuracy.

---

## Key Features

- **Multi-Account Tracking**: Manage savings, credit cards, investments, and cash balances in one consolidated view.
- **Precision Transactions**: Strict integer-paise calculations preventing any floating-point discrepancies; supports income, expenses, transfers, refunds, and search/filtering.
- **Statement Import & Reconciliation**: Import CSV statements from standard banks with automated deduplication and category assignment.
- **Intelligent Budgets**: Set daily, weekly, monthly, and category-level budgets with dynamic "Safe-to-Spend" daily calculations.
- **Multi-Tier Threshold Alerts**: Timely notifications at 70%, 90%, and 100% of spending limits to prevent budget overruns.
- **Deep Insights**: Category breakdowns, month-over-month trend analytics, and recurring subscription detection.
- **Bank-Ready Architecture**: Clean extension points for authorized Account Aggregator / open-banking providers when ready.

---

## Tech Stack

### Mobile Application
- **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 52+ / latest stable)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **Language**: TypeScript
- **Data Fetching & Cache**: [TanStack Query](https://tanstack.com/query/latest) (React Query)
- **State**: React Context / Zustand (only where strictly needed)
- **Notifications**: [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- **Icons & Styling**: Lucide React Native, tailored design tokens with glassmorphism & dark palette

### Backend API
- **Runtime & Server**: Node.js, [Express](https://expressjs.com/), TypeScript
- **Database & ORM**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Validation**: [Zod](https://zod.dev/) for request payloads, query params, and environment variables
- **Authentication**: JWT (Access + Refresh tokens) with Argon2/bcrypt password hashing
- **Testing**: Vitest / Jest, Supertest for integration testing

---

## Repository Structure

```text
fynly/
├── apps/
│   ├── mobile/
│   │   ├── app/                # Expo Router screens (tabs, modals, auth)
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom data hooks & mutations
│   │   ├── lib/                # API client, tokens, formatting utils
│   │   ├── types/              # Mobile TypeScript types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── app.json
│   └── backend/
│       ├── src/
│       │   ├── config/         # Environment schemas & configuration
│       │   ├── controllers/    # ALL API & business logic (NO services folder)
│       │   ├── middleware/     # Auth, Zod validation, error handling
│       │   ├── routes/         # Express endpoint definitions
│       │   ├── utils/          # Pure financial math, dates, deduplication hash
│       │   ├── app.ts          # Express app configuration
│       │   └── server.ts       # Server listener
│       ├── prisma/
│       │   ├── schema.prisma   # PostgreSQL models & indexes
│       │   └── migrations/     # Prisma migration history
│       ├── tests/              # Supertest integration tests
│       ├── .env.example
│       ├── package.json
│       └── tsconfig.json
├── package.json                # Monorepo root package
├── README.md                   # Project documentation
└── AGENTS.md                   # AI Agent operating constraints & roadmap
```

---

## Architecture & Coding Conventions

1. **Controller-First Architecture**:
   - All business logic, transaction handling, and query execution live directly inside `controllers/`.
   - No unnecessary service layers, repositories, or domain abstractions.
   - Shared pure functions (e.g., date window calculations, paise conversions, deduplication hash) live in `utils/`.
2. **Financial Math & Precision**:
   - Stored in the database as integer paise (1 INR = 100 paise).
   - All display formatting handles division by 100 on the presentation layer.
   - Zero floating-point math on balances or aggregations.
3. **Data Integrity & Deduplication**:
   - Deterministic SHA-256 fingerprint generated from `(userId, accountId, date, amountInPaise, normalizedDescription)`.
   - Prevents duplicate statement imports and double-counting.
4. **Validation**:
   - Strict Zod schemas on every incoming request (`req.body`, `req.params`, `req.query`).
   - Typed responses ensuring frontend contract safety.

---

## Setup & Local Development

### Prerequisites
- Node.js (v20+ or v22 LTS)
- npm or pnpm
- PostgreSQL instance running locally or via Docker

### 1. Backend Setup
```bash
cd apps/backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

### 2. Mobile Setup
```bash
cd apps/mobile
npm install
npm run start
```
Use the Expo Go app or an iOS/Android simulator to test the mobile application.

---

## Roadmap

| Stage | Focus | Status |
|---|---|---|
| **Stage 1** | Inspect & Plan (Architecture, Setup, Conventions, Risks) | **In Progress** |
| **Stage 2** | Foundation (Monorepo, Express, Prisma, Expo, Health Checks) | Upcoming |
| **Stage 3** | Authentication & Transactions (Auth, Accounts, Categories, CRUD) | Upcoming |
| **Stage 4** | Budgets & Dashboard (Safe-to-spend, Period math, Dashboard UI) | Upcoming |
| **Stage 5** | Alerts & Statement Import (CSV parser, Deduplication, Notifications) | Upcoming |
| **Stage 6** | Insights & Bank Integration (Trends, Analytics, Account Aggregator) | Upcoming |
| **Stage 7** | Hardening (Security, Tests, Performance, Deployment readiness) | Upcoming |

---

## Stage 1: Major Decisions & Technical Risks

### Major Decisions
1. **Monorepo Strategy**: Use npm workspaces for `apps/backend` and `apps/mobile` with root scripts to coordinate development.
2. **Monetary Storage**: Use `BigInt` or `Int` in Prisma representing **paise** to prevent precision issues across currencies.
3. **Flat Controller Architecture**: Keep business logic in controllers as specified; avoid service/repository layers to maintain speed, clarity, and prevent abstraction bloat.
4. **Authentication**: Stateless JWT access tokens with secure refresh tokens stored in HTTP-only cookies / secure storage on mobile.

### Identified Technical Risks & Mitigations
1. **PostgreSQL Environment**:
   - *Risk*: A local PostgreSQL server daemon is not currently active on this machine.
   - *Mitigation*: We will support running PostgreSQL via a lightweight Docker container or local PostgreSQL installation, with environment variables easily configured in `.env`.
2. **Bank Statement CSV Inconsistency**:
   - *Risk*: Indian bank statements (HDFC, ICICI, SBI, Axis) differ wildly in header names, date formats (DD/MM/YYYY vs MM/DD/YYYY), and credit/debit columns.
   - *Mitigation*: Build an adaptable column-mapping parser in Stage 5 with regex-based normalizers and pre-import preview verification.
3. **Duplicate Transaction False Positives / False Negatives**:
   - *Risk*: Identical legitimate transactions on the same day (e.g. two ₹50 coffees at the same cafe).
   - *Mitigation*: Include time/reference number when available in fingerprint; prompt user for confirmation if hash collision occurs on identical same-day amounts.
